// @ts-check
const { expect } = require('@playwright/test');

/** Page object for https://practicetestautomation.com/logged-in-successfully/ */
class LoggedInPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // ---------- Locators ----------
    this.heading = page.getByRole('heading', { name: 'Logged In Successfully' });
    this.logoutLink = page.getByRole('link', { name: 'Log out' });
  }

  /** @param {string} username */
  welcomeText(username) {
    return this.page.getByText(`Congratulations ${username}. You successfully logged in!`);
  }

  // ---------- Actions ----------

  async logout() {
    await this.logoutLink.click();
  }

  // ---------- Assertions ----------

  /**
   * Checks the success page: URL, heading, personalised welcome text and Log out link.
   * @param {string} username
   */
  async expectLoaded(username) {
    await expect(this.page).toHaveURL(/\/logged-in-successfully\/?$/);
    await expect(this.heading).toBeVisible();
    await expect(this.welcomeText(username)).toBeVisible();
    await expect(this.logoutLink).toBeVisible();
  }

  /** No signed-in session is shown: the Log out link is absent from the page. */
  async expectNotLoggedIn() {
    await expect(this.logoutLink).toHaveCount(0);
  }
}

module.exports = { LoggedInPage };
