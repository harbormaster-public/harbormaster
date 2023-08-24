import { setup } from 'meteor/universe:e2e';

const maybe_run_headless = function () {
  let should_be = process.env.HEADLESS || true;

  if (
    should_be === 0 ||
    should_be === '0' ||
    should_be === false ||
    should_be === 'false'
  ) should_be = false;

  console.log(`Should run in headless mode? ${should_be}`);
  return should_be;
};

const width = 1024;
const height = 768;

setup({
  mocha: {
    reporter: 'spec',
    exit: true,
    watch: false,
    retries: 3,
    timeout: 60000,
  },
  browser: {
    isCI: true,
    createDefaultBrowser: true,
    launchOptions: {
      headless: maybe_run_headless(),
      // ms to delay everything, 100 -> slow, 1000 -> very slow
      // Empirically, less than 50ms risks running too fast for the browser
      // Default is 10
      //slowMo: 50,
      slowMo: 200,
      devtools: false,
      dumpio: false,
      handleSIGHUP: true,
      handleSIGINT: true,
      handleSIGTERM: true,
      defaultViewport: {
        width,
        height,
      },
      args: [
        '--devtools-flags=disable',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--single-process',
        '--no-zygote',
        '--no-first-run',
        `--window-size=${width},${height}`,
        // '--start-maximized',
        // '--start-fullscreen',
        // '--start-maximized',
        '--window-position=0,0',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-skip-list',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--hide-scrollbars',
        '--disable-notifications',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-extensions',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--mute-audio',
      ],
    },
  },
}).catch(console.error);
