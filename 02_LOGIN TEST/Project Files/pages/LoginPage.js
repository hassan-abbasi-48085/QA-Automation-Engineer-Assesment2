// @ts-check
const { expect } = require('@playwright/test');

/** Page object for https://practicetestautomation.com/practice-test-login/ */
class LoginPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.path = '/practice-test-login/';

    // ---------- Locators ----------
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Submit' });
    // #error is always in the DOM (opacity 0); the site reveals it by adding the "show" class.
    this.errorMessage = page.locator('#error');
  }

  // ---------- Actions ----------

  /** Opens the login page and waits until the form is ready. */
  async goto() {
    await this.page.goto(this.path);
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Fills both fields (empty strings leave a field blank) and clicks Submit.
   * @param {string} username
   * @param {string} password
   */
  async login(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /** @param {string} password */
  async typePassword(password) {
    await this.passwordInput.fill(password);
  }

  // ---------- Assertions ----------

  /**
   * Waits for the error banner to be revealed, then checks its exact text.
   * @param {string} text
   */
  async expectError(text) {
    await this.expectAnyError();
    await expect(this.errorMessage).toHaveText(text);
  }

  /** Waits until the error banner is revealed, whatever its text. */
  async expectAnyError() {
    await expect(this.errorMessage).toHaveClass(/\bshow\b/);
  }

  /** The password input keeps type="password", so typed characters are masked. */
  async expectPasswordMasked() {
    await expect(this.passwordInput).toHaveAttribute('type', 'password');
  }

  /** @param {string} value */
  async expectPasswordValue(value) {
    await expect(this.passwordInput).toHaveValue(value);
  }

  async expectLoginFormShown() {
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async expectOnLoginPage() {
    await expect(this.page).toHaveURL(/\/practice-test-login\/?$/);
    await expect(this.submitButton).toBeVisible();
  }
}

module.exports = { LoginPage };
