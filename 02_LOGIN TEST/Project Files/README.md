# QA Automation Assessment: Task 2 (Login)

Eight login scenarios (TC-LOGIN-01 to TC-LOGIN-08), written as manual test cases **and** as Gherkin (`features/login.feature`), automated with **Playwright + playwright-bdd** using the **Page Object Model**.

- **Site under test:** https://practicetestautomation.com/practice-test-login/
- **Credentials:** `student` / `Password123` (public demo credentials published on the page)

> **Primary automated scenario:** the task asks for one scenario to be automated. That scenario is **TC-LOGIN-01: Successful login with valid credentials** (tagged `@primary @smoke`). TC-LOGIN-02 to TC-LOGIN-08 are additional coverage that reuses the same steps and page objects.

A full workflow write-up (problem, approach, code structure, how to run, results) is in `WORKFLOW.html`.

## Project structure

```
Project Files/
├── features/
│   └── login.feature        # Gherkin test cases: 8 scenarios, tagged by ID
├── steps/
│   ├── fixtures.js          # page objects exposed as Playwright fixtures; createBdd()
│   └── login.steps.js       # step definitions: Gherkin sentence -> page-object call
├── pages/
│   ├── LoginPage.js         # login form: locators, goto(), login(), expectError(), expectOnLoginPage()
│   └── LoggedInPage.js      # success page: expectLoaded(), logout()
├── playwright.config.js     # defineBddConfig + Playwright settings and reporters
├── package.json             # @playwright/test 1.65.0, playwright-bdd 9.2.1, npm scripts
├── package-lock.json
├── MANUAL_TEST_CASE.md      # manual test cases + execution record
├── WORKFLOW.html            # end-to-end workflow document (open in a browser)
└── .vscode/settings.json    # tells the Cucumber VS Code extension where steps live
```

Generated on each run (git-ignored): `.features-gen/`, `test-results/`, `playwright-report/`, `cucumber-report/`.

## How it fits together

1. `features/login.feature` describes behaviour in Given / When / Then.
2. `bddgen` matches each step to a definition in `steps/` and generates Playwright test files into `.features-gen/`.
3. `playwright test` runs the generated tests. Steps receive `loginPage` / `loggedInPage` as fixtures and call page-object methods only.

## Test coverage

| ID | Scenario | Tags |
|---|---|---|
| TC-LOGIN-01 | Successful login with valid credentials | `@primary @smoke @positive` |
| TC-LOGIN-02 | Valid username, incorrect password | `@negative` (Scenario Outline) |
| TC-LOGIN-03 | Both fields blank | `@negative` (Scenario Outline) |
| TC-LOGIN-04 | Invalid username, valid password | `@negative` (Scenario Outline) |
| TC-LOGIN-05 | Valid username, blank password | `@negative` (Scenario Outline) |
| TC-LOGIN-06 | Password field masks the typed value | `@security` |
| TC-LOGIN-07 | Log out returns to the login page | `@positive` |
| TC-LOGIN-08 | Valid login after a failed attempt | `@recovery` |

Every scenario also carries its own `@TC-LOGIN-0x` tag and the feature-level `@login` tag.

## Prerequisites

- Node.js 20 or later and npm (required by both Playwright 1.62+ and playwright-bdd 9)
- Internet access to `practicetestautomation.com`

## Install

```bash
npm ci
npx playwright install chromium
```

On a fresh Linux machine or CI image: `npx playwright install --with-deps chromium`.

## Run

```bash
npm test                                   # bddgen + all 8 scenarios, headless Chromium
npm run test:smoke                         # only @smoke (TC-LOGIN-01)
npx bddgen --tags "@TC-LOGIN-02" && npx playwright test   # one scenario by tag
npx bddgen --tags "@negative" && npx playwright test      # a group by tag
npm run test:headed                        # watch the browser
npm run report                             # open the Playwright HTML report
```

`bddgen` must run before `playwright test` whenever a `.feature` or step file changes; the npm scripts do this for you.

## Reports

- **Console:** one line per scenario (`list` reporter).
- **`playwright-report/index.html`:** Playwright HTML report with each Gherkin step shown as a test step.
- **`cucumber-report/index.html`:** Cucumber-style HTML report of features, scenarios and steps.
- **`test-results/`:** trace and screenshot for failed scenarios only (`npx playwright show-trace <file>.zip`).

## Design notes

- **Gherkin is the single source of truth.** Scenario text and test data (including the expected error messages) live in the feature file. The four rejected-login cases share one Scenario Outline with one tagged `Examples` block each, so every row can be run alone.
- **Page Object Model:** step definitions never touch selectors. Locators are defined once in `pages/`, so a UI change is fixed in one file.
- **Fixtures, not globals:** page objects are Playwright fixtures (`steps/fixtures.js`), so each scenario gets fresh instances bound to its own browser context. Scenarios are independent and run in parallel.
- **Reusable, declarative steps:** one parameterised step (`I log in with username {string} and password {string}`) drives seven scenarios. `Given` steps set up state and assert it (`I have logged in…`, `I have failed to log in…`); `Then` steps only assert.
- **Locators** are user-facing: `getByLabel`, `getByRole`. The error banner has no accessible role, so it uses its stable `#error` id.
- **Hidden-error trap:** `#error` is always in the page and already says "Your username is invalid!" before Submit, hidden with `opacity: 0`. `toBeVisible()` ignores opacity, so the page object waits for the `show` class first, then checks the exact text.
- **Assertions retry; no sleeps.** `toHaveURL`, `toBeVisible`, `toHaveClass`, `toHaveText`, `toHaveAttribute`. No `waitForTimeout`.
- Traces and screenshots are kept only for failed runs. `forbidOnly` and one retry apply when `CI` is set.

## Verification performed

On 2026-11-14 the suite was run with Node 22.23.5, `@playwright/test` 1.65.0, `playwright-bdd` 9.2.1 and Chromium 158.0.8127.18 (headless, Windows 11), from a clean `npm ci` against the live site: **8 passed (11.1s)**, 4 workers, no retries. Also checked:

- `npx bddgen --tags "@TC-LOGIN-02"` selected exactly that one scenario (1 passed).
- Changing the expected message for TC-LOGIN-05 to a wrong value made it fail with `Expected: "WRONG MESSAGE"` / `Received: "Your password is invalid!"`, confirming the assertions catch real differences.
