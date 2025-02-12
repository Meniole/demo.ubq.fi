import { createClient } from "@supabase/supabase-js";
import { getLocalStore } from "./get-local-store";
import { OAuthToken } from "./github-oauth";

declare const SUPABASE_URL: string;
declare const SUPABASE_ANON_KEY: string;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

declare const FRONTEND_URL: string;

const mainView = document.getElementsByTagName("main")[0];

async function gitHubLoginButtonHandler() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: FRONTEND_URL,
      scopes: "admin:org user:read repo",
    },
  });
  if (error) {
    console.error("Error logging in:", error);
  }
}
const gitHubLoginButtonWrapper = document.createElement("div");
const gitHubLoginButton = document.createElement("button");
export async function renderGitHubLoginButton() {
  // No need to show the OAuth button if we are already logged in
  if (getSessionToken()) {
    mainView.setAttribute("data-authenticated", "true");
    return;
  } else {
    mainView.setAttribute("data-authenticated", "false");
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
