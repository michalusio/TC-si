const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig([
  {
    label: 'unitTests',
    files: 'dist-test/test.js',
    version: 'insiders',
    useInstallation: {
      fromMachine: true
    },
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