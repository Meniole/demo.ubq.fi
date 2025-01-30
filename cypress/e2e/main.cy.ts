import { OAuthToken } from "../../static/scripts/onboarding/github-oauth";

describe("Homepage tests", () => {
  const ORG_NAME = "Ubiquity";
  const SUPABASE_AUTH_KEY = "sb-wfzpewmlyiozupulbuur-auth-token";
  let loginToken: OAuthToken;
  const beVisible = "be.visible";

  beforeEach(() => {
    cy.fixture("get-user.json").then((file) => {
      cy.intercept("GET", `https://api.github.com/users/${ORG_NAME}`, (req) => {
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
    cy.fixture("get-installations.json").then((file) => {
      cy.intercept("GET", `https://api.github.com/orgs/${ORG_NAME}/installations**`, (req) => {
        req.reply(file);
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
        req.reply(file);
      }).as("githubPutConfigFile");
    });
    cy.fixture("get-orgs.json").then((file) => {
      cy.intercept("GET", `https://api.github.com/user/orgs**`, (req) => {
        req.reply(file);
      }).as("githubGetUserOrgs");
    });
    cy.fixture("get-org-installations.json").then((file) => {
      cy.intercept("GET", `https://api.github.com/orgs/${ORG_NAME.toLowerCase()}/installations**`, (req) => {
        req.reply(file);
      }).as("githubGetOrgInstallations");
    });
    cy.fixture("get-search.json").then((file) => {
      cy.intercept("GET", `https://api.github.com/search/repositories**`, (req) => {
        req.reply(file);
      }).as("githubSearch");
    });
    cy.fixture("put-config.json").then((file) => {
      cy.intercept("PUT", `https://api.github.com/repos/${ORG_NAME.toLowerCase()}/.ubiquity-os/contents/.github**`, (req) => {
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
    cy.visit("/");
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
      .and(($select) => {
        cy.get("@orgLogins").then((orgLogins) => {
          const options = $select.find("option");
          const optionValues = options
            .toArray()
            .map((opt) => (opt as HTMLOptionElement).value)
            .filter(Boolean);
          cy.log(`Available options: ${optionValues.join(", ")}`);
          expect(optionValues).to.include("ubiquity");
          expect(optionValues.length).to.equal(orgLogins.length);
        });
      })
      .scrollIntoView()
      .select("ubiquity", { force: true });
    cy.get("#setBtn").should(beVisible).click();
    cy.log("Waiting for API calls to complete");
    cy.wait("@githubPutContents").then((interception) => {
      cy.log(`githubPutContents response: ${JSON.stringify(interception.response?.body)}`);
    });
    cy.wait("@githubPutConfigFile").then((interception) => {
      cy.log(`githubPutConfigFile response: ${JSON.stringify(interception.response?.body)}`);
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
