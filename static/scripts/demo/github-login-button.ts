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
const VISIBLE_CLASS = "visible";
const UI_CLASSES = {
  visible: VISIBLE_CLASS,
  authenticated: DATA_AUTHENTICATED,
  true: DATA_TRUE,
  false: DATA_FALSE,
};

const ELEMENT_IDS = {
  install: "install",
  firstIssue: "first-issue",
} as const;

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

async function pushConfigFile(octokit: Octokit, owner: string, repoName: string) {
  logger.log("Pushing configuration file...");
  const configPath = ".github/.ubiquity-os.config.yml";
  logger.log("Updated config:", defaultConf);

  const content = btoa(stringifyYAML(defaultConf));
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo: repoName,
    path: configPath,
    message: "Add UbiquityOS configuration",
    content,
  });
  logger.log("Successfully pushed configuration file");
}

async function createAndConfigureTestIssue(octokit: Octokit, repo: { owner: { login: string }; name: string }) {
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

  // Configure first issue button
  const firstIssueLink = document.getElementById("first-issue-link") as HTMLAnchorElement;
  if (firstIssueLink) {
    firstIssueLink.href = issue.html_url;
  }

  return issue;
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
    await pushConfigFile(octokit, user.login, repo.name);

    return repo;
  } catch (error) {
    console.error("Error in repository setup:", error);
    throw error;
  }
}

async function checkAndUpdateInstallButton(octokit: Octokit, owner: string, repo: string) {
  const installButton = document.getElementById(ELEMENT_IDS.install);
  const firstIssueButton = document.getElementById(ELEMENT_IDS.firstIssue);
  if (installButton && firstIssueButton) {
    try {
      const isAppInstalled = await checkAppInstallation(octokit, owner, repo);
      if (!isAppInstalled) {
        // Show install button if app is not installed
        installButton.classList.add(UI_CLASSES.visible);
        // Hide demo button until app is installed
        firstIssueButton.classList.remove(UI_CLASSES.visible);
        logger.log("App is not installed, showing install button");
      } else {
        // Hide install button and show demo button if app is installed
        installButton.classList.remove(UI_CLASSES.visible);
        firstIssueButton.classList.add(UI_CLASSES.visible);
        logger.log("App is installed, showing demo button");
      }
    } catch (error) {
      logger.log("Error checking app installation, hiding both buttons");
      console.error(error);
      installButton.classList.remove(UI_CLASSES.visible);
      firstIssueButton.classList.remove(UI_CLASSES.visible);
    }
  }
}

export async function renderGitHubLoginButton() {
  const token = getSessionToken();
  const loginButton = document.getElementById("github-login") as HTMLDivElement;
  const gitHubLoginButton = document.getElementById("github-login-button") as HTMLButtonElement;

  // Add click handler to the button
  gitHubLoginButton.addEventListener("click", gitHubLoginButtonHandler);

  // Check if we're returning from app installation
  const searchParams = new URLSearchParams(window.location.search);
  const installationId = searchParams.get("installation_id");

  // If we have a token, try to set up test environment
  if (token) {
    logger.log("User is authenticated, setting up test environment...");
    mainView.setAttribute(UI_CLASSES.authenticated, UI_CLASSES.true);
    // Hide login button and ensure other buttons are hidden until we check installation
    loginButton.classList.remove(UI_CLASSES.visible);
    const installButton = document.getElementById(ELEMENT_IDS.install);
    const firstIssueButton = document.getElementById(ELEMENT_IDS.firstIssue);
    if (installButton) installButton.classList.remove(UI_CLASSES.visible);
    if (firstIssueButton) firstIssueButton.classList.remove(UI_CLASSES.visible);

    try {
      const octokit = new Octokit({ auth: token });

      // Create test repository and push config
      const repo = await createTestRepository(octokit);
      logger.log(`Repository setup complete: ${repo.html_url}`);

      // Create and configure test issue
      await createAndConfigureTestIssue(octokit, repo);

      // Check installation status
      await checkAndUpdateInstallButton(octokit, repo.owner.login, repo.name);

      // If we just installed the app, check installation status again
      if (installationId) {
        await checkAndUpdateInstallButton(octokit, repo.owner.login, repo.name);
        // Clean up URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      logger.log("Test environment setup complete!");
      return;
    } catch (error) {
      console.error("Error setting up test environment:", error);
      mainView.setAttribute(UI_CLASSES.authenticated, UI_CLASSES.false);
    }
  } else {
    logger.log("User not authenticated, showing login button...");
    mainView.setAttribute(UI_CLASSES.authenticated, UI_CLASSES.false);
    // Ensure login button is visible when not authenticated
    loginButton.classList.add(UI_CLASSES.visible);
    // Hide other buttons when not authenticated
    const installButton = document.getElementById(ELEMENT_IDS.install);
    const firstIssueButton = document.getElementById(ELEMENT_IDS.firstIssue);
    if (installButton) installButton.classList.remove(UI_CLASSES.visible);
    if (firstIssueButton) firstIssueButton.classList.remove(UI_CLASSES.visible);
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
