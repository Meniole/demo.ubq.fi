import { OAuthToken } from "../../static/scripts/onboarding/github-oauth";

describe("Homepage tests", () => {
  const ORG_NAME = "ubiquity";
  const SUPABASE_AUTH_KEY = "sb-wfzpewmlyiozupulbuur-auth-token";
  let loginToken: OAuthToken;
  const beVisible = "be.visible";

  beforeEach(() => {
    // Catch uncaught exceptions
    Cypress.on('uncaught:exception', (err, _runnable) => {
      cy.log(`Uncaught exception: ${err.message}`);
      return false;
    });

    // Add spy for all PUT requests to GitHub API
    cy.intercept("PUT", "https://api.github.com/**", (req) => {
      cy.log(`[DEBUG] Intercepted PUT request to: ${req.url}`);
      cy.log(`[DEBUG] Request headers: ${JSON.stringify(req.headers)}`);
      cy.log(`[DEBUG] Request body: ${JSON.stringify(req.body)}`);
      req.on('response', (res) => {
        cy.log(`[DEBUG] Response status: ${res.statusCode}`);
        cy.log(`[DEBUG] Response headers: ${JSON.stringify(res.headers)}`);
        if (res.statusCode >= 400) {
          cy.log(`[DEBUG] Request failed with status ${res.statusCode}`);
        }
      });
    }).as("githubPutSpy");

    // Add specific debug intercept for config file
    cy.intercept("PUT", "**/contents/.github**", (req) => {
      cy.log(`[DEBUG] Config file PUT request detected`);
      cy.log(`[DEBUG] URL: ${req.url}`);
      cy.log(`[DEBUG] Method: ${req.method}`);
      cy.log(`[DEBUG] Headers: ${JSON.stringify(req.headers)}`);
    }).as("configFilePut");

    cy.fixture("get-user.json").then((file) => {
      cy.intercept("GET", `https://api.github.com/users/${ORG_NAME}`, (req) => {
        cy.log(`Intercepted GET user request`);
        req.reply(file);
      }).as("githubGetUser");
    });
    cy.fixture("get-ubiquibot-config.json").then((file) => {
      cy.intercept("GET", `https://api.github.com/repos/${ORG_NAME}/.ubiquity-os`, (req) => {
        req.reply(file);
      }).as("githubGetUbiquibotConfig");
    });
    cy.fixture("get-repos.json").then((file) => {
      cy.intercept("GET", `https://api.github.com/orgs/${ORG_NAME}/repos`, (req) => {
        req.reply(file);
      }).as("githubGetRepos");
    });
    // Single intercept for installations with debug logging
    cy.fixture("get-installations.json").then((file) => {
      cy.intercept("GET", "**/orgs/*/installations**", (req) => {
        cy.log(`[DEBUG] Intercepted installations request`);
        cy.log(`[DEBUG] Request URL: ${req.url}`);
        cy.log(`[DEBUG] Request headers: ${JSON.stringify(req.headers)}`);
        req.reply({
          statusCode: 200,
          body: file,
          delay: 100 // Small delay to ensure stable order
        });
      }).as("githubGetInstallations");
    });
    cy.fixture("get-installation-repositories.json").then((file) => {
      cy.intercept("GET", `https://api.github.com/user/installations/47252474/repositories`, (req) => {
        req.reply(file);
      }).as("githubGetInstallationRepositories");
    });
    cy.fixture("put-file.json").then((file) => {
      cy.intercept("PUT", `https://api.github.com/user/installations/47252474/repositories/641336624`, (req) => {
        req.reply(file);
      }).as("githubPutInstallation");
    });
    cy.fixture("put-file.json").then((file) => {
      cy.intercept("PUT", `https://api.github.com/repos/${ORG_NAME}/.ubiquity-os/contents/.github%2F.ubiquity-os.config.yml`, (req) => {
        cy.log(`[DEBUG] Intercepted PUT config file request`);
        cy.log(`[DEBUG] Request URL: ${req.url}`);
        cy.log(`[DEBUG] Request headers: ${JSON.stringify(req.headers)}`);
        cy.log(`[DEBUG] Request body: ${JSON.stringify(req.body)}`);
        req.reply({
          statusCode: 201,
          body: file
        });
      }).as("githubPutConfigFile");
    });

    cy.fixture("get-orgs.json").then((file) => {
      cy.intercept("GET", `https://api.github.com/user/orgs**`, (req) => {
        req.reply(file);
      }).as("githubGetUserOrgs");
    });
    cy.fixture("get-search.json").then((file) => {
      cy.intercept("GET", `https://api.github.com/search/repositories**`, (req) => {
        req.reply(file);
      }).as("githubSearch");
    });
    cy.fixture("put-config.json").then((file) => {
      cy.intercept("PUT", `https://api.github.com/repos/${ORG_NAME}/.ubiquity-os/contents/.github**`, (req) => {
        req.reply(file);
      }).as("githubPutContents");
    });
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
      }
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
    cy.wait("@githubGetUserOrgs").then((interception) => {
      const orgs = interception.response?.body;
      cy.log(`User orgs response: ${JSON.stringify(orgs)}`);
      // Store orgs for later validation
      cy.wrap(orgs.map((org: { login: string }) => org.login)).as("orgLogins");
    });
    cy.get("#setBtn").click();
    cy.log("Display warning on empty WALLET_PRIVATE_KEY");
    cy.get("#walletPrivateKey").parent().find(".status-log").should("exist");
    cy.get("#walletPrivateKey").type("deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
    cy.log("Checking if organization dropdown is ready");
    cy.get("#orgName", { timeout: 10000 })
      .should("not.be.disabled")
      .and("have.length.gt", 0)
      .then(($select) => {
        cy.get("@orgLogins").then((orgLogins) => {
          const options = $select.find("option");
          const optionValues = options
            .toArray()
            .map((opt) => (opt as HTMLOptionElement).value)
            .filter(Boolean);
          cy.log(`Available options: ${optionValues.join(", ")}`);
          expect(optionValues).to.include("ubiquity");
          expect(optionValues.length).to.equal(orgLogins.length);
          cy.wrap($select).scrollIntoView().select("ubiquity", { force: true });
        });
      });
    // Log button state before click
    cy.get("#setBtn").should(beVisible).then($btn => {
      const btnText = $btn.text();
      const isDisabled = $btn.prop('disabled');
      const isVisible = $btn.is(':visible');
      cy.log(`[DEBUG] Button details - text: "${btnText}", disabled: ${isDisabled}, visible: ${isVisible}`);
    });

    // Click the button and handle subsequent actions
    cy.get("#setBtn").click();
    cy.log('[DEBUG] Button click executed');

    // Check for errors after click
    cy.get(".error", { timeout: 1000 }).then($errors => {
      if ($errors.length > 0) {
        cy.log(`[DEBUG] Found errors after click: ${$errors.text()}`);
      }
    });

    // Check console logs
    cy.get("@consoleError").then((spy: unknown) => {
      const typedSpy = spy as { args?: unknown[] };
      if (typedSpy.args && typedSpy.args.length > 0) {
        cy.log(`[DEBUG] Console errors after click: ${JSON.stringify(typedSpy.args)}`);
      }
    });

    cy.get("@consoleWarn").then((spy: unknown) => {
      const typedSpy = spy as { args?: unknown[] };
      if (typedSpy.args && typedSpy.args.length > 0) {
        cy.log(`[DEBUG] Console warnings after click: ${JSON.stringify(typedSpy.args)}`);
      }
    });
    cy.log("Waiting for API calls to complete");

    // Wait for installations first
    cy.log("Waiting for installations...");
    cy.wait("@githubGetInstallations", { timeout: 10000 }).then((interception) => {
      cy.log(`[DEBUG] Installations response: ${JSON.stringify(interception.response?.body)}`);
      const installations = interception.response?.body.installations || [];
      const hasValidInstallation = installations.some((inst: { app_id: number }) => inst.app_id === 975031);
      cy.log(`[DEBUG] Has valid installation: ${hasValidInstallation}`);
    });

    cy.log("Waiting for githubPutContents...");
    cy.wait("@githubPutContents", { timeout: 10000 }).then((interception) => {
      cy.log(`[DEBUG] PutContents response: ${JSON.stringify(interception.response?.body)}`);
    });

    cy.log("Waiting for githubPutConfigFile...");
    cy.wait("@githubPutConfigFile", { timeout: 10000 }).then((interception) => {
      cy.log(`[DEBUG] PutConfigFile response: ${JSON.stringify(interception.response?.body)}`);
    });
    cy.log("Waiting for outKey to be populated");
    cy.log("Checking outKey value");
    cy.get("#outKey", { timeout: 10000 })
      .should(beVisible)
      .then(($el) => {
        cy.log(`outKey value: ${$el.val()}`);
        expect($el.val(), "outKey should not be empty").to.not.be.empty;
      });
    cy.log("Expected to be at step 2 of the form");
    cy.get("#step2").should("not.have.class", "hidden");
  });
});
