import YAML from "yaml";
//@ts-expect-error This is taken care of by es-build
import defaultConf from "../../types/default-configuration.yml";
import { getSessionToken, gitHubLoginButtonHandler, setupTestEnvironment } from "./auth-context";

const inputClasses = ["input-warn", "input-error", "input-success"];

export async function parseYAML<T>(data: string | undefined) {
  if (!data) return undefined;
  try {
    const parsedData = await YAML.parse(data);
    if (parsedData !== null) {
      return parsedData as T;
    } else {
      return undefined;
    }
  } catch (error) {
    return undefined;
  }
}

export async function parseJSON<T>(data: string) {
  try {
    const parsedData = await JSON.parse(data);
    return parsedData as T;
  } catch (error) {
    return undefined;
  }
}

export function stringifyYAML(value: Record<string, unknown>): string {
  return YAML.stringify(value, { defaultKeyType: "PLAIN", defaultStringType: "QUOTE_DOUBLE", lineWidth: 0 });
}

function setInputListeners() {
  const inputs = document.querySelectorAll("input") as NodeListOf<HTMLInputElement>;

  inputs.forEach((input) => {
    input.addEventListener("input", (e) => {
      inputClasses.forEach((className) => (e.target as HTMLInputElement).classList.remove(className));
    });
  });
}

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
    setupTestEnvironment(token, loginButton).catch(console.error);
  }
}

async function init() {
  if (defaultConf !== undefined) {
    try {
      setInputListeners();
      initializeAuth();
    } catch (error) {
      console.error(error);
    }
  } else {
    throw new Error("Default config fetch failed");
  }
}

init().catch((error) => {
  console.error(error);
});

import { grid } from "../the-grid";
grid(document.getElementById("grid") as HTMLElement, () => document.body.classList.add("grid-loaded")); // @DEV: display grid background
