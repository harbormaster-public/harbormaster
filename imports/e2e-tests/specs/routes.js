import faker from 'faker';
import {cwd} from 'process';

var test_email = faker.internet.email();
var test_password = faker.internet.password();

import {
  describe,
  it,
  beforeEach,
  // puppeteer
  // browser,
  // page
} from '../helpers';
import puppeteer from 'puppeteer';

describe('Routing', function () {
  beforeEach(async function () {
    var fresh;
    var existing;
    const browser = await puppeteer.launch({
      headless: false
    });
    const page = await browser.newPage();
    // // browser.url('http://localhost:3000');
    // // await browser.url(Meteor.absoluteUrl());
    await page.goto(Meteor.absoluteUrl());
    // // await browser.waitForExist('h1', 1000);
    let header = await page.waitForSelector('h1');
    let tag = await page.$eval('h1', h1 => h1.tagName);
    let error_date = 'error-' + Date.now();
    let shot = await page.screenshot({
      // path: `${cwd()}/${error_date}`,
      path: 'test.png',
      type: 'png',
      encoding: 'binary'
    });
    expect(header).to.be.visible;
    console.log('Error in before hook.  Saving screenshot:', error_date)

    // return true

    // try {
    //   await page.waitForSelector('.logout', {timeout: 1000});
    //   await page.click('.logout');
    // } catch (err) {
    //   console.log('No login-state detected.');
    // }

    // try {
    //   await page.waitForSelector('#new-instance', 1000);
    //   fresh = await page.$('#new-instance');
    // } catch (err) {
    //   console.log('Existing instance detected.');
    //   fresh = false;
    // }

    // try {
    //   await page.waitForSelector('#login-buttons');
    //   existing = await page.$('#login-buttons');
    // } catch (err) {
    //   console.log('New instance detected.');
    //   existing = false;
    // }

    // if (fresh && ! existing) {
    //   console.log('Fresh instance detected with no existing account.');
    //   // browser.setValue('.email-user-invite', test_email);
    //   await page.type('.email-user-invite', test_email);
    //   await page.click('.initial-sign-in');

    //   server.execute(function (email, password) {
    //     let user = Accounts.findUserByEmail(email);
    //     Accounts.setPassword(user._id, password);
    //   }, test_email, test_password);

    //   await page.click('#login-sign-in-link');
    //   await page.waitForSelector('#login-email', 2000);
    //   await page.type('#login-email', test_email);
    //   await page.type('#login-password', test_password);
    //   await page.click('#login-buttons-password');

    //   await page.waitForSelector('.acknowledge-new-harbormaster', 1000);
    //   await page.click('.acknowledge-new-harbormaster');

    // } else if (existing) {
    //   console.log('Existing accounts detected.  Attempting to login.');
    //   await page.click('#login-sign-in-link');
    //   await page.waitForSelector('#login-email', 2000);
    //   await page.type('#login-email', test_email);
    //   await page.type('#login-password', test_password);
    //   await page.click('#login-buttons-password');
    // } else {
    //   let error_date = 'error-' + new Date();
    //   console.log('Error in before hook.  Saving screenshot:', error_date)
    //   page.screenshot({path: `${cwd()}/${error_date}`});
    //   throw new Error('No existing or fresh login!');
    // }

    // await page.waitForSelector('#last-time-shipped-header', 1000);

  });

  describe('/', function () {
    it('should load', async function () {
      // await browser.url('http://localhost:3000');
      // expect(browser.getUrl()).to.equal('http://localhost:3000/');
      expect(false).to.be.true;
    });
  });

  describe('/lanes', function () {
    it('should load', function () {
      browser.url('http://localhost:3000/lanes');
      expect(browser.getUrl()).to.equal('http://localhost:3000/lanes');
    });
  });

  describe('/lanes/:slug/edit', function () {
    it('should load for "new" and any given name', function () {
      var new_lane_url = 'http://localhost:3000/lanes/new/edit';
      var random_lane_url = 'http://localhost:3000/lanes/' +
        faker.lorem.word() +
        '/edit';
      browser.url(new_lane_url);
      expect(browser.getUrl()).to.equal(new_lane_url);
      browser.url(random_lane_url);
      expect(browser.getUrl()).to.equal(random_lane_url);
    });
  });

  describe('/lanes/:slug/ship', function () {
    it('should load', function () {
      var random_lane_url = 'http://localhost:3000/lanes/' +
        faker.lorem.word() +
        '/ship';
      browser.url(random_lane_url);
      expect(browser.getUrl()).to.equal(random_lane_url);
    });
  });

  describe('/lanes/:slug/ship/:date', function () {
    it('should load', function () {
      var date = new Date();
      var random_shipped_lane_url = 'http://localhost:3000/lanes/' +
        faker.lorem.word() +
        '/ship/' +
        date.getMonth() + '-' +
        date.getDate() + '-' +
        date.getHours() + '-' +
        date.getMinutes() + '-' +
        date.getSeconds()
      ;
      browser.url(random_shipped_lane_url);
      expect(browser.getUrl()).to.equal(random_shipped_lane_url);
    });
  });

  describe('/lanes//ship', function () {
    it('should redirect to /lanes', function () {
      browser.url('http://localhost:3000/lanes//ship');
      expect(browser.getUrl()).to.equal('http://localhost:3000/lanes');
    });
  });

  describe('/users', function () {
    it('should load', function () {
      browser.url('http://localhost:3000/users');
      expect(browser.getUrl()).to.equal('http://localhost:3000/users');
    });
  });

  describe('/users/add-user', function () {
    it('should load', function () {
      browser.url('http://localhost:3000/users/add-user');
      expect(browser.getUrl()).to.equal('http://localhost:3000/users/add-user');
    });
  });

  describe('/profile', function () {
    it('should load', function () {
      browser.url('http://localhost:3000/profile');
      expect(browser.getUrl()).to.equal('http://localhost:3000/profile');
    });
  });

  describe('/profile/:user_id', function () {
    it('should load', function () {
      var test_user_profile_url = 'http://localhost:3000/profile/' + test_email;
      browser.url(test_user_profile_url);
      expect(browser.getUrl()).to.equal(test_user_profile_url);
    });
  });

  afterEach(function () {
    if (this.currentTest.state != 'passed') {
      browser.saveScreenshot(
        'screenshots/' +
        this.currentTest.fullTitle().replace(/ /g, '_').replace(/\//g, '-') +
        '.png'
      );
    }
  });
});
