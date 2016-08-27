import { resetDatabase } from 'meteor/xolvio:cleaner';
import faker from 'faker';
import './methods';
import { Users } from '../users';
import { Meteor } from 'meteor/meteor';

const test_email = faker.internet.email();
const test_password = faker.internet.password();

Factory.define('user', Users, {
  _id: test_email
});

describe('Users#invite_user', function () {
  beforeEach(function () {
    resetDatabase();
  });

  it('should create a new User and Account', function () {
    var id = Meteor.call(
      'Users#invite_user',
      test_email,
      test_password,
      test_password
    );
    var user = Users.findOne(test_email);
    var account = Meteor.users.findOne({ _id: id });

    user._id.should.equal(test_email);
    account._id.should.equal(id);
    account.emails[0].address.should.equal(test_email);
  });

  it('should return false if an account already exists', function () {
    var user = Factory.create('user');
    var id = Meteor.call(
      'Users#invite_user',
      test_email,
      test_password,
      test_password
    );
    var existing_user = Users.findOne(user._id);

    id.should.be.false;
    existing_user._id.should.equal(user._id);
  });
});
