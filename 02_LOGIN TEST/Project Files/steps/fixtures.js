// @ts-check
const { test: base, createBdd } = require('playwright-bdd');
const { LoginPage } = require('../pages/LoginPage');
const { LoggedInPage } = require('../pages/LoggedInPage');

/**
 * Page objects are provided as Playwright fixtures, so every scenario gets
 * fresh instances bound to its own browser page. Step definitions receive
 * them by name and never build page objects or locators themselves.
 *
 * @type {import('@playwright/test').TestType<
 *   import('@playwright/test').PlaywrightTestArgs & import('@playwright/test').PlaywrightTestOptions &
 *   { loginPage: LoginPage, loggedInPage: LoggedInPage },
 *   import('@playwright/test').PlaywrightWorkerArgs & import('@playwright/test').PlaywrightWorkerOptions>}
 */
const test = base.extend({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  loggedInPage: async ({ page }, use) => {
    await use(new LoggedInPage(page));
  },
});

const { Given, When, Then } = createBdd(test);

module.exports = { test, Given, When, Then };
