// import {
//   is_harbormaster,
//   captain_lanes,
//   expire_user,
// } from './lib';

describe('Users Page', () => {

  describe('#is_harbormaster', function () {
    it('returns "Yes" if the user is a harbormaster');
    it('returns "No" otherwise');
  });

  describe('#captain_lanes', function () {
    it('returns "All" if the user is a harbormaster');
    it('returns a list of captained lane names in string format');
    it('returns "None" if no lanes are captained');
  });

  describe('#expire_user', function () {
    it('confirms that the user should be expired');
    it('saves that the user has been expired');
    it('alerts the user that the task is complete');
  });

});
