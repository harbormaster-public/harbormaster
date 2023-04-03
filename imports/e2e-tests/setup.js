import {setup} from 'meteor/universe:e2e';

function maybe_run_headless () {
  let should_be = process.env.HEADLESS || true;
  if (
    should_be === 0 ||
    should_be === '0' ||
    should_be === false ||
    should_be === 'false'
    ) should_be = false;
    
  console.log(`Should run in headless mode? ${should_be}`);
  return should_be;
}

setup({
  mocha: {
    reporter: 'spec',
    exit: true,
    watch: false,
  },
  browser: {
    isCI: true,
    createDefaultBrowser: true,
    launchOptions: {
      headless: maybe_run_headless(),
      slowMo: 10,
      devtools: false,
      dumpio: false,
      handleSIGHUP: true,
      handleSIGINT: true,
      handleSIGTERM: true,
      args: [
        '--devtools-flags=disable',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--single-process',
        '--no-zygote',
        '--no-first-run',
        `--window-size=${1280},${800}`,
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
        '--mute-audio'
      ]
    }
  }
}).catch(console.error);