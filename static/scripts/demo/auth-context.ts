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
import { getLocalStore } from "./local-store";

declare const logger: {
  log: (...args: unknown[]) => void;
};

declare const SUPABASE_URL: string;
declare const SUPABASE_ANON_KEY: string;
declare const FRONTEND_URL: string;

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
      logger.log("First issue button is now visible");
    }
  } catch (error) {
    console.error("Error setting up demo environment:", error);
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
    body: "This is a demo issue for the demo.",
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
 *    - Create demo repository
 *    - Show GitHub App install button
 *    - Create demo issue
 *    - Show first issue button
 */
