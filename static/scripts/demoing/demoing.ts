import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";
import { Octokit } from "@octokit/rest";
import YAML from "yaml";
//@ts-expect-error This is taken care of by es-build
import defaultConf from "../../types/default-configuration.yml";
import { getSessionToken, renderGitHubLoginButton } from "./github-login-button";

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

async function populateOrgs() {
  if (getSessionToken()) {
    const pluginKit = Octokit.plugin(createOrUpdateTextFile);
    const octokit = new pluginKit({ auth: getSessionToken() });
    const { data } = await octokit.rest.orgs.listForAuthenticatedUser({ per_page: 100 });
    const selectContainer = document.getElementById("orgName");
    if (selectContainer) {
      selectContainer.innerHTML = "";
      if (data.length) {
        selectContainer.removeAttribute("disabled");
        for (const repo of data) {
          const optionElem = document.createElement("option");
          optionElem.value = repo.login;
          optionElem.innerText = repo.login;
          selectContainer.appendChild(optionElem);
        }
      }
    }
  }
}

async function init() {
  if (defaultConf !== undefined) {
    try {
      setInputListeners();
      await renderGitHubLoginButton();
      await populateOrgs();
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
