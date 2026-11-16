'use strict';

// Cucumber configuration: run every .feature file, load support + steps,
// print a readable console report and write HTML/JSON reports to reports/.
module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    require: ['features/support/**/*.js', 'features/step_definitions/**/*.js'],
    format: [
      '@cucumber/pretty-formatter',
      'html:reports/cucumber-report.html',
      'json:reports/cucumber-report.json',
    ],
    formatOptions: { snippetInterface: 'async-await' },
  },
};
