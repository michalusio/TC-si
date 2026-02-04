const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig([
  {
    label: 'unitTests',
    files: 'dist-test/test.js',
    version: '1.107.0',
    workspaceFolder: './tests',
    mocha: {
      ui: 'tdd',
      timeout: 10000,
      parallel: false
    },
    launchArgs: [
      "--disable-extensions",
      "--sync off"
    ]
  }
]);