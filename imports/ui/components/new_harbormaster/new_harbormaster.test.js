import { expect } from 'chai';
import { Users } from '../../../api/users';
import vue from './new_harbormaster.vue';
const {methods: {on_click}} = vue;

describe('New Harbormaster View', () => {
  describe('#on_click', () => {
    const test_user = { emails: [{ address: 'foo@bar.com' }] };
    const test_user_method = () => test_user;
    const user_method_orig = H.user;
    const test_user_record = {};
    const test_users_find_one_method = () => test_user_record;
    const users_find_one_method = Users.findOne;
    let called_method;
    let called_user_id;

    before(() => {
      H.user = test_user_method;
      Users.findOne = test_users_find_one_method;
    });
    after(() => {
      H.user = user_method_orig;
      Users.findOne = users_find_one_method;
    });

    it('assigns harbormaster status to the user', () => {
      H.call = () => { };
      on_click();
      expect(test_user_record.harbormaster).to.eq(true);
    });
    it('saves the user status as harbormaster', () => {
      H.call = (method, user_id) => {
        called_method = method;
        called_user_id = user_id;
      };
      on_click();
      expect(called_method).to.eq('Users#update');
      expect(called_user_id).to.eq(test_user.emails[0].address);
    });
  });
});
