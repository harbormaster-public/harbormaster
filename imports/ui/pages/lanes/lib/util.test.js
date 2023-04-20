// import {
//   count,
//   history,
//   get_lane,
// } from './util';

describe('pages/lanes/lib/util', function () {

  describe('#count', function () {
    it('returns the number of shipments found for a lane');
  });

  describe('#history', function () {
    it('returns the shipments for a lane sorted and limited');
    it('returns false if not given a lane');
  });

  describe('#get_lane', function () {
    it('returns a lane by name or slug or Session store');
    it('returns an empty object if no lane is found');
  });

});
