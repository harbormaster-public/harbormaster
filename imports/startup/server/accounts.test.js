import { resetDatabase } from '../../test-helpers/reset-database';
import { ensureEmailAvailable, set_harbormaster } from './accounts';
import { expect } from 'chai';
import { Users } from '../../api/users';
import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import '../config/namespace.server';

describe('Accounts.onLogin', () => {
  describe('#set_harbormaster', () => {
    beforeEach(async () => {
      await resetDatabase();
      await Accounts.createUserAsync({ email: 'test@harbormaster.io' });
    });
    it('assigns a new Harbormaster if there are no users', async () => {
      await set_harbormaster();
      const user = await Users.findOneAsync('test@harbormaster.io');
      expect(user).to.not.be.undefined;
      expect(user.harbormaster).to.eq(true);
    });
    it('assigns existing Harbormaster status for existing users', async () => {
      await Users.insertAsync({
        _id: 'test@harbormaster.io',
        harbormaster: false,
      });
      await set_harbormaster({
        user: { emails: [{ address: 'test@harbormaster.io' }] },
      });
      const user = await Users.findOneAsync('test@harbormaster.io');
      expect(user).to.not.be.undefined;
      expect(user.harbormaster).to.eq(false);
    });
  });
});

describe('Email.send override', () => {
  let Email;
  let originalLog;
  let originalCall;
  let originalMailUrl;

  beforeEach(async () => {
    await resetDatabase();
    Email = H.Email;
    originalLog = console.log;
    originalCall = Function.prototype.call;
    originalMailUrl = process.env.MAIL_URL;
  });

  afterEach(async () => {
    console.log = originalLog;
    /* eslint-disable-next-line no-extend-native */
    Function.prototype.call = originalCall;
    if (originalMailUrl === undefined) delete process.env.MAIL_URL;
    else process.env.MAIL_URL = originalMailUrl;
    await resetDatabase();
  });

  it('throws a clear error when H.Email is missing', () => {
    const originalEmail = H.Email;
    try {
      H.Email = undefined;
      expect(() => ensureEmailAvailable()).to.throw(
        'H.Email is not available on the server',
      );
    }
    finally {
      H.Email = originalEmail;
    }
  });

  it('logs and returns when MAIL_URL is unset', () => {
    let calls = 0;
    console.log = () => { calls += 1; };
    Email.send({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test',
      text: 'Hello',
    });
    expect(calls).to.be.greaterThan(0);
  });

  it('logs HTML when only html is provided', () => {
    let sawHtmlLog = false;
    console.log = (...args) => {
      if (args[0] === 'HTML:') sawHtmlLog = true;
    };
    Email.send({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test',
      html: '<b>Hello</b>',
    });
    expect(sawHtmlLog).to.eq(true);
  });

  it('delegates to original send when MAIL_URL is set', () => {
    process.env.MAIL_URL = 'smtp://user:pass@localhost:25';
    let anyLog = false;
    let delegated = false;
    console.log = () => { anyLog = true; };
    /* eslint-disable-next-line no-extend-native */
    Function.prototype.call = function () {
      const thisArg = arguments[0];
      const options = arguments[1];
      if (
        thisArg === Email &&
        options &&
        options.from === 'from@example.com' &&
        this !== Email.send
      ) {
        delegated = true;
        // Don't actually call the original to avoid connection error
        // Just return a resolved promise to simulate success
        return Promise.resolve();
      }
      return originalCall.apply(this, arguments);
    };
    Email.send({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Test',
      text: 'Hello',
    });
    expect(anyLog).to.eq(false);
    expect(delegated).to.eq(true);
  });
});

describe('Accounts.urls.resetPassword', () => {
  let originalAbs;
  beforeEach(async () => {
    await resetDatabase();
    originalAbs = Meteor.absoluteUrl;
  });

  afterEach(async () => {
    Meteor.absoluteUrl = originalAbs;
    await resetDatabase();
  });

  it('returns absolute URL for reset password token', () => {
    let receivedPath;
    Meteor.absoluteUrl = (path) => {
      receivedPath = path;
      return `ABS:${path}`;
    };
    const url = Accounts.urls.resetPassword('abc123');
    expect(receivedPath).to.eq('reset-password/abc123');
    expect(url).to.eq('ABS:reset-password/abc123');
  });
});

describe('Accounts.emailTemplates.resetPassword', () => {
  it('provides a subject line', () => {
    expect(Accounts.emailTemplates.resetPassword.subject()).to.be.a('string');
  });
});
