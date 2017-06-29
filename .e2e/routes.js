import faker from 'faker';

var test_email = faker.internet.email();
var test_password = faker.internet.password();

describe('Routing', function () {
  beforeEach(function () {
    var fresh;
    var existing;

    browser.url('http://localhost:3000');
    browser.waitForExist('h1', 1000);

    try {
      browser.waitForExist('.logout', 1000);
      browser.click('.logout');
    } catch (err) {
      console.log('No login-state detected.');
    }

    try {
      browser.waitForExist('#new-instance', 1000);
      fresh = browser.element('#new-instance');
    } catch (err) {
      console.log('Existing instance detected.');
      fresh = false;
    }

    try {
      browser.waitForExist('#login-buttons');
      existing = browser.element('#login-buttons');
    } catch (err) {
      console.log('New instance detected.');
      existing = false;
    }

    if (fresh && ! existing) {
      console.log('Fresh instance detected with no existing account.');
      browser.setValue('.email-user-invite', test_email);
      browser.click('.initial-sign-in');

      server.execute(function (email, password) {
        let user = Accounts.findUserByEmail(email);
        Accounts.setPassword(user._id, password);
      }, test_email, test_password);

      browser.click('#login-sign-in-link');
      browser.waitForExist('#login-email', 2000);
      browser.setValue('#login-email', test_email);
      browser.setValue('#login-password', test_password);
      browser.click('#login-buttons-password');

      browser.waitForExist('.acknowledge-new-harbormaster', 1000);
      browser.click('.acknowledge-new-harbormaster');

    } else if (existing) {
      console.log('Existing accounts detected.  Attempting to login.');
      browser.click('#login-sign-in-link');
      browser.waitForExist('#login-email', 2000);
      browser.setValue('#login-email', test_email);
      browser.setValue('#login-password', test_password);
      browser.click('#login-buttons-password');
    } else {
      let error_date = 'error-' + new Date();
      console.log('Error in before hook.  Saving screenshot:', error_date)
      browser.saveScreenshot(error_date);
      throw new Error('No existing or fresh login!');
    }

    browser.waitForExist('#last-time-shipped-header', 1000);

  });

  describe('/', function () {
    it('should load', function () {
      browser.url('http://localhost:3000');
      expect(browser.getUrl()).to.equal('http://localhost:3000/');
    });
  });

  describe('/lanes', function () {
    it('should load', function () {
      browser.url('http://localhost:3000/lanes');
      expect(browser.getUrl()).to.equal('http://localhost:3000/lanes');
    });
  });

  describe('/lanes/:name/edit', function () {
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

  describe('/lanes/:name/ship', function () {
    it('should load', function () {
      var random_lane_url = 'http://localhost:3000/lanes/' +
        faker.lorem.word() +
        '/ship';
      browser.url(random_lane_url);
      expect(browser.getUrl()).to.equal(random_lane_url);
    });
  });

  describe('/lanes/:name/ship/:date', function () {
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
