import { resetDatabase } from 'cleaner';
import {
  is_harbormaster,
  on_submit,
} from './lib';
import { expect } from 'chai';
const call_method = H.call;

describe('Add User Page', function () {
  beforeEach(() => resetDatabase(null));

  describe('#is_harbormaster', function () {
    it('returns true if the user is a harbormaster', () => {
      Factory.create('user', {
        _id: 'test@harbormaster.io',
        harbormaster: true,
      });
      expect(is_harbormaster()).to.eq(true);
    });
    it('returns false otherwise', () => {
      expect(is_harbormaster()).to.eq(false);
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
    it('navigates fresh instances to the root path (/)', () => {
      H.call = (method, email, callback) => callback();
      this.$router = [];
      this.$route = {};
      this.fresh = true;
      on_submit.bind(this)();
      expect(this.$router[0]).to.eq('/');
      H.call = call_method;
    });
    it('navigates other instances to the Users Page', () => {
      H.call = (method, email, callback) => callback();
      this.$router = [];
      this.$route = {};
      this.fresh = false;
      on_submit.bind(this)();
      expect(this.$router[0]).to.eq('/users');
      H.call = call_method;
    });
  });

});

