// Cucumber configuration: runs the Gherkin features in features/ against the live stack.
// @manual scenarios are documentation for hand execution and are excluded here.
// Extra --tags on the command line are AND-ed with this expression.
export default {
  paths: ['features/**/*.feature'],
  import: ['features/support/**/*.js', 'features/step_definitions/**/*.js'],
  tags: 'not @manual',
  format: ['@cucumber/pretty-formatter', 'html:reports/cucumber-report.html', 'json:reports/cucumber-report.json'],
  formatOptions: { snippetInterface: 'async-await' },
  strict: true,
};
