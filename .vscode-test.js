const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig([
  {
    label: 'unitTests',
    files: 'dist-test/test.js',
    version: 'insiders',
    workspaceFolder: './tests',
    mocha: {
      ui: 'tdd',
      timeout: 20000,
    },
    launchArgs: [
      "--disable-extensions"
    ]
  }
]);