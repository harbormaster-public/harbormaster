import { expect } from 'chai';
import { Users } from '../../../api/users';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { Accounts } from 'meteor/accounts-base';
import {
  setupInMemoryCollection,
} from '../../../test-helpers/setup-collection-stubs';
import { on_click } from './lib';

describe('New Harbormaster View', () => {
  describe('#on_click', () => {
    const user_method = H.user;
    const test_user = { emails: [{ address: 'foo@bar.com' }] };
    let test_user_record = {};
    let called_method;
    let called_user_id;
    let usersStub;

    beforeEach(async () => {
      await resetDatabase();
      usersStub = setupInMemoryCollection(Users);
      Accounts.createUser({ email: test_user.emails[0].address });
      usersStub.insert({ _id: test_user.emails[0].address });
      H.user = () => test_user;
    });
    afterEach(() => {
      H.user = user_method;
      if (usersStub) usersStub.restore();
    });

    it('saves the user status as harbormaster', async () => {
      const original_call = H.call;
      H.call = (method, user_id, user) => {
        called_method = method;
        called_user_id = user_id;
        test_user_record = user;
      };
      await on_click();
      expect(called_method).to.eq('Users#update');
      expect(called_user_id).to.eq(test_user.emails[0].address);
      expect(test_user_record.harbormaster).to.eq(true);
      H.call = original_call;
    });
  });
});
