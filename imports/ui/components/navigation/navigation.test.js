import view from './navigation.vue';
import { expect } from 'chai';

describe('Navigation component', () => {
  describe('#handle_click_logout', () => {
    let called = false;
    const test_logout_method = () => { called = true; };
    const accounts_logout_method = Accounts.logout;

    before(() => { Accounts.logout = test_logout_method; });
    after(() => { Accounts.logout = accounts_logout_method; });

    it('logs out the current user', () => {
      view.methods.handle_click_logout();
      expect(called).to.eq(true);
    });
  });

  describe('#handle_click_lanes', () => {
    it('sets session state for choosing downstream lanes to false', () => {
      H.Session.set('choose_followup', true);
      H.Session.set('choose_salvage_plan', true);
      view.methods.handle_click_lanes();
      expect(H.Session.get('choose_followup')).to.eq(undefined);
      expect(H.Session.get('choose_salvage_plan')).to.eq(undefined);
    });
  });
});
