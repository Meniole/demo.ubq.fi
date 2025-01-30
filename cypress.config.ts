import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    setupNodeEvents(onEvent) {},
    experimentalStudio: true,
    baseUrl: "http://localhost:8080",
    watchForFileChanges: false,
  },
});
