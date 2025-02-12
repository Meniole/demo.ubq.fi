# `@ubiquity/demo.ubq.fi`

Generates the configuration for organizations, by creating a default configuration and creating a repository under the
given Organization.

## Requirements

Copy the `env.example` to `.env` and fill the required variables.

## Run

```shell
yarn start
```

Should make the front-end page available at [http://localhost:8080](http://localhost:8080).

### Required fields

- `CHAIN_ID`: the id of the network you want to use for the transactions
- `WALLET_PRIVATE_KEY`: the [64 digits](https://www.browserling.com/tools/random-hex) crypto wallet key that will be used for transactions
- `GITHUB_PAT`: a [GitHub Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic)
- `ORG_NAME`: the name of the [organization](https://github.com/settings/organizations) where you want to add the bot

## Testing

To test with Cypress Studio UI, run

```shell
yarn cy:open
```

Otherwise to simply run the tests through the console, run

```shell
yarn cy:run
```

To test in a real-world scenario, you will need to create an Organization under your GitHub account, and use it as a
dummy. If the operation is successful, you will see a new repository appear with the Ubiquibot configuration.
