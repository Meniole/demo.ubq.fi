/**
 * AUTHENTICATION CONTEXT
 * This file combines all authentication-related code from the demo.ubq.fi project.
 *
 * Key Components:
 * 1. GitHub OAuth Flow
 * 2. User Types & Interfaces
 * 3. Login Button & Authentication Logic
 * 4. GitHub App Installation UI
 */

import { Octokit } from "@octokit/rest";
import { createClient } from "@supabase/supabase-js";
import _sodium from "libsodium-wrappers";
import YAML from "yaml";
//@ts-expect-error This is taken care of by es-build
import defaultConf from "../../types/default-configuration.yml";
import { getLocalStore } from "./local-store";

// Constants for encryption
const X25519_KEY = "hdgyJSh473Sf4RJQjovpiKZn5jf-IsGeOBnmDBwYAyY";
const PRIVATE_ENCRYPTED_KEY_NAME = "evmPrivateEncrypted";
const EVM_NETWORK_KEY_NAME = "evmNetworkId";

declare const logger: {
  log: (...args: unknown[]) => void;
};

async function sodiumEncryptedSeal(publicKey: string, secret: string) {
  await _sodium.ready;
  const sodium = _sodium;

  if (!publicKey) {
    return;
  }

  const binkey = sodium.from_base64(publicKey, sodium.base64_variants.URLSAFE_NO_PADDING);
  const binsec = sodium.from_string(secret);
  const encBytes = sodium.crypto_box_seal(binsec, binkey);
  return sodium.to_base64(encBytes, sodium.base64_variants.URLSAFE_NO_PADDING);
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

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const mainView = document.getElementsByTagName("main")[0];

export interface OAuthToken {
  provider_token: string;
  access_token: string;
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface UserMetadata {
  avatar_url: string;
  email: string;
  email_verified: boolean;
  full_name: string;
  iss: string;
  name: string;
  phone_verified: boolean;
  preferred_username: string;
  provider_id: string;
  sub: string;
  user_name: string;
}

export interface Identity {
  id: string;
  user_id: string;
  identity_data: {
    avatar_url: string;
    email: string;
    email_verified: boolean;
    full_name: string;
    iss: string;
    name: string;
    phone_verified: boolean;
    preferred_username: string;
    provider_id: string;
    sub: string;
    user_name: string;
  };
  provider: string;
  last_sign_in_at: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  aud: string;
  role: string;
  email: string;
  email_confirmed_at: string;
  phone: string;
  confirmed_at: string;
  last_sign_in_at: string;
  app_metadata: { provider: string; providers: string[] };
  user_metadata: UserMetadata;
  identities: Array<Identity>;
  created_at: string;
  updated_at: string;
}

const GITHUB_ACCEPT_HEADER = "application/vnd.github+json";

// UI Constants
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

/**
 * Handles GitHub login button click
 * Initiates OAuth flow with required scopes
 */
export async function gitHubLoginButtonHandler() {
  logger.log("Initiating GitHub login...");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: window.location.href,
      // Request minimum required scope:
      // - public_repo to create public repositories
      scopes: "public_repo",
    },
  });
  if (error) {
    console.error("Error logging in:", error);
  }
}

/**
 * Gets session token from either:
 * 1. URL hash after OAuth redirect
 * 2. Cached session in local storage
 */
export function getSessionToken() {
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

function getNewSessionToken() {
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.substring(1)); // remove the '#' and parse
  const providerToken = params.get("provider_token");
  if (!providerToken) {
    return null;
  }
  return providerToken;
}

/**
 * Sets up demo environment after successful authentication
 * 1. Creates demo repository
 * 2. Shows GitHub App install button
 * 3. Creates demo issue
 */
export async function setupDemoEnvironment(token: string, loginButton: HTMLDivElement) {
  logger.log("Setting up demo environment...");
  mainView.setAttribute(UI_CLASSES.authenticated, UI_CLASSES.true);
  loginButton.classList.remove(UI_CLASSES.visible);

  try {
    const octokit = new Octokit({
      auth: token,
      headers: {
        Accept: GITHUB_ACCEPT_HEADER,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    const repo = await createTestRepository(octokit);
    logger.log(`Repository setup complete: ${repo.html_url}`);

    logger.log("Inviting the demo user as a collaborator");
    await inviteUserAsCollaborator(octokit, repo);

    // Always show install button after repository creation
    const installButton = document.getElementById(ELEMENT_IDS.install);
    if (installButton) {
      installButton.classList.add(UI_CLASSES.visible);
      logger.log("Install button is now visible");
    }

    // Create the issue
    logger.log("Proceeding with issue creation");
    await createAndConfigureTestIssue(octokit, repo);
    const firstIssueButton = document.getElementById(ELEMENT_IDS.firstIssue);
    if (firstIssueButton) {
      firstIssueButton.classList.add(UI_CLASSES.visible);
      logger.log("You are now ready to start the demo");
    }
  } catch (error) {
    console.error("Error setting up demo environment:", error);
    mainView.setAttribute(UI_CLASSES.authenticated, UI_CLASSES.false);
    loginButton.classList.add(UI_CLASSES.visible);
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

async function createTestRepository(octokit: Octokit) {
  logger.log("Creating test repository and encrypting private key...");
  try {
    // Get authenticated user
    const { data: user } = await octokit.users.getAuthenticated();
    logger.log(`Got authenticated user: ${user.login}`);

    // Create repository
    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name: `ubiquity-os-demo-${Math.random().toString(36).substring(2, 7)}`,
      private: false,
      auto_init: true,
      description: "Demo repository for UbiquityOS",
    });
    logger.log(`Created repository: ${repo.name}`);

    // Format and encrypt the secret string with both user ID and repo ID
    const privateKey = BigInt(1).toString(16).padStart(64, "0"); // 0x1 which is the smallest valid key.
    const secret = `${privateKey}:${user.id}:${repo.id}`;
    const encryptedKey = await sodiumEncryptedSeal(X25519_KEY, secret);
    if (encryptedKey) {
      setEvmSettings(encryptedKey, 100); // Default to network ID 100
    }

    // Push config file
    await pushConfigFile(octokit, user.login, repo.name);

    // Create required labels
    const labels = [
      {
        name: "Priority: 3 (High)",
        color: "ededed", // red color
        description: "High priority tasks",
      },
      {
        name: "Time: <2 Hours",
        color: "ededed", // green color
        description: "Tasks that take less than 2 hours",
      },
      {
        name: "Price: 75 USD",
        color: "1f883d", // green color
        description: "75 USD reward for completion",
      },
    ];

    // Create labels, ignoring errors if they already exist
    for (const label of labels) {
      try {
        await octokit.issues.createLabel({
          owner: user.login,
          repo: repo.name,
          ...label,
        });
        logger.log(`Created label: ${label.name}`);
      } catch (error) {
        // Type guard to check if it's a GitHub API error
        if (error && typeof error === "object" && "status" in error && error.status === 422) {
          logger.log(`Label already exists: ${label.name}`);
        } else {
          // Log but don't throw other errors to allow the demo to continue
          console.error(`Error creating label ${label.name}:`, error);
        }
      }
    }

    return repo;
  } catch (error) {
    console.error("Error in repository setup:", error);
    throw error;
  }
}

async function createAndConfigureTestIssue(octokit: Octokit, repo: { owner: { login: string }; name: string }) {
  const { data: issue } = await octokit.issues.create({
    owner: repo.owner.login,
    repo: repo.name,
    title: "Welcome to UbiquityOS!",
    labels: ["Priority: 3 (High)", "Time: <2 Hours", "Price: 75 USD"],
    body: `This interactive demo showcases how UbiquityOS streamlines development workflows and automates task management.

Comment \`/demo\` below to initiate an interactive demonstration. Your AI team member @ubiquity-os-simulant will guide you through the core features while explaining their business impact.

### Overview
- Discover automated pricing for tasks
- Explore context-sensitive inquiry capabilities
- Engage with live collaboration tools
- Understand comprehensive contribution tracking
- Experience payment integration via smart contracts

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

  const repoNameDisplay = document.getElementById(`repo-name`) as HTMLSpanElement;
  if (repoNameDisplay) {
    const urlParts = issue.html_url.split("/");
    repoNameDisplay.textContent = `"${urlParts[3]}/${urlParts[4]}"`;
  }

  return issue;
}

async function inviteUserAsCollaborator(octokit: Octokit, repo: { owner: { login: string }; name: string }) {
  const botUserName = "ubiquity-os-simulant";
  await octokit.rest.repos.addCollaborator({
    owner: repo.owner.login,
    repo: repo.name,
    username: botUserName,
    permission: "push",
  });

  logger.log(`Invited ${botUserName} collaborator for ${repo.owner.login}/${repo.name}`);
}

/**
 * AUTHENTICATION FLOW SUMMARY:
 *
 * 1. User clicks GitHub login button
 * 2. Supabase OAuth flow initiates with GitHub
 * 3. After successful OAuth, user is redirected back with provider_token
 * 4. Token is either stored in URL hash or retrieved from local storage
 * 5. Test environment setup begins:
 *    - Create demo repository
 *    - Show GitHub App install button
 *    - Create demo issue
 *    - Show first issue button
 */
