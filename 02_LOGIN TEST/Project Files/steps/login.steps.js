// @ts-check
const { Given, When, Then } = require('./fixtures');

// Step definitions are thin: each one maps a Gherkin sentence to page-object
// method calls. They never use locators, selectors or expect() directly;
// all of that lives in pages/.

// ---------- Given ----------

Given('I open the login page', async ({ loginPage }) => {
  await loginPage.goto();
});

Given(
  'I have logged in with username {string} and password {string}',
  async ({ loginPage, loggedInPage }, username, password) => {
    await loginPage.login(username, password);
    await loggedInPage.expectLoaded(username);
  },
);

Given(
  'I have failed to log in with username {string} and password {string}',
  async ({ loginPage }, username, password) => {
    await loginPage.login(username, password);
    await loginPage.expectAnyError();
  },
);

// ---------- When ----------

When(
  'I log in with username {string} and password {string}',
  async ({ loginPage }, username, password) => {
    await loginPage.login(username, password);
  },
);

When('I type {string} into the password field', async ({ loginPage }, password) => {
  await loginPage.typePassword(password);
});

When('I log out', async ({ loggedInPage }) => {
  await loggedInPage.logout();
});

// ---------- Then ----------

Then('I am logged in as {string}', async ({ loggedInPage }, username) => {
  await loggedInPage.expectLoaded(username);
});

Then('I see the error message {string}', async ({ loginPage }, message) => {
  await loginPage.expectError(message);
});

Then('I am still on the login page', async ({ loginPage, loggedInPage }) => {
  await loginPage.expectOnLoginPage();
  await loggedInPage.expectNotLoggedIn();
});

Then('I am back on the login page with the login form shown', async ({ loginPage }) => {
  await loginPage.expectOnLoginPage();
  await loginPage.expectLoginFormShown();
});

Then('the password field is masked', async ({ loginPage }) => {
  await loginPage.expectPasswordMasked();
});

Then('the password field holds the value {string}', async ({ loginPage }, value) => {
  await loginPage.expectPasswordValue(value);
});
