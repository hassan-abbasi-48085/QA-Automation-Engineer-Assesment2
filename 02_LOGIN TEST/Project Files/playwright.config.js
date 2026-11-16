// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const { defineBddConfig, cucumberReporter } = require('playwright-bdd');

// bddgen reads the Gherkin features and step definitions and generates
// Playwright test files into .features-gen/, which Playwright then runs.
const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.js',
});

module.exports = defineConfig({
  testDir,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    cucumberReporter('html', { outputFile: 'cucumber-report/index.html' }),
  ],
  use: {
    baseURL: 'https://practicetestautomation.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
