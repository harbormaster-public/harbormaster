import { chai } from 'meteor/practicalmeteor:chai';
import Users from '.';

var should = chai.should();

describe('Users', function () {
  it('should exist', function () {
    should.exist(Users);
  });
});
