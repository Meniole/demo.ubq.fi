import YAML from "yaml";
//@ts-expect-error This is taken care of by es-build
import defaultConf from "../../types/default-configuration.yml";
import { renderGitHubLoginButton } from "./github-login-button";

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

async function init() {
  if (defaultConf !== undefined) {
    try {
      setInputListeners();
      await renderGitHubLoginButton();
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
