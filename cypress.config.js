const { defineConfig } = require('cypress');
const { registerDbTasks } = require('./tests/cypress/plugins/db');

module.exports = defineConfig({
  e2e: {
    specPattern: 'tests/cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'tests/cypress/support/e2e.js',
    baseUrl: process.env.CYPRESS_BASE_URL ||
      process.env.ROOT_URL ||
      'http://localhost:4042',
    env: {
      // Make Mongo URL available to plugin tasks even if Cypress sanitizes
      // process.env.
      MONGO_URL: process.env.MONGO_URL || process.env.CYPRESS_MONGO_URL,
    },
    video: false,
    screenshotOnRunFailure: true,
    experimentalRunAllSpecs: true,
    setupNodeEvents (on, config) {
      const { snapshotIfEnabled, restoreIfEnabled } = registerDbTasks(
        on,
        config
      );

      // Preserve/restore the developer's local DB state across the entire e2e
      // run. This keeps the per-test `cy.resetDb()` isolation, but returns the
      // DB to its original state once Cypress finishes.
      on('before:run', async () => {
        await snapshotIfEnabled();
      });
      on('after:run', async () => {
        await restoreIfEnabled();
      });
      return config;
    },
  },
});


