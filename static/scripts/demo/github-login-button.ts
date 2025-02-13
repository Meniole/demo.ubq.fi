import { Octokit } from "@octokit/rest";
import { createClient } from "@supabase/supabase-js";
import _sodium from "libsodium-wrappers";
import YAML from "yaml";
import { getLocalStore } from "./get-local-store";
import { OAuthToken } from "./github-oauth";

// Constants for encryption
const X25519_KEY = "hdgyJSh473Sf4RJQjovpiKZn5jf-IsGeOBnmDBwYAyY";
const PRIVATE_ENCRYPTED_KEY_NAME = "evmPrivateEncrypted";
const EVM_NETWORK_KEY_NAME = "evmNetworkId";

// Import default configuration
//@ts-expect-error This is taken care of by es-build
import defaultConf from "../../types/default-configuration.yml";

const chainIdSelect = document.getElementById("chainId") as HTMLSelectElement;

async function sodiumEncryptedSeal(publicKey: string, secret: string) {
  await _sodium.ready;
  const sodium = _sodium;

  if (!publicKey) {
    return;
  }

  const binkey = sodium.from_base64(publicKey, sodium.base64_variants.URLSAFE_NO_PADDING);
  const binsec = sodium.from_string(secret);
  const encBytes = sodium.crypto_box_seal(binsec, binkey);
  const output = sodium.to_base64(encBytes, sodium.base64_variants.URLSAFE_NO_PADDING);

  // Update config and UI
  setEvmSettings(output, Number(chainIdSelect.value));
}

function stringifyYAML(value: Record<string, unknown>): string {
  return YAML.stringify(value, { defaultKeyType: "PLAIN", defaultStringType: "QUOTE_DOUBLE", lineWidth: 0 });
}

function setEvmSettings(privateKey: string, evmNetwork: number) {
  // Find the text-conversation-rewards plugin
  for (const plugin of defaultConf.plugins) {
    for (const use of plugin.uses) {
      if (use.plugin.includes("text-conversation-rewards")) {
        use.with = {
          ...use.with,
          [PRIVATE_ENCRYPTED_KEY_NAME]: privateKey,
          [EVM_NETWORK_KEY_NAME]: evmNetwork,
        };
      }
    }
  }
}

declare const SUPABASE_URL: string;
declare const SUPABASE_ANON_KEY: string;
declare const FRONTEND_URL: string;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const mainView = document.getElementsByTagName("main")[0];
const controlsView = document.getElementsByClassName("controls")[0];

async function gitHubLoginButtonHandler() {
  logger.log("Initiating GitHub login...");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: FRONTEND_URL,
      // Request minimum required scope:
      // - public_repo to create public repositories
      scopes: "public_repo",
    },
  });
  if (error) {
    console.error("Error logging in:", error);
  }
}

const RANDOM_START = 2;
const RANDOM_END = 7;
const BASE_36 = 36;
function generateRandomSuffix() {
  return Math.random().toString(BASE_36).substring(RANDOM_START, RANDOM_END);
}
const TEST_REPO_PREFIX = "ubiquity-os-demo-";
const DATA_AUTHENTICATED = "data-authenticated";
const DATA_TRUE = "true";
const DATA_FALSE = "false";

async function checkAppInstallation(octokit: Octokit, owner: string, repo: string): Promise<boolean> {
  try {
    // Get the repository installation status
    const { data: repoData } = await octokit.repos.get({
      owner,
      repo,
    });

    return !!repoData.permissions?.maintain;
  } catch (error) {
    console.error("Error checking app installation:", error);
    return false;
  }
}

async function createTestRepository(octokit: Octokit) {
  logger.log("Creating test repository and encrypting private key...");
  try {
    // Get authenticated user
    const { data: user } = await octokit.users.getAuthenticated();
    logger.log(`Got authenticated user: ${user.login}`);

    // Create repository
    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name: `${TEST_REPO_PREFIX}${generateRandomSuffix()}`,
      private: false,
      auto_init: true,
      description: "Test repository for UbiquityOS setup",
    });
    logger.log(`Created repository: ${repo.name}`);

    // Format and encrypt the secret string with both user ID and repo ID
    const privateKey = "0000000000000000000000000000000000000000000000000000000000000000";
    const secret = `${privateKey}:${user.id}:${repo.id}`;
    await sodiumEncryptedSeal(X25519_KEY, secret);

    // Push config file
    logger.log("Pushing configuration file...");
    const configPath = ".github/.ubiquity-os.config.yml";
    logger.log("Updated config:", defaultConf);

    // Convert config to base64
    const content = btoa(stringifyYAML(defaultConf));

    await octokit.repos.createOrUpdateFileContents({
      owner: user.login,
      repo: repo.name,
      path: configPath,
      message: "Add UbiquityOS configuration",
      content: content,
    });

    logger.log("Successfully pushed configuration file");
    return repo;
  } catch (error) {
    console.error("Error in repository setup:", error);
    throw error;
  }
}

const gitHubLoginButtonWrapper = document.createElement("div");
gitHubLoginButtonWrapper.className = "login";
const gitHubLoginButton = document.createElement("button");

async function checkAndUpdateInstallButton(octokit: Octokit, owner: string, repo: string) {
  const installButton = document.getElementById("install");
  if (installButton) {
    const isAppInstalled = await checkAppInstallation(octokit, owner, repo);
    if (isAppInstalled) {
      installButton.style.display = "none";
      logger.log("App is installed, hiding install button");
    } else {
      logger.log("App is not installed, showing install button");
    }
  }
}

export async function renderGitHubLoginButton() {
  const token = getSessionToken();

  // Check if we're returning from app installation
  const searchParams = new URLSearchParams(window.location.search);
  const installationId = searchParams.get("installation_id");

  // If we have a token, try to set up test environment
  if (token) {
    logger.log("User is authenticated, setting up test environment...");
    mainView.setAttribute(DATA_AUTHENTICATED, DATA_TRUE);

    try {
      const octokit = new Octokit({ auth: token });

      // Create test repository and push config
      const repo = await createTestRepository(octokit);
      logger.log(`Repository setup complete: ${repo.html_url}`);

      // Create test issue
      const { data: issue } = await octokit.issues.create({
        owner: repo.owner.login,
        repo: repo.name,
        title: "Welcome to UbiquityOS!",
        body: `This interactive demo showcases how UbiquityOS streamlines development workflows and automates task management.

Comment \`/demo\` below to initiate an interactive demonstration. Your AI team member @ubiquity-os-simulant will guide you through the core features while explaining their business impact.

### Overview
- Watch AI-powered task matching in action
- See automated task pricing calculations
- Experience real-time collaboration features
- Observe smart contract integration for payments

### Tips
- Feel free to interact with any of the commands you see during the demo to explore the system yourself!
- You are also able to create a [new issue](new) to start over at any time.
- See more commands by commenting \`/help\``,
      });
      logger.log(`Created test issue: ${issue.html_url}`);

      // Show and configure first issue button
      const firstIssueLink = document.getElementById("first-issue-link") as HTMLAnchorElement;
      if (firstIssueLink) {
        firstIssueLink.href = issue.html_url;
        firstIssueLink.style.display = "inline-block";
      }

      // Check installation status
      await checkAndUpdateInstallButton(octokit, repo.owner.login, repo.name);

      // If we just installed the app, refresh the page to clear the URL parameters
      if (installationId) {
        window.location.href = window.location.pathname;
        return;
      }

      logger.log("Test environment setup complete!");
      return;
    } catch (error) {
      console.error("Error setting up test environment:", error);
      mainView.setAttribute(DATA_AUTHENTICATED, DATA_FALSE);
    }
  } else {
    logger.log("User not authenticated, showing login button...");
    mainView.setAttribute(DATA_AUTHENTICATED, DATA_FALSE);
  }

  gitHubLoginButtonWrapper.appendChild(gitHubLoginButton);
  gitHubLoginButton.id = "github-login-button";
  gitHubLoginButton.innerHTML = `<span><svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 98 98"><path fill-rule="evenodd" clip-rule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" /></svg></span>`;
  gitHubLoginButton.innerHTML += "<span>Login</span><span class='full'>&nbsp;With GitHub</span>";
  gitHubLoginButton.addEventListener("click", gitHubLoginButtonHandler);
  if (controlsView) {
    controlsView.insertBefore(gitHubLoginButtonWrapper, controlsView.firstChild);
  }
}

function getNewSessionToken() {
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.substring(1)); // remove the '#' and parse
  const providerToken = params.get("provider_token");
  if (!providerToken) {
    return null;
  }
  return providerToken;
}

function getSessionToken() {
  // cSpell: ignore wfzpewmlyiozupulbuur
  const cachedSessionToken = getLocalStore<OAuthToken>("sb-wfzpewmlyiozupulbuur-auth-token");
  if (cachedSessionToken) {
    return cachedSessionToken.provider_token;
  }
  const newSessionToken = getNewSessionToken();
  if (newSessionToken) {
    return newSessionToken;
  }
  return null;
}

export { getSessionToken };
