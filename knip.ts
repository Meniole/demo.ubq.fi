import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["static/scripts/demoing/demoing.ts"],
  project: ["static/**/*.ts"],
  ignoreExportsUsedInFile: true,
  ignoreDependencies: ["eslint-config-prettier", "eslint-plugin-prettier", "@octokit/core"],
};

export default config;
