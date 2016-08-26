import { chai } from 'meteor/practicalmeteor:chai';
import Users from './users';

var should = chai.should();

describe('Users', function () {
  it('should exist', function () {
    should.exist(Users);
  });
});
