import './setup';
import {
  after,
  afterEach,
  browser,
  screenshot,
} from './helpers';

describe('E2E Tests', async () => {

  after(async () => {
    await browser.close();
    // Something doesn't seem to be cleaning up properly, and the process
    // seems to hang when the tests complete, pass or fail.  For now,
    // We'll just bail if we wait for longer than 5s after the tests are run.
    setTimeout(() => {
      console.log(`Test run complete, exiting.`);
      process.exit();
    }, 5000);
  });

  afterEach(async function () {
    const { state, title } = this.currentTest;
    // Ensure to fail the whole run if any of the tests fail.
    if (state == 'failed') {
      const error_date = 'error-' + Date.now();
      await screenshot(error_date, title);
      process.exitCode = 1;
    }
  });

  require('./specs/routes');
  require('./specs/charters');
  require('./specs/harbors');
  require('./specs/lanes');
  require('./specs/profile');
  require('./specs/users');

});
