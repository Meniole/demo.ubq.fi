//@ts-expect-error This is taken care of by es-build
import defaultConf from "../../types/default-configuration.yml";
import { getSessionToken, gitHubLoginButtonHandler, setupDemoEnvironment } from "./auth-context";

function initializeAuth() {
  const token = getSessionToken();
  const loginButton = document.getElementById("github-login") as HTMLDivElement;
  const gitHubLoginButton = document.getElementById("github-login-button") as HTMLButtonElement;

  // Add click handler to the button
  gitHubLoginButton.addEventListener("click", gitHubLoginButtonHandler);

  // Show login button if not authenticated
  if (!token) {
    loginButton.classList.add("visible");
  } else if (loginButton) {
    // If we have a token, set up test environment
    setupDemoEnvironment(token, loginButton).catch(console.error);
  }
}

async function init() {
  if (defaultConf !== undefined) {
    try {
      initializeAuth();
    } catch (error) {
      console.error(error);
    }
  } else {
    throw new Error("Default config fetch failed");
  }
}

init().catch(console.error);

import { grid } from "../the-grid";
grid(document.getElementById("grid") as HTMLElement, () => document.body.classList.add("grid-loaded")); // @DEV: display grid background
