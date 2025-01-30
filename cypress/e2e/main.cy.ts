import { OAuthToken } from "../../static/scripts/onboarding/github-oauth";

describe("Homepage tests", () => {
  const ORG_NAME = "ubiquity";
  const SUPABASE_AUTH_KEY = "sb-wfzpewmlyiozupulbuur-auth-token";
  let loginToken: OAuthToken;
  const beVisible = "be.visible";

  beforeEach(() => {
    // Catch uncaught exceptions
    Cypress.on("uncaught:exception", (err) => {
      cy.log(`Uncaught exception: ${err.message}`);
      return false;
    });

    // Add spy for all PUT requests to GitHub API
    cy.intercept("PUT", "https://api.github.com/**", (req) => {
      console.log(`[DEBUG] Intercepted PUT request to: ${req.url}`);
      console.log(`[DEBUG] Request headers: ${JSON.stringify(req.headers)}`);
      console.log(`[DEBUG] Request body: ${JSON.stringify(req.body)}`);
      req.on("response", (res) => {
        console.log(`[DEBUG] Response status: ${res.statusCode}`);
        console.log(`[DEBUG] Response headers: ${JSON.stringify(res.headers)}`);
        if (res.statusCode >= 400) {
          console.log(`[DEBUG] Request failed with status ${res.statusCode}`);
        }
      });
    }).as("githubPutSpy");

    // Add specific debug intercept for config file
    cy.intercept("PUT", "**/contents/.github**", (req) => {
      console.log(`[DEBUG] Config file PUT request detected`);
      console.log(`[DEBUG] URL: ${req.url}`);
      console.log(`[DEBUG] Method: ${req.method}`);
      console.log(`[DEBUG] Headers: ${JSON.stringify(req.headers)}`);
    }).as("configFilePut");

    cy.intercept("GET", `https://api.github.com/users/${ORG_NAME}`, {
      fixture: "get-user.json",
    }).as("githubGetUser");

    cy.intercept("GET", `https://api.github.com/repos/${ORG_NAME}/.ubiquity-os`, {
      fixture: "get-ubiquibot-config.json",
    }).as("githubGetUbiquibotConfig");

    cy.intercept("GET", `https://api.github.com/orgs/${ORG_NAME}/repos`, {
      fixture: "get-repos.json",
    }).as("githubGetRepos");

    cy.intercept("GET", "**/orgs/*/installations**", {
      fixture: "get-installations.json",
      delay: 100, // Small delay to ensure stable order
    }).as("githubGetInstallations");

    cy.intercept("GET", `https://api.github.com/user/installations/47252474/repositories`, {
      fixture: "get-installation-repositories.json",
    }).as("githubGetInstallationRepositories");

    cy.intercept("PUT", `https://api.github.com/user/installations/47252474/repositories/641336624`, {
      fixture: "put-file.json",
    }).as("githubPutInstallation");

    cy.intercept("PUT", `https://api.github.com/repos/${ORG_NAME}/.ubiquity-os/contents/.github%2F.ubiquity-os.config.yml`, {
      fixture: "put-file.json",
      statusCode: 201,
    }).as("githubPutConfigFile");

    cy.intercept("GET", `https://api.github.com/user/orgs**`, {
      fixture: "get-orgs.json",
    }).as("githubGetUserOrgs");

    cy.intercept("GET", `https://api.github.com/search/repositories**`, {
      fixture: "get-search.json",
    }).as("githubSearch");

    cy.intercept("PUT", `https://api.github.com/repos/${ORG_NAME}/.ubiquity-os/contents/.github**`, {
      fixture: "put-config.json",
    }).as("githubPutContents");

    cy.fixture("user-token.json").then((content) => {
      loginToken = content;
    });
  });

  it("Console is cleared of errors and warnings", () => {
    cy.visit("/", {
      onBeforeLoad(win) {
        cy.stub(win.console, "error").as("consoleError");
      },
    });
    cy.get("@consoleError").should("not.be.called");
    cy.get("body").should("exist");
  });

  it.only("Create onboarding repository", () => {
    cy.visit("/", {
      onBeforeLoad(win) {
        cy.stub(win.console, "error").as("consoleError");
        cy.stub(win.console, "warn").as("consoleWarn");
      },
    });
    cy.intercept("https://github.com/login/oauth/authorize**", (req) => {
      req.reply({
        statusCode: 200,
      });
      // Simulate login token
      window.localStorage.setItem(SUPABASE_AUTH_KEY, JSON.stringify(loginToken));
    }).as("githubLogin");
    cy.log("Clicking GitHub login button");
    cy.get("#github-login-button").should(beVisible).click();
    cy.log("Simulated OAuth login completed");
    cy.visit("/");
    cy.log("Waiting for user orgs");
    cy.wait("@githubGetUserOrgs").its("response.body").as("orgLogins");
    cy.log("Display warning on empty WALLET_PRIVATE_KEY");
    cy.get("#walletPrivateKey").parent().find(".status-log").should("exist");
    cy.get("#walletPrivateKey").type("deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
    cy.log("Checking if organization dropdown is ready");
    // Handle organization dropdown and select organization
    cy.get("#orgName", { timeout: 10000 }).should("not.be.disabled").and("have.length.gt", 0).select("ubiquity", { force: true });

    // Click the button to trigger API calls
    cy.get("#setBtn").click();

    // Check for errors after click
    cy.get(".error", { timeout: 1000 });

    // Check console logs
    cy.get("@consoleError");
    cy.get("@consoleWarn");

    cy.log("Waiting for API calls to complete");

    // Wait for installations and validate
    cy.wait("@githubGetInstallations", { timeout: 10000 })
      .its("response.body.installations")
      .should((installations: Array<{ app_id: number }> = []) => {
        expect(installations.some((inst) => inst.app_id === 975031)).to.be.true;
      });

    // Wait for content updates
    cy.wait("@githubPutContents", { timeout: 10000 });
    cy.wait("@githubPutConfigFile", { timeout: 10000 });
    cy.log("Waiting for outKey to be populated");
    cy.log("Checking outKey value");
    cy.get("#outKey", { timeout: 10000 }).should(beVisible).should("not.be.empty");
    cy.log("Expected to be at step 2 of the form");
    cy.get("#step2").should("not.have.class", "hidden");
  });
});
