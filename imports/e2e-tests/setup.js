import {setup} from 'meteor/universe:e2e';

setup({
  mocha: {
    reporter: 'spec'
  },
  browser: {
    isCI: false,
    createDefaultBrowser: false,
    launchOptions: {
      slowMo: 10,
      headless: false,
      devtools: true,
      dumpio: true,
      args: [
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36'
      ]
    }
  }
}).catch(console.error);