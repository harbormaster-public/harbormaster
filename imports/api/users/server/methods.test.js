import { resetDatabase } from 'meteor/xolvio:cleaner';
import faker from 'faker';
import '.';
import { Users } from '..';
import { Meteor } from 'meteor/meteor';

const test_email = faker.internet.email();

Factory.define('user', Users, {
  _id: test_email
});

describe('Users#invite_user', function () {
  beforeEach(function () {
    resetDatabase();
  });

  it('should create a new User and Account', function () {
    var invited_user = Meteor.call('Users#invite_user', test_email);
    var user = Users.findOne(test_email);
    var account = Meteor.users.findOne({ _id: invited_user._id });

    user._id.should.equal(test_email);
    account._id.should.equal(invited_user._id);
    account.emails[0].address.should.equal(test_email);
  });

  it('should return the user account if it already exists', function () {
    var user = Factory.create('user');
    var invited_user = Meteor.call('Users#invite_user', test_email);
    var existing_user = Users.findOne(user._id);

    invited_user._id.should.equal(user._id);
    existing_user._id.should.equal(user._id);
  });

  it('should return false if no email is passed', function () {
    let results = Meteor.call('Users#invite_user');

    results.should.be.false;
  });
});
