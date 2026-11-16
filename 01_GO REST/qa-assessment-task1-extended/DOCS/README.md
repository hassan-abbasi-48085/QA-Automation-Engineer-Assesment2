# GoREST Users API tests (Gherkin + Cucumber)

Automated API tests for the GoREST users endpoint (`https://gorest.co.in/public/v2/users`). Every test case is a Gherkin scenario in `features/`, and Cucumber.js runs them.

## What's covered (14 scenarios)

| Feature file | Scenarios |
|---|---|
| `features/01-create-and-get.feature` | **Task 1:** POST a user (201, capture ID), then GET it by that ID (200, keys and values match). |
| `features/02-authentication.feature` | POST with no token returns 401. POST with an invalid token returns 401. |
| `features/03-validation.feature` | POST returns 422 with an error for the right field for: duplicate email, invalid email, invalid gender, invalid status (one Scenario Outline covers the three invalid values), and an empty body. |
| `features/04-lifecycle.feature` | GET returns JSON with exactly `id, name, email, gender, status`. PATCH updates name and status, and GET shows the new values. DELETE returns 204, after which GET and a second DELETE both return 404. |
| `features/05-credentials.feature` | A missing or whitespace-only token fails fast with a clear message and no request is sent (offline). |

## Project layout

```
features/
  *.feature                       Gherkin test cases
  step_definitions/users.steps.js Given/When/Then code with Chai assertions
  support/gorest.js               API client and test-data helpers
  support/world.js                per-scenario state, timeout, After cleanup hook
cucumber.js                       Cucumber configuration and report formats
reports/                          HTML and JSON reports (generated, git-ignored)
```

Every user created in a scenario is tracked and deleted in the `After` hook, including any user the API accepts by mistake in a negative test. If the scenario already failed and cleanup also fails, cleanup only prints a warning so the original failure stays the reported cause. If the scenario passed but cleanup fails, the scenario fails.

The token is read only from `GOREST_TOKEN`. Failure messages include the response status and body, never request headers. Scenarios tagged `@requires-token` fail at their Background step with this message if the token is missing:

```
Error: Missing credentials: the GOREST_TOKEN environment variable is not set. ...
```

## Requirements

- Node.js 18 or newer (Node 20+ avoids the "Fetch API is experimental" warning)
- A GoREST access token from https://gorest.co.in/consumer/login

## Run: PowerShell (Windows)

```powershell
npm install
$env:GOREST_TOKEN = "<your-gorest-token>"
npm test
Remove-Item Env:GOREST_TOKEN
```

To keep the token out of history (PowerShell 7.1+): `$env:GOREST_TOKEN = Read-Host "GoREST token" -MaskInput`

## Run: Bash (macOS / Linux / Git Bash)

```bash
npm install
read -rsp "GoREST token: " GOREST_TOKEN && echo && export GOREST_TOKEN
npm test
unset GOREST_TOKEN
```

## Other commands

| Command | Runs |
|---|---|
| `npm run test:task1` | Only the Task 1 scenarios (`@task1`) |
| `npm run test:no-token` | Only scenarios that need no token |
| `npx cucumber-js features/03-validation.feature` | One feature file |
| `npx cucumber-js --dry-run` | Checks every step has a definition, without sending requests |

## Reports and exit code

Each run prints a readable report to the console and writes `reports/cucumber-report.html` and `reports/cucumber-report.json`. With a valid token the expected summary is:

```
14 scenarios (14 passed)
100 steps (100 passed)
```

The exit code is 0 only when every scenario passes.

Note: `@cucumber/messages` is pinned to 27.2.0 so the suite runs on Node 18. Newer versions of that package are ESM-only and cannot be loaded there.
