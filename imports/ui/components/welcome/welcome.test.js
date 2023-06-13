import { expect } from 'chai';
import view from './welcome.vue';
import H from '../../../startup/config/namespace';

const {
  methods: {
    password_login,
    password_reset,
    reset_token,
    set_new_password,
  },
} = view;

describe('Welcome Component', () => {
  describe('#password_login', () => {
    let called = false;
    const test_login_with_password = (email, password) => {
      called = true;
      expect(typeof email).to.eq('string');
      expect(typeof password).to.eq('string');
    };
    const login_with_password_orig = H.loginWithPassword;

    before(() => H.loginWithPassword = test_login_with_password);
    after(() => H.loginWithPassword = login_with_password_orig);

    it('attempts to login with email and password', () => {
      this.email = 'foo@bar.com';
      this.password = 'test_password';
      password_login();
      expect(called).to.eq(true);
    });
  });

  describe('#password_reset', () => {
    const alert_orig = H.alert;
    const reset_password_method = 'Users#reset_password';
    const call_method_orig = H.call;
    let called_method;
    let called = false;

    before(() => { H.alert = () => { called = true; }; });
    after(() => { H.alert = alert_orig; });

    it('alerts if no email is provided', () => {
      this.email = undefined;
      password_reset();
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
    it('removes the pasword_reset_token', () => {
      H.Session.set('password_reset_token', 'foo');
      set_new_password();
      expect(H.Session.get('password_reset_token')).to.eq(undefined);
    });
    it('sets the reset property to false on the view', () => {
      set_new_password.bind(this)();
      expect(this.reset).to.eq(false);
    });
  });
});
