import {
  describe,
  after,
  browser,
} from './helpers';
import './setup';

describe('E2E User Journeys', () => {

  require('./specs/routes');
  require('./specs/charters');

  after(async () => {
    await browser.close();
    // Something in the websocket connections (looks like maybe devtools?)
    // doesn't seem to be cleaning up properly, and the process
    // seems to hang when the tests complete, pass or fail.  For now,
    // We'll just bail if we wait for longer than 5s after the tests are run.
    setTimeout(() => {
      console.log(`Test run complete with code ${process.exitCode}.`);
      process.exit(process.exitCode);
    }, 5000);
  });
});
