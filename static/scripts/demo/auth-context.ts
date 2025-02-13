/**
 * AUTHENTICATION CONTEXT
 * This file combines all authentication-related code from the demo.ubq.fi project
 * to provide complete context for debugging the app installation polling issue.
 *
 * Key Components:
 * 1. GitHub OAuth Flow
 * 2. User Types & Interfaces
 * 3. Login Button & Authentication Logic
 * 4. App Installation Checking & Polling
 */

import { Octokit } from "@octokit/rest";
import { createClient } from "@supabase/supabase-js";
import { getLocalStore } from "./local-store";

declare const logger: {
  log: (...args: unknown[]) => void;
};

declare const SUPABASE_URL: string;
declare const SUPABASE_ANON_KEY: string;
declare const FRONTEND_URL: string;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const mainView = document.getElementsByTagName("main")[0];

// =============================================
// 1. GITHUB OAUTH TYPES
// =============================================

export interface OAuthToken {
  provider_token: string;
  access_token: string;
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  token_type: string;
  user: User;
}

// =============================================
// 2. USER TYPES & INTERFACES
// =============================================

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

// =============================================
// 3. AUTHENTICATION CONSTANTS & SETUP
// =============================================

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

// =============================================
// 4. GITHUB APP INSTALLATION CHECKING
// =============================================

type OctokitError = {
  status: number;
  message: string;
  response?: {
    data?: unknown;
    headers?: Record<string, string>;
  };
};

interface InstallationTokenResponse {
  token: string;
  expires_at: string;
  permissions: Record<string, string>;
}

/**
 * Tests if the provider token is valid for GitHub API calls
 * This helps diagnose if OAuth token has correct permissions
 */
async function testProviderToken(token: string): Promise<boolean> {
  try {
    logger.log("Testing provider token validity...");
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${token}`,
        Accept: GITHUB_ACCEPT_HEADER,
      },
    });

    const headers = Object.fromEntries(response.headers);
    logger.log("API Response Headers:", headers);

    if (response.ok) {
      const data = await response.json();
      logger.log("Provider token is valid. User data:", data);
      return true;
    } else {
      const error = await response.json();
      logger.log("Provider token validation failed:", {
        status: response.status,
        statusText: response.statusText,
        error,
        rateLimit: {
          limit: headers["x-ratelimit-limit"],
          remaining: headers["x-ratelimit-remaining"],
          reset: headers["x-ratelimit-reset"],
        },
      });
      return false;
    }
  } catch (error) {
    logger.log("Error testing provider token:", error);
    return false;
  }
}

/**
 * Fetches an installation access token for app-specific API calls
 * This token has different permissions than the user OAuth token
 */
async function getInstallationToken(octokit: Octokit, installationId: number): Promise<string | null> {
  try {
    logger.log(`Fetching installation token for installation ${installationId}...`);
    const response = await octokit.request("POST /app/installations/{installation_id}/access_tokens", {
      installation_id: installationId,
      headers: {
        Accept: GITHUB_ACCEPT_HEADER,
      },
    });

    const tokenData = response.data as InstallationTokenResponse;
    logger.log("Successfully retrieved installation token:", {
      expiresAt: tokenData.expires_at,
      permissions: tokenData.permissions,
    });
    return tokenData.token;
  } catch (error) {
    const octokitError = error as OctokitError;
    logger.log("Failed to get installation token:", {
      status: octokitError.status,
      message: octokitError.message,
      response: octokitError.response?.data,
      headers: octokitError.response?.headers,
    });
    return null;
  }
}

/**
 * Checks if the GitHub App is installed in a repository
 * Uses both REST API and direct request approaches for redundancy
 */
/**
 * Enhanced version that tries both OAuth token and installation token
 * Also includes detailed error logging for debugging
 */
async function checkAppInstallation(octokit: Octokit, owner: string, repo: string): Promise<boolean> {
  // First test if the provider token is valid
  const token = typeof octokit.auth === "string" ? octokit.auth : "";
  const isTokenValid = await testProviderToken(token);
  if (!isTokenValid) {
    logger.log("Provider token validation failed, installation check may not work");
  }

  try {
    // Try both REST API and direct request approaches
    logger.log(`Checking installation for ${owner}/${repo}...`);

    try {
      logger.log("Attempting REST API call...");
      const { data: repoInstall } = await octokit.rest.apps.getRepoInstallation({
        owner,
        repo,
        headers: {
          Accept: GITHUB_ACCEPT_HEADER,
        },
      });
      logger.log("REST API call successful:", JSON.stringify(repoInstall, null, 2));

      // If we got the installation, try to get an installation token
      if (repoInstall.id) {
        const installationToken = await getInstallationToken(octokit, repoInstall.id);
        if (installationToken) {
          // Create new Octokit instance with installation token
          const installationOctokit = new Octokit({
            auth: installationToken,
            headers: {
              Accept: GITHUB_ACCEPT_HEADER,
            },
          });
          // Verify installation with new token
          const { data: verifyInstall } = await installationOctokit.request("GET /installation/repositories");
          logger.log("Installation verified with installation token:", verifyInstall);
        }
      }

      return repoInstall.app_slug === "ubiquity-os";
    } catch (restError) {
      const error = restError as OctokitError;
      logger.log("REST API call failed:", {
        status: error.status,
        message: error.message,
        response: error.response?.data,
      });

      // Try direct request as fallback
      logger.log("Attempting direct request...");
      const { data: directInstall, headers: responseHeaders } = await octokit.request("GET /repos/{owner}/{repo}/installation", {
        owner,
        repo,
        headers: {
          Accept: GITHUB_ACCEPT_HEADER,
        },
      });

      // Log rate limit information
      logger.log("API Rate Limit Info:", {
        limit: responseHeaders["x-ratelimit-limit"],
        remaining: responseHeaders["x-ratelimit-remaining"],
        reset: responseHeaders["x-ratelimit-reset"],
      });

      logger.log("Direct request successful:", JSON.stringify(directInstall, null, 2));
      return directInstall.app_slug === "ubiquity-os";
    }
  } catch (error) {
    const octokitError = error as OctokitError;
    // Log detailed error information
    logger.log("Installation check failed:", {
      status: octokitError.status,
      message: octokitError.message,
      response: octokitError.response?.data,
      headers: octokitError.response?.headers,
    });
    return false;
  }
}

/**
 * Polls for GitHub App installation status
 * Checks every 5 seconds until installation is detected
 */
async function pollInstallationStatus(octokit: Octokit, owner: string, repo: string): Promise<void> {
  return new Promise((resolve) => {
    const checkInterval = setInterval(async () => {
      const isInstalled = await checkAppInstallation(octokit, owner, repo);
      if (isInstalled) {
        logger.log("Installation detected via polling");
        clearInterval(checkInterval);
        resolve();
      }
    }, 5000); // Check every 5 seconds
  });
}

/**
 * Updates the install button visibility based on app installation status
 */
async function checkAndUpdateInstallButton(octokit: Octokit, owner: string, repo: string) {
  const installButton = document.getElementById(ELEMENT_IDS.install);
  if (!installButton) return;

  try {
    const isAppInstalled = await checkAppInstallation(octokit, owner, repo);
    if (!isAppInstalled) {
      // Show install button if app is not installed
      installButton.classList.add(UI_CLASSES.visible);
      logger.log("App is not installed, showing install button");
      return false;
    } else {
      // Hide install button if app is installed
      installButton.classList.remove(UI_CLASSES.visible);
      logger.log("App is installed, hiding install button");
      return true;
    }
  } catch (error) {
    logger.log("Error checking app installation");
    console.error(error);
    return false;
  }
}

// =============================================
// 5. AUTHENTICATION FLOW
// =============================================

/**
 * Handles GitHub login button click
 * Initiates OAuth flow with required scopes
 */
export async function gitHubLoginButtonHandler() {
  logger.log("Initiating GitHub login...");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: FRONTEND_URL,
      // Request minimum required scope:
      // - public_repo to create public repositories
      scopes: "public_repo, read:org, read:user",
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

// =============================================
// 6. TEST ENVIRONMENT SETUP
// =============================================

/**
 * Sets up test environment after successful authentication
 * 1. Creates test repository
 * 2. Checks app installation
 * 3. Polls for installation if needed
 * 4. Creates test issue
 */
export async function setupTestEnvironment(token: string, loginButton: HTMLDivElement) {
  logger.log("Setting up test environment...");
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

    logger.log("Checking initial app installation status...");
    const isInstalled = await checkAndUpdateInstallButton(octokit, repo.owner.login, repo.name);
    logger.log(`Initial installation check result: ${isInstalled}`);

    if (!isInstalled) {
      logger.log("App not installed, starting installation polling...");
      await pollInstallationStatus(octokit, repo.owner.login, repo.name);
    }

    // At this point the app is installed (either initially or via polling)
    logger.log("App is installed, proceeding with issue creation");
    await createAndConfigureTestIssue(octokit, repo);
    const firstIssueButton = document.getElementById(ELEMENT_IDS.firstIssue);
    if (firstIssueButton) {
      firstIssueButton.classList.add(UI_CLASSES.visible);
      logger.log("First issue button is now visible");
    }
  } catch (error) {
    console.error("Error setting up test environment:", error);
    mainView.setAttribute(UI_CLASSES.authenticated, UI_CLASSES.false);
    loginButton.classList.add(UI_CLASSES.visible);
  }
}

// Helper functions from other files
async function createTestRepository(octokit: Octokit) {
  const { data: repo } = await octokit.repos.createForAuthenticatedUser({
    name: `ubiquity-os-demo-${Math.random().toString(36).substring(2, 7)}`,
    private: false,
    auto_init: true,
    description: "Test repository for UbiquityOS setup",
  });
  return repo;
}

async function createAndConfigureTestIssue(octokit: Octokit, repo: { owner: { login: string }; name: string }) {
  const { data: issue } = await octokit.issues.create({
    owner: repo.owner.login,
    repo: repo.name,
    title: "Welcome to UbiquityOS!",
    body: "This is a test issue for the demo.",
  });
  return issue;
}

/**
 * AUTHENTICATION FLOW SUMMARY:
 *
 * 1. User clicks GitHub login button
 * 2. Supabase OAuth flow initiates with GitHub
 * 3. After successful OAuth, user is redirected back with provider_token
 * 4. Token is either stored in URL hash or retrieved from local storage
 * 5. Test environment setup begins:
 *    - Create test repository
 *    - Check if GitHub App is installed
 *    - If not installed:
 *      * Show install button
 *      * Start polling for installation status
 *    - Once installed:
 *      * Create test issue
 *      * Show first issue button
 *
 * POLLING ISSUE DEBUGGING NOTES:
 *
 * The polling mechanism (pollInstallationStatus) checks installation status
 * every 5 seconds using checkAppInstallation(). This function tries two approaches:
 *
 * 1. REST API call: octokit.rest.apps.getRepoInstallation()
 * 2. Direct request: octokit.request("GET /repos/{owner}/{repo}/installation")
 *
 * Both approaches use the GitHub Accept header for the Apps API.
 * Detailed error logging is implemented to help diagnose issues.
 *
 * Key areas to check if polling fails:
 * 1. OAuth token validity and scopes
 * 2. GitHub API rate limits
 * 3. App installation webhook delivery
 * 4. Network connectivity issues
 * 5. GitHub API response headers and error messages
 */
