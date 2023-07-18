import { resetDatabase } from 'cleaner';
import { set_harbormaster } from './accounts';
import { expect } from 'chai';
import { Users } from '../../api/users';

describe('Accounts.onLogin', () => {
  describe('#set_harbormaster', () => {
    beforeEach(() => {
      resetDatabase(null);
    });
    it('assigns a new Harbormaster if there are no users', () => {
      set_harbormaster('test@harbormaster.io');
      expect(Users.findOne('test@harbormaster.io').harbormaster).to.eq(true);
    });
    it('assigns existing Harbormaster status for existing users', () => {
      Factory.create('user', {
        _id: 'test@harbormaster.io',
        harbormaster: false,
      });
      set_harbormaster('test@harbormaster.io');
      expect(Users.findOne('test@harbormaster.io').harbormaster).to.eq(false);
    });
  });
});
