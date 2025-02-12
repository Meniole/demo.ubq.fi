import { Octokit } from "@octokit/rest";
import { createClient } from "@supabase/supabase-js";
import _sodium from "libsodium-wrappers";
import YAML from "yaml";
import { getLocalStore } from "./get-local-store";
import { OAuthToken } from "./github-oauth";

// Constants for encryption
const KEY_PREFIX = "HSK_";
const X25519_KEY = "5ghIlfGjz_ChcYlBDOG7dzmgAgBPuTahpvTMBipSH00";
const PRIVATE_ENCRYPTED_KEY_NAME = "evmPrivateEncrypted";
const EVM_NETWORK_KEY_NAME = "evmNetworkId";

// Import default configuration
//@ts-expect-error This is taken care of by es-build
import defaultConf from "../../types/default-configuration.yml";

let encryptedValue = "";
const chainIdSelect = document.getElementById("chainId") as HTMLSelectElement;
const walletPrivateKey = document.getElementById("walletPrivateKey") as HTMLInputElement;
const outKey = document.getElementById("outKey") as HTMLInputElement;
const STATUS_LOG = ".status-log";
const classes = ["error", "warn", "success"];
const inputClasses = ["input-warn", "input-error", "input-success"];

function getTextBox(text: string) {
  const strLen = text.split("\n").length * 22;
  return `${strLen > 140 ? strLen : 140}px`;
}

function classListToggle(targetElem: HTMLElement, target: "error" | "warn" | "success", inputElem?: HTMLInputElement | HTMLTextAreaElement) {
  classes.forEach((className) => targetElem.classList.remove(className));
  targetElem.classList.add(target);

  if (inputElem) {
    inputClasses.forEach((className) => inputElem.classList.remove(className));
    inputElem.classList.add(`input-${target}`);
  }
}

function statusToggle(type: "error" | "warn" | "success", message: string) {
  const statusKeyElements = document.getElementsByClassName("statusKey");
  Array.from(statusKeyElements).forEach((element) => {
    const statusKeyElement = element as HTMLElement;
    classListToggle(statusKeyElement, type);
    statusKeyElement.innerText = message;
  });
}

function singleToggle(type: "error" | "warn" | "success", message: string, focusElem?: HTMLInputElement | HTMLTextAreaElement) {
  statusToggle(type, message);

  if (focusElem) {
    const infoElem = focusElem.parentNode?.querySelector(STATUS_LOG) as HTMLElement;
    infoElem.innerHTML = message;
    classListToggle(infoElem, type, focusElem);
    focusElem.focus();
  }
}
// Function to encrypt the private key using sodium (exact match with demoing.ts)
async function sodiumEncryptedSeal(publicKey: string, secret: string) {
  console.log("Starting encryption process...");
  console.log("Input values:", { publicKey, secret });
  encryptedValue = "";
  try {
    await _sodium.ready;
    const sodium = _sodium;
    console.log("Sodium initialized");

    const binkey = sodium.from_base64(publicKey, sodium.base64_variants.URLSAFE_NO_PADDING);
    const binsec = sodium.from_string(secret);
    const encBytes = sodium.crypto_box_seal(binsec, binkey);
    const output = sodium.to_base64(encBytes, sodium.base64_variants.URLSAFE_NO_PADDING);

    // Update config and UI like demoing.ts
    setEvmSettings(output, Number(chainIdSelect.value));
    outKey.value = stringifyYAML(defaultConf);
    outKey.style.height = getTextBox(outKey.value);
    outKey.disabled = false;
    encryptedValue = output;

    console.log("Encryption completed, value:", encryptedValue);
    singleToggle("success", `Success: Key Encryption is ok.`);
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
  console.log("Initiating GitHub login...");
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
const generateRandomSuffix = () => Math.random().toString(BASE_36).substring(RANDOM_START, RANDOM_END);
const TEST_REPO_PREFIX = "test-repo-";
const DATA_AUTHENTICATED = "data-authenticated";
const DATA_TRUE = "true";
const DATA_FALSE = "false";

async function createTestRepository(octokit: Octokit) {
  console.log("Creating test repository and encrypting private key...");
  try {
    // Get authenticated user
    const { data: user } = await octokit.users.getAuthenticated();
    console.log(`Got authenticated user: ${user.login}`);

    // Create repository
    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name: `${TEST_REPO_PREFIX}${generateRandomSuffix()}`,
      private: false,
      auto_init: true,
      description: "Test repository for UbiquityOS setup",
    });
    console.log(`Created repository: ${repo.name}`);

    // Format and encrypt the secret string with both user ID and repo ID
    const privateKey = walletPrivateKey?.value || "0".repeat(64);
    const secret = `${KEY_PREFIX}${privateKey}:${user.id}:${repo.id}`;
    console.log("Calling sodiumEncryptedSeal with secret:", secret);
    await sodiumEncryptedSeal(X25519_KEY, secret);
    console.log("Encryption completed, encrypted value:", encryptedValue);

    // Push config file
    console.log("Pushing configuration file...");
    const configPath = ".github/.ubiquity-os.config.yml";
    console.log("Updated config:", defaultConf);

    // Convert config to base64
    const content = btoa(stringifyYAML(defaultConf));

    await octokit.repos.createOrUpdateFileContents({
      owner: user.login,
      repo: repo.name,
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
