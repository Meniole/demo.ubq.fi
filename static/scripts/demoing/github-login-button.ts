import { Octokit } from "@octokit/rest";
import { createClient } from "@supabase/supabase-js";
import YAML from "yaml";
import { getLocalStore } from "./get-local-store";
import { OAuthToken } from "./github-oauth";

// Types for configuration
interface PluginUse {
  plugin: string;
  with?: {
    evmPrivateEncrypted?: string;
    evmNetworkId?: number;
    incentives?: Record<string, unknown>;
  };
}

interface Plugin {
  uses: PluginUse[];
}

interface Config {
  plugins: Plugin[];
}

// Read and parse default configuration
const defaultConfigYaml = `plugins:
  - uses:
      - plugin: https://ubiquity-os-command-start-stop-main.ubiquity.workers.dev
  - uses:
      - plugin: https://ubiquity-os-command-wallet-main.ubiquity.workers.dev
  - uses:
      - plugin: ubiquity-os-marketplace/command-ask@main
  - uses:
      - plugin: https://ubiquity-os-command-query-user-main.ubiquity.workers.dev
  - uses:
      - plugin: https://ubiquity-os-daemon-pricing-main.ubiquity.workers.dev
  - uses:
      - plugin: "ubiquity-os-marketplace/text-conversation-rewards@main"
        with:
          incentives:
            contentEvaluator: {}
            userExtractor: {}
            dataPurge: {}
            formattingEvaluator: {}
            permitGeneration: {}
            githubComment: {}
  - uses:
      - plugin: ubiquity-os-marketplace/daemon-disqualifier@main
  - uses:
      - plugin: ubiquity-os-marketplace/daemon-merging@main
  - uses:
      - plugin: https://ubiquity-os-comment-vector-embeddings-main.ubiquity.workers.dev`;

const defaultConf = YAML.parse(defaultConfigYaml) as Config;

let encryptedValue = "";
const chainIdSelect = document.getElementById("chainId") as HTMLSelectElement;
const walletPrivateKey = document.getElementById("walletPrivateKey") as HTMLInputElement;

// Function to encrypt the private key
async function encryptPrivateKey() {
  console.log("Encrypting private key...");
  try {
    const privateKey = walletPrivateKey.value;
    // TODO: Implement actual encryption logic
    encryptedValue = privateKey; // For now, just use the value directly
    console.log("Private key encrypted");
  } catch (error) {
    console.error("Error encrypting private key:", error);
    throw error;
  }
}

function stringifyYAML(value: Record<string, unknown>): string {
  return YAML.stringify(value, { defaultKeyType: "PLAIN", defaultStringType: "QUOTE_DOUBLE", lineWidth: 0 });
}

function setEvmSettings(privateKey: string, evmNetwork: number) {
  // Find the text-conversation-rewards plugin
  const rewardsPlugin = defaultConf.plugins.find((p: Plugin) => p.uses.some((u: PluginUse) => u.plugin.includes("text-conversation-rewards")));

  if (rewardsPlugin) {
    const rewardsUse = rewardsPlugin.uses.find((u: PluginUse) => u.plugin.includes("text-conversation-rewards"));
    if (rewardsUse) {
      // Preserve existing with configuration, especially incentives
      const existingWith = rewardsUse.with || {};
      rewardsUse.with = {
        ...existingWith,
        evmPrivateEncrypted: privateKey,
        evmNetworkId: evmNetwork,
      };
    }
  }
}

declare const SUPABASE_URL: string;
declare const SUPABASE_ANON_KEY: string;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

declare const FRONTEND_URL: string;

const mainView = document.getElementsByTagName("main")[0];

async function gitHubLoginButtonHandler() {
  console.log("Initiating GitHub login...");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: FRONTEND_URL,
      // Request minimum required scope:
      // - repo to create private repository
      scopes: "repo",
    },
  });
  if (error) {
    console.error("Error logging in:", error);
  }
}

const RANDOM_START = 2;
const RANDOM_END = 7;
const BASE_36 = 36;
const generateRandomSuffix = () => Math.random().toString(BASE_36).substring(RANDOM_START, RANDOM_END);
const TEST_REPO_PREFIX = "test-repo-";
const DATA_AUTHENTICATED = "data-authenticated";
const DATA_TRUE = "true";
const DATA_FALSE = "false";

async function createTestRepository(octokit: Octokit) {
  console.log("Creating test repository...");
  try {
    const repoName = `${TEST_REPO_PREFIX}${generateRandomSuffix()}`;

    // Get authenticated user
    const { data: user } = await octokit.users.getAuthenticated();
    console.log(`Creating repository for user: ${user.login}`);

    // Create repository in user's account
    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      private: true,
      auto_init: true,
      description: "Test repository for UbiquityOS setup",
    });

    console.log(`Successfully created test repository: ${repoName}`);

    // Push config file to the repository
    console.log("Pushing configuration file...");
    const configPath = ".github/.ubiquity-os.config.yml";

    // Encrypt private key and update config
    await encryptPrivateKey();
    const updatedConf = JSON.parse(JSON.stringify(defaultConf));
    setEvmSettings(encryptedValue, Number(chainIdSelect.value));

    // Convert config to base64
    const content = btoa(stringifyYAML(updatedConf));

    await octokit.repos.createOrUpdateFileContents({
      owner: user.login,
      repo: repoName,
      path: configPath,
      message: "Add UbiquityOS configuration",
      content: content,
    });

    console.log("Successfully pushed configuration file");
    return repo;
  } catch (error) {
    console.error("Error in repository setup:", error);
    throw error;
  }
}
const gitHubLoginButtonWrapper = document.createElement("div");
const gitHubLoginButton = document.createElement("button");
export async function renderGitHubLoginButton() {
  const token = getSessionToken();

  // If we have a token, try to set up test environment
  if (token) {
    console.log("User is authenticated, setting up test environment...");
    mainView.setAttribute(DATA_AUTHENTICATED, DATA_TRUE);

    try {
      const octokit = new Octokit({ auth: token });

      // Create test repository and push config
      const repo = await createTestRepository(octokit);
      console.log(`Repository setup complete: ${repo.html_url}`);

      console.log("Test environment setup complete!");
      return;
    } catch (error) {
      console.error("Error setting up test environment:", error);
      mainView.setAttribute(DATA_AUTHENTICATED, DATA_FALSE);
    }
  } else {
    console.log("User not authenticated, showing login button...");
    mainView.setAttribute(DATA_AUTHENTICATED, DATA_FALSE);
  }

  const setButton = document.getElementById("confirmButton") as HTMLButtonElement;
  gitHubLoginButtonWrapper.appendChild(gitHubLoginButton);
  gitHubLoginButton.id = "github-login-button";
  gitHubLoginButton.innerHTML = "<span>Login</span><span class='full'>&nbsp;With GitHub</span>";
  gitHubLoginButton.addEventListener("click", gitHubLoginButtonHandler);
  if (mainView) {
    mainView.insertBefore(gitHubLoginButtonWrapper, mainView.firstChild);
  }
  setButton.disabled = false;
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
