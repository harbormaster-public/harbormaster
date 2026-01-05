import { expect } from 'chai';
import { Accounts } from 'meteor/accounts-base';
import {
  handle_click_logout,
  handle_click_lanes,
} from './lib';

describe('Navigation component', () => {
  describe('#handle_click_logout', () => {
    let called = false;
    const test_logout_method = () => { called = true; };
    const accounts_logout_method = Accounts.logout;

    before(async () => { Accounts.logout = test_logout_method; });
    after(async () => { Accounts.logout = accounts_logout_method; });

    it('logs out the current user', () => {
      handle_click_logout();
      expect(called).to.eq(true);
    });
  });

  describe('#handle_click_lanes', () => {
    it('sets session state for choosing downstream lanes to false', () => {
      H.Session.set('choose_followup', true);
      H.Session.set('choose_salvage_plan', true);
      handle_click_lanes();
      expect(H.Session.get('choose_followup')).to.eq(false);
      expect(H.Session.get('choose_salvage_plan')).to.eq(false);
    });
  });
});
