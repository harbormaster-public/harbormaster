import { resetDatabase } from "../../../test-helpers/reset-database";
import ".";
import { Users } from "..";
import { Accounts } from 'meteor/accounts-base';
import chai from "chai";

const { expect } = chai;
const faker = require("faker");

describe("Users#invite_user", function () {
  let test_email;
  const accounts_original_findUserByEmail = Accounts.findUserByEmail;
  const accounts_original_setPasswordAsync = Accounts.setPasswordAsync;
  const accounts_original_createUserAsync = Accounts.createUserAsync;
  const accounts_original_sendResetPasswordEmail =
    Accounts.sendResetPasswordEmail;

  beforeEach(async function () {
    await resetDatabase();
    test_email = faker.internet.email(); // Generate a new email for each test
    Accounts.findUserByEmail = () => null;
    Accounts.createUserAsync = async ({ email }) => {
      const accountId = `account_${email}`;
      await H.users.insertAsync({
        _id: accountId,
        emails: [{ address: email }],
      });
      return accountId;
    };
  });

  afterEach(async function () {
    // Restore any Accounts stubs used in these tests
    Accounts.findUserByEmail = accounts_original_findUserByEmail;
    Accounts.setPasswordAsync = accounts_original_setPasswordAsync;
    Accounts.createUserAsync = accounts_original_createUserAsync;
    Accounts.sendResetPasswordEmail = accounts_original_sendResetPasswordEmail;
    await resetDatabase();
  });

  it("creates a new User and Account", async function () {
    const methods = await import('./methods');
    const invited_user = await methods.default['Users#invite_user'](test_email);
    const user = await Users.findOneAsync(test_email);
    const account = await H.users.findOneAsync({ _id: invited_user._id });

    expect(user).to.not.be.undefined;
    expect(user._id).to.equal(test_email);
    expect(account).to.not.be.undefined;
    expect(account._id).to.equal(invited_user._id);
    expect(account.emails[0].address).to.equal(test_email);
  });

  it("returns the user account if it already exists", async function () {
    await Users.insertAsync({ _id: test_email });
    Accounts.findUserByEmail = () => ({ _id: 'existingAccountId' });
    const methods = await import('./methods');
    const invited_user = await methods.default['Users#invite_user'](test_email);
    const existing_user = await Users.findOneAsync(test_email);

    expect(invited_user).to.not.be.undefined;
    expect(invited_user._id).to.equal('existingAccountId');
    expect(existing_user._id).to.equal(test_email);
  });

  it(
    'creates a Users record via upsert when account exists',
    async function () {
      Accounts.findUserByEmail = () => ({ _id: 'existingAccountId' });
      const methods = await import('./methods');
      const invited_user = await methods.default['Users#invite_user'](
        test_email,
      );
      const record = await Users.findOneAsync(test_email);

      expect(invited_user._id).to.equal('existingAccountId');
      expect(record).to.not.be.null;
      expect(record._id).to.equal(test_email);
      expect(record.emails[0].address).to.equal(test_email);
    },
  );

  it("returns false if no email is passed", async function () {
    const methods = await import('./methods');
    const results = await methods.default['Users#invite_user']();

    expect(results).to.eq(false);
  });

  it("returns string id when findUserByEmail returns id", async function () {
    Accounts.findUserByEmail = () => 'stringAccountId';
    const methods = await import('./methods');
    const result = await methods.default['Users#invite_user'](test_email);
    expect(result).to.not.be.undefined;
    expect(result._id).to.eq('stringAccountId');
  });

  it(
    "sets password when account exists and password provided",
    async function () {
      Accounts.findUserByEmail = () => ({
        _id: 'existingAccountId',
        emails: [{ address: test_email }],
      });
      let setCalled = false;
      Accounts.setPasswordAsync = async (id, pwd) => {
        setCalled = true;
        expect(id).to.equal('existingAccountId');
        expect(pwd).to.equal('Sup3rSecret!');
      };

      const methods = await import('./methods');
      const result = await methods.default['Users#invite_user'](
        test_email,
        'Sup3rSecret!',
      );

      expect(setCalled).to.eq(true);
      expect(result).to.not.be.undefined;
      expect(result._id).to.eq('existingAccountId');
    });

  it(
    'attempts to send reset email when account exists and no password is ' +
    'provided (non-test mode)',
    async function () {
      const originalIsTest = H.isTest;
      const originalIsE2E = H.isE2E;
      const originalWarn = console.warn;
      try {
        Object.defineProperty(H, 'isTest', {
          value: false,
          configurable: true,
          writable: true,
        });
        Object.defineProperty(H, 'isE2E', {
          value: false,
          configurable: true,
          writable: true,
        });

        await Users.insertAsync({ _id: test_email });
        Accounts.findUserByEmail = () => ({ _id: 'existingAccountId' });

        let called = false;
        Accounts.sendResetPasswordEmail = async (id) => {
          called = true;
          expect(id).to.eq('existingAccountId');
        };
        console.warn = () => { throw new Error('should not warn'); };

        const methods = await import('./methods');
        const result = await methods.default['Users#invite_user'](test_email);
        expect(result._id).to.eq('existingAccountId');
        expect(called).to.eq(true);
      }
      finally {
        Object.defineProperty(H, 'isTest', {
          value: originalIsTest,
          configurable: true,
          writable: true,
        });
        Object.defineProperty(H, 'isE2E', {
          value: originalIsE2E,
          configurable: true,
          writable: true,
        });
        console.warn = originalWarn;
      }
    },
  );

  it(
    'sends reset email when creating a new user without a password ' +
    '(non-test mode)',
    async function () {
      const originalIsTest = H.isTest;
      const originalIsE2E = H.isE2E;
      try {
        Object.defineProperty(H, 'isTest', {
          value: false,
          configurable: true,
          writable: true,
        });
        Object.defineProperty(H, 'isE2E', {
          value: false,
          configurable: true,
          writable: true,
        });

        let called = false;
        Accounts.sendResetPasswordEmail = async (id) => {
          called = true;
          expect(String(id)).to.include(test_email);
        };

        const methods = await import('./methods');
        const result = await methods.default['Users#invite_user'](test_email);
        expect(String(result._id)).to.include(test_email);
        expect(called).to.eq(true);
      }
      finally {
        Object.defineProperty(H, 'isTest', {
          value: originalIsTest,
          configurable: true,
          writable: true,
        });
        Object.defineProperty(H, 'isE2E', {
          value: originalIsE2E,
          configurable: true,
          writable: true,
        });
      }
    },
  );

  it(
    'does not send reset email when password is provided explicitly ' +
    '(non-test mode)',
    async function () {
      const originalIsTest = H.isTest;
      const originalIsE2E = H.isE2E;
      try {
        Object.defineProperty(H, 'isTest', {
          value: false,
          configurable: true,
          writable: true,
        });
        Object.defineProperty(H, 'isE2E', {
          value: false,
          configurable: true,
          writable: true,
        });

        let called = false;
        Accounts.sendResetPasswordEmail = async () => { called = true; };

        const methods = await import('./methods');
        await methods.default['Users#invite_user'](test_email, 'Sup3rSecret!');
        expect(called).to.eq(false);
      }
      finally {
        Object.defineProperty(H, 'isTest', {
          value: originalIsTest,
          configurable: true,
          writable: true,
        });
        Object.defineProperty(H, 'isE2E', {
          value: originalIsE2E,
          configurable: true,
          writable: true,
        });
      }
    },
  );

  it(
    "warns when reset email can't be sent (MAIL_URL not configured)",
    async function () {
      const originalIsTest = H.isTest;
      const originalIsE2E = H.isE2E;
      const originalWarn = console.warn;
      try {
        Object.defineProperty(H, 'isTest', {
          value: false,
          configurable: true,
          writable: true,
        });
        Object.defineProperty(H, 'isE2E', {
          value: false,
          configurable: true,
          writable: true,
        });

        await Users.insertAsync({ _id: test_email });
        Accounts.findUserByEmail = () => ({ _id: 'existingAccountId' });

        Accounts.sendResetPasswordEmail = async () => {
          throw new Error('MAIL_URL not set');
        };
        let warned = false;
        console.warn = (msg) => {
          warned = true;
          expect(String(msg)).to.include('Password reset email not sent');
        };

        const methods = await import('./methods');
        const result = await methods.default['Users#invite_user'](test_email);
        expect(result._id).to.eq('existingAccountId');
        expect(warned).to.eq(true);
      }
      finally {
        Object.defineProperty(H, 'isTest', {
          value: originalIsTest,
          configurable: true,
          writable: true,
        });
        Object.defineProperty(H, 'isE2E', {
          value: originalIsE2E,
          configurable: true,
          writable: true,
        });
        console.warn = originalWarn;
      }
    },
  );

  it(
    "returns email when accountId is not available",
    async function () {
      await Users.insertAsync({ _id: test_email });
      Accounts.findUserByEmail = () => ({});
      const methods = await import('./methods');
      const result = await methods.default['Users#invite_user'](test_email);

      expect(result).to.not.be.undefined;
      expect(result._id).to.eq(test_email);
    });
});

describe('Users#reset_password', () => {
  const accounts_original_findUserByEmail = Accounts.findUserByEmail;
  const accounts_original_sendResetPasswordEmail =
    Accounts.sendResetPasswordEmail;
  const accounts_original_generateResetToken = Accounts.generateResetToken;
  const accounts_original_urls = Accounts.urls;

  afterEach(() => {
    Accounts.findUserByEmail = accounts_original_findUserByEmail;
    Accounts.sendResetPasswordEmail = accounts_original_sendResetPasswordEmail;
    Accounts.generateResetToken = accounts_original_generateResetToken;
    Accounts.urls = accounts_original_urls;
  });

  it(
    'logs a reset URL when sendResetPasswordEmail throws in non-test mode',
    async () => {
      const originalIsTest = H.isTest;
      const originalLog = console.log;
      const logs = [];
      try {
        Object.defineProperty(H, 'isTest', {
          value: false,
          configurable: true,
          writable: true,
        });

        Accounts.findUserByEmail = () => ({ _id: 'acct' });
        Accounts.sendResetPasswordEmail = async () => {
          throw new Error('MAIL_URL not set');
        };
        Accounts.generateResetToken = async () => 'token123';
        Accounts.urls = {
          resetPassword: (t) => `RESET:${t}`,
        };
        console.log = (...args) => { logs.push(args.join(' ')); };

        const methods = await import('./methods');
        const email = await methods.default['Users#reset_password']('x@y.com');
        expect(email).to.eq('x@y.com');
        expect(logs.join('\n')).to.include('Password Reset URL:');
        expect(logs.join('\n')).to.include('RESET:token123');
      }
      finally {
        Object.defineProperty(H, 'isTest', {
          value: originalIsTest,
          configurable: true,
          writable: true,
        });
        console.log = originalLog;
      }
    });
});

describe("Users#expire_user", () => {
  const accounts_find_user_by_email = Accounts.findUserByEmail;
  const accounts_set_password_async = Accounts.setPasswordAsync;
  beforeEach(async () => {
    await resetDatabase();
    Accounts.findUserByEmail = () => ({ _id: 'test-account-id' });
    Accounts.setPasswordAsync = async () => { };
  });
  afterEach(async () => {
    await resetDatabase();
    Accounts.findUserByEmail = accounts_find_user_by_email;
    Accounts.setPasswordAsync = accounts_set_password_async;
  });

  it("expires the password associated with the email given", async () => {
    Accounts.setPasswordAsync = async (id, password) => {
      expect(typeof password).to.eq('string');
    };
    const methods = await import('./methods');
    await methods.default['Users#expire_user']('test@harbormaster.io');
  });
  it(
    "returns the email of the account associated with the expiry",
    async () => {
      const methods = await import('./methods');
      expect(await methods.default['Users#expire_user']('test@harbormaster.io'))
        .to
        .eq('test@harbormaster.io');
    },
  );
  it("sets the user to expired status", async () => {
    await Users.insertAsync({ _id: 'test@harbormaster.io' });
    const methods = await import('./methods');
    await methods.default['Users#expire_user']('test@harbormaster.io');
    const user = await Users.findOneAsync('test@harbormaster.io');
    expect(user).to.not.be.undefined;
    expect(user.expired).to.eq(true);
  });

  it("throws when user is not found", async () => {
    Accounts.findUserByEmail = () => null;
    const methods = await import('./methods');
    try {
      await methods.default['Users#expire_user']('test@harbormaster.io');
      expect.fail('Should have thrown an error');
    }
    catch (err) {
      expect(err instanceof Error).to.eq(true);
      expect(err.message).to.eq('User not found');
    }
  });

  it("throws when user has no _id", async () => {
    Accounts.findUserByEmail = () => ({});
    const methods = await import('./methods');
    try {
      await methods.default['Users#expire_user']('test@harbormaster.io');
      expect.fail('Should have thrown an error');
    }
    catch (err) {
      expect(err instanceof Error).to.eq(true);
      expect(err.message).to.eq('User not found');
    }
  });
});

describe("Users#update", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  it("updates a user by looking up their email", async () => {
    await Users.insertAsync({ _id: 'test@harbormaster.io' });
    const methods = await import('./methods');
    const result = await methods.default['Users#update'](
      'test@harbormaster.io',
      {},
    );
    expect(result).to.eq(true);
  });
});

describe("Users#reset_password", () => {
  const accounts_find_user_by_email = Accounts.findUserByEmail;
  beforeEach(async () => {
    await resetDatabase();
    Accounts.findUserByEmail = () => ({ _id: 'test-account-id' });
  });
  afterEach(async () => {
    await resetDatabase();
    Accounts.findUserByEmail = accounts_find_user_by_email;
  });

  it("returns the email of the account reset", async () => {
    const methods = await import('./methods');
    expect(
      await methods.default['Users#reset_password']('test@harbormaster.io'),
    ).to.eq('test@harbormaster.io');
  });
});
