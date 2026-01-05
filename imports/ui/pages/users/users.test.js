import { resetDatabase } from '../../../test-helpers/reset-database';
import {
  is_harbormaster,
  captain_lanes,
  expire_user,
} from './lib';
import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';
import { expect } from 'chai';
import {
  setupInMemoryCollection,
} from '../../../test-helpers/setup-collection-stubs';
const call_method = H.call;

describe('Users Page', () => {
  let usersStub;
  let lanesStub;

  beforeEach(async () => {
    await resetDatabase();
    usersStub = setupInMemoryCollection(Users);
    lanesStub = setupInMemoryCollection(Lanes);
  });
  afterEach(async () => {
    await resetDatabase();
    if (usersStub) usersStub.restore();
    if (lanesStub) lanesStub.restore();
  });

  describe('#is_harbormaster', function () {
    it('returns "Yes" if the user is a harbormaster', () => {
      expect(is_harbormaster({
        _id: 'test@foo.bar',
        harbormaster: true,
      })).to.eq('Yes');
    });
    it('returns "No" otherwise', () => {
      expect(is_harbormaster()).to.eq('No');
      expect(is_harbormaster('test@foo.bar')).to.eq('No');
    });
    it('fetches user from Users collection when user is not provided', () => {
      const originalUser = H.user;
      const testUser = {
        _id: 'test@foo.bar',
        emails: [{ address: 'test@foo.bar' }],
        harbormaster: false,
      };
      usersStub.insert(testUser);

      H.user = () => ({ emails: [{ address: 'test@foo.bar' }] });

      const result = is_harbormaster();
      expect(result).to.eq('No');

      H.user = originalUser;
    });
    it('returns "Yes" when fetched user is a harbormaster', () => {
      const originalUser = H.user;
      const testUser = {
        _id: 'test@foo.bar',
        emails: [{ address: 'test@foo.bar' }],
        harbormaster: true,
      };
      usersStub.insert(testUser);

      H.user = () => ({ emails: [{ address: 'test@foo.bar' }] });

      const result = is_harbormaster();
      expect(result).to.eq('Yes');

      H.user = originalUser;
    });
  });

  describe('#captain_lanes', function () {
    it('returns "All" if the user is a harbormaster', () => {
      expect(captain_lanes({ _id: 'test@foo.bar', harbormaster: true }))
        .to.eq('All');
    });
    it('returns a list of captained lane names in string format', () => {
      lanesStub.insert({
        _id: 'test_1',
        name: 'test_1',
        captains: ['test@foo.bar'],
        tokens: null,
      });
      lanesStub.insert({
        _id: 'test_2',
        name: 'test_2',
        captains: null,
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
      H.call = call_method;
    });
  });

});
