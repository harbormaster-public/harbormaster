// import {
//   is_harbormaster,
//   on_submit,
//   invite_email,
// } from './lib';

describe('Add User Page', function () {

  describe('#is_harbormaster', function () {
    it('returns true if the user is a harbormaster');
    it('returns false otherwise');
  });

  describe('#on_submit', function () {
    it('invites a new user via email');
    it('navigates fresh instances to the root path (/)');
    it('navigates other instances to the Users Page');
  });

});

