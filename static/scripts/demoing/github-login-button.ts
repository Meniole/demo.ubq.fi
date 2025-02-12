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

export async function renderGitHubLoginButton() {
  const token = getSessionToken();

  // If we have a token, try to set up test environment
  if (token) {
    logger.log("User is authenticated, setting up test environment...");
    mainView.setAttribute(DATA_AUTHENTICATED, DATA_TRUE);

    try {
      const octokit = new Octokit({ auth: token });

      // Create test repository and push config
      const repo = await createTestRepository(octokit);
      logger.log(`Repository setup complete: ${repo.html_url}`);

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
  gitHubLoginButton.innerHTML = "<span>Login</span><span class='full'>&nbsp;With GitHub</span>";
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
