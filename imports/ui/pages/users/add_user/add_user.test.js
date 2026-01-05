import { resetDatabase } from '../../../../test-helpers/reset-database';
import {
  is_harbormaster,
  on_submit,
} from './lib';
import { Users } from '../../../../api/users';
import { expect } from 'chai';
const call_method = H.call;

describe('Add User Page', function () {
  beforeEach(async () => await resetDatabase());

  describe('#is_harbormaster', function () {

    it('returns true if the user is a harbormaster', async () => {
      await Users.insertAsync({
        _id: 'test@harbormaster.io',
        harbormaster: true,
      });
      expect(await is_harbormaster()).to.eq(true);
    });
    it('returns false otherwise', async () => {
      expect(await is_harbormaster()).to.eq(false);
    });
  });

  describe('#on_submit', function () {
    it('invites a new user via email', () => {
      H.call = (method, email) => {
        expect(method).to.eq('Users#invite_user');
        expect(email).to.eq('test@harbormaster.io');
      };
      this.invite_email = 'test@harbormaster.io';
      on_submit.bind(this)();
      H.call = call_method;
    });
    it('passes only email when fresh is false', () => {
      let callArgs;
      H.call = function () {
        callArgs = Array.from(arguments);
      };
      this.invite_email = 'test@harbormaster.io';
      this.fresh = false;
      on_submit.bind(this)();
      expect(callArgs[0]).to.eq('Users#invite_user');
      expect(callArgs[1]).to.eq('test@harbormaster.io');
      expect(callArgs.length).to.eq(3);
      H.call = call_method;
    });
    it('passes only email when invite_password is not provided', () => {
      let callArgs;
      H.call = function () {
        callArgs = Array.from(arguments);
      };
      this.invite_email = 'test@harbormaster.io';
      this.fresh = true;
      this.invite_password = undefined;
      on_submit.bind(this)();
      expect(callArgs[0]).to.eq('Users#invite_user');
      expect(callArgs[1]).to.eq('test@harbormaster.io');
      expect(callArgs.length).to.eq(3);
      H.call = call_method;
    });
    it('passes email and password when fresh is true and password is provided',
      () => {
        let callArgs;
        H.call = function () {
          callArgs = Array.from(arguments);
        };
        this.invite_email = 'test@harbormaster.io';
        this.invite_password = 'testpassword';
        this.fresh = true;
        on_submit.bind(this)();
        expect(callArgs[0]).to.eq('Users#invite_user');
        expect(callArgs[1]).to.eq('test@harbormaster.io');
        expect(callArgs[2]).to.eq('testpassword');
        expect(callArgs.length).to.eq(4);
        H.call = call_method;
      });
    it('navigates fresh instances to the root path (/)', () => {
      H.call = function () {
        const callback = Array.from(arguments).pop();
        if (typeof callback === 'function') {
          callback();
        }
      };
      H.loginWithPassword = function (email, password, callback) {
        if (typeof callback === 'function') {
          callback();
        }
      };
      this.$router = {
        calls: [],
        currentRoute: { path: '/not-root' },
        push (path) {
          this.calls.push(path);
          return { catch () {} };
        },
      };
      this.$route = {};
      this.fresh = true;
      on_submit.bind(this)();
      expect(this.$router.calls[0]).to.eq('/');
      H.call = call_method;
      delete H.loginWithPassword;
    });
    it(
      'navigates to root path when fresh is true but no password provided',
      () => {
        H.call = function () {
          const callback = Array.from(arguments).pop();
          if (typeof callback === 'function') {
            callback();
          }
        };
        this.$router = {
          calls: [],
          currentRoute: { path: '/not-root' },
          push (path) {
            this.calls.push(path);
            return { catch () {} };
          },
        };
        this.$route = {};
        this.invite_email = 'test@harbormaster.io';
        this.fresh = true;
        this.invite_password = undefined;
        on_submit.bind(this)();
        expect(this.$router.calls[0]).to.eq('/');
        H.call = call_method;
      });
    it('navigates to root path when login fails', () => {
      H.call = function () {
        const callback = Array.from(arguments).pop();
        if (typeof callback === 'function') {
          callback();
        }
      };
      H.loginWithPassword = function (email, password, callback) {
        if (typeof callback === 'function') {
          callback(new Error('Login failed'));
        }
      };
      this.$router = {
        calls: [],
        currentRoute: { path: '/not-root' },
        push (path) {
          this.calls.push(path);
          return { catch () {} };
        },
      };
      this.$route = {};
      this.invite_email = 'test@harbormaster.io';
      this.invite_password = 'testpassword';
      this.fresh = true;
      on_submit.bind(this)();
      expect(this.$router.calls[0]).to.eq('/');
      H.call = call_method;
      delete H.loginWithPassword;
    });
    it('navigates other instances to the Users Page', () => {
      H.call = (method, email, callback) => callback();
      this.$router = {
        calls: [],
        currentRoute: { path: '/' },
        push (path) {
          this.calls.push(path);
          return { catch () {} };
        },
      };
      this.$route = {};
      this.fresh = false;
      on_submit.bind(this)();
      expect(this.$router.calls[0]).to.eq('/users');
      H.call = call_method;
    });

    it('does not push when already on the destination path', () => {
      let pushCalled = false;
      H.call = (method, email, callback) => callback();
      this.$router = {
        currentRoute: { path: '/users' },
        push () {
          pushCalled = true;
        },
      };
      this.fresh = false;
      on_submit.bind(this)();
      expect(pushCalled).to.eq(false);
      H.call = call_method;
    });

    it('suppresses promise rejections from $router.push', () => {
      let caught = false;
      H.call = (method, email, callback) => callback();
      this.$router = {
        currentRoute: { path: '/' },
        push () {
          return {
            catch (fn) {
              caught = true;
              fn(new Error('NavigationDuplicated'));
            },
          };
        },
      };
      this.fresh = false;
      on_submit.bind(this)();
      expect(caught).to.eq(true);
      H.call = call_method;
    });

    it('does nothing if $router is missing or invalid', () => {
      H.call = (method, email, callback) => callback();
      this.$router = undefined;
      this.fresh = false;
      on_submit.bind(this)();
      H.call = call_method;
    });

    it(
      'does not call .catch when $router.push does not return a promise',
      () => {
        let pushCalled = false;
        H.call = (method, email, callback) => callback();
        this.$router = {
          currentRoute: { path: '/' },
          push () {
            pushCalled = true;
            return undefined;
          },
        };
        this.fresh = false;
        on_submit.bind(this)();
        expect(pushCalled).to.eq(true);
        H.call = call_method;
      });
  });

});

