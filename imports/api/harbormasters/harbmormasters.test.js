import { chai } from 'meteor/practicalmeteor:chai';
import Harbormasters from '.';

var should = chai.should();

describe('Harbormasters collection', function () {
  it('should exist', function () {
    should.exist(Harbormasters);
  });
});
