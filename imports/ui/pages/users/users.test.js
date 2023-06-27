import { resetDatabase } from 'cleaner';
import {
  is_harbormaster,
  captain_lanes,
  expire_user,
} from './lib';
import { expect } from 'chai';
const call_method = H.call;

describe('Users Page', () => {
  beforeEach(() => resetDatabase(null));

  describe('#is_harbormaster', function () {
    it('returns "Yes" if the user is a harbormaster', () => {
      expect(is_harbormaster({
        _id: 'test@foo.bar',
        harbormaster: true,
      })).to.eq('Yes');
    });
    it('returns "No" otherwise', () => {
      expect(is_harbormaster('test@foo.bar')).to.eq('No');
    });
  });

  describe('#captain_lanes', function () {
    it('returns "All" if the user is a harbormaster', () => {
      expect(captain_lanes({ _id: 'test@foo.bar', harbormaster: true }))
        .to
        .eq('All')
        ;
    });
    it('returns a list of captained lane names in string format', () => {
      Factory.create('lane', { name: 'test_1', captains: ['test@foo.bar'] });
      Factory.create('lane', {
        name: 'test_2',
        tokens: { 'test_token': 'test@foo.bar' },
      });
      expect(captain_lanes({ _id: 'test@foo.bar' })).to.eq('test_1, test_2');
    });
    it('returns "None" if no lanes are captained', () => {
      expect(captain_lanes({ _id: 'test@foo.bar' })).to.eq('None');
    });
  });

  describe('#expire_user', function () {
    it('confirms that the user should be expired', () => {
      let called = false;
      H.confirm = () => called = true;
      H.call = () => { };
      expire_user({ _id: 'test@foo.bar' });
      expect(called).to.eq(true);
      H.call = call_method;
    });
    it('saves that the user has been expired', () => {
      H.call = (method, user_id) => {
        expect(method).to.eq('Users#expire_user');
        expect(user_id).to.eq('test@foo.bar');
      };
      expire_user({ _id: 'test@foo.bar' });
      H.call = call_method;
    });
    it('alerts the user that the task is complete', () => {
      let called = false;
      H.alert = () => called = true;
      H.confirm = () => true;
      H.call = (method, user_id, callback) => callback();
      expire_user({ _id: 'test@foo.bar' });
      expect(called).to.eq(true);
    });
  });

});
