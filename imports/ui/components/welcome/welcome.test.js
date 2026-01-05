import { expect } from 'chai';
import H from '../../../startup/config/namespace';
import { Accounts } from 'meteor/accounts-base';
import {
  password_login,
  password_reset,
  set_new_password,
  reset_token,
} from './lib';

describe('Welcome Component', () => {
  describe('#password_login', () => {
    const login_with_password_orig = H.loginWithPassword;
    const alert_orig = H.alert;
    const error_orig = console.error;

    afterEach(() => {
      H.loginWithPassword = login_with_password_orig;
      H.alert = alert_orig;
      console.error = error_orig;
    });

    it('attempts to login with email and password', () => {
      let called = false;
      H.loginWithPassword = (email, password) => {
        called = true;
        expect(typeof email).to.eq('string');
        expect(typeof password).to.eq('string');
      };
      this.email = 'foo@bar.com';
      this.password = 'test_password';
      password_login.bind(this)();
      expect(called).to.eq(true);
    });

    it('alerts invalid credentials on 403', () => {
      let errored = '';
      let alerted = '';
      console.error = (msg) => { errored = String(msg); };
      H.alert = (msg) => { alerted = String(msg); };
      H.loginWithPassword = (email, password, cb) => {
        expect(email).to.eq('foo@bar.com');
        expect(password).to.eq('bad');
        cb({ error: 403 });
      };
      password_login.bind({ email: 'foo@bar.com', password: 'bad' })();
      expect(errored).to.eq('Invalid credentials.');
      expect(alerted).to.eq('Invalid credentials.');
    });

    it('throws on non-403 login errors', () => {
      H.loginWithPassword = (email, password, cb) => {
        expect(email).to.eq('foo@bar.com');
        expect(password).to.eq('bad');
        cb(new Error('boom'));
      };
      expect(() =>
        password_login.bind({ email: 'foo@bar.com', password: 'bad' })(),
      ).to.throw('boom');
    });

    it('does nothing when login succeeds (no error)', () => {
      H.alert = () => { throw new Error('should not alert'); };
      console.error = () => { throw new Error('should not console.error'); };
      H.loginWithPassword = (email, password, cb) => {
        expect(email).to.eq('foo@bar.com');
        expect(password).to.eq('ok');
        cb(undefined);
      };
      expect(() =>
        password_login.bind({ email: 'foo@bar.com', password: 'ok' })(),
      ).to.not.throw();
    });

    it('throws when err.error exists but is not 403', () => {
      H.loginWithPassword = (email, password, cb) => {
        expect(email).to.eq('foo@bar.com');
        expect(password).to.eq('bad');
        cb({ error: 500 });
      };
      expect(() =>
        password_login.bind({ email: 'foo@bar.com', password: 'bad' })(),
      ).to.throw();
    });
  });

  describe('#password_reset', () => {
    const alert_orig = H.alert;
    const reset_password_method = 'Users#reset_password';
    const call_method_orig = H.call;
    let called_method;
    let called = false;

    before(async () => { H.alert = () => { called = true; }; });
    after(async () => { H.alert = alert_orig; });

    it('alerts if no email is provided', () => {
      this.email = undefined;
      password_reset.bind(this)();
      expect(called).to.eq(true);
    });
    it('sets the reset property to true on the view', () => {
      this.email = 'foo@bar.com';
      password_reset.bind(this)();
      expect(this.reset).to.eq(true);
    });
    it('resets the user passsword', () => {
      this.email = 'foo@bar.com';
      H.call = method => called_method = method;
      password_reset.bind(this)();
      expect(called_method).to.eq(reset_password_method);
      H.call = call_method_orig;
    });
  });

  describe('#reset_token', () => {
    it('returns the password_reset_token from the Session', () => {
      H.Session.set('password_reset_token', 'test');
      expect(reset_token()).to.eq('test');
    });
  });

  describe('#set_new_password', () => {
    const reset_password_orig = Accounts.resetPassword;

    afterEach(() => {
      Accounts.resetPassword = reset_password_orig;
    });

    it('removes the pasword_reset_token', () => {
      H.Session.set('password_reset_token', 'foo');
      this.password = 'new_password';
      Accounts.resetPassword = (token, password, cb) => cb(null);
      set_new_password.bind(this)();
      expect(H.Session.get('password_reset_token')).to.eq(undefined);
    });
    it('sets the reset property to false on the view', () => {
      Accounts.resetPassword = (token, password, cb) => cb(null);
      set_new_password.bind(this)();
      expect(this.reset).to.eq(false);
    });
    it('calls Accounts.resetPassword with the Session reset token', () => {
      H.Session.set('password_reset_token', 'token123');
      let gotToken;
      let gotPassword;
      Accounts.resetPassword = (token, password, cb) => {
        gotToken = token;
        gotPassword = password;
        cb(null);
      };
      set_new_password.bind({ password: 'pw' })();
      expect(gotToken).to.eq('token123');
      expect(gotPassword).to.eq('pw');
    });
    it('throws if Accounts.resetPassword callback receives an error', () => {
      H.Session.set('password_reset_token', 'token123');
      Accounts.resetPassword = (token, password, cb) => cb(new Error('fail'));
      expect(() => set_new_password.bind({ password: 'pw' })())
        .to.throw('fail');
    });

    it('exposes set_new_password as a named export', async () => {
      const lib = await import('./lib');
      expect(lib.set_new_password).to.be.a('function');
    });
  });
});
