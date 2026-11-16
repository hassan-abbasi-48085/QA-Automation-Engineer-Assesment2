import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'node-red/flows.json', 'reports/'] },
  js.configs.recommended,
  {
    files: ['test/**/*.js', 'features/**/*.js', 'cucumber.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.mocha },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // Node-RED userDir code runs as CommonJS.
    files: ['node-red/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node },
  },
];
