import { chai } from 'meteor/practicalmeteor:chai';
import Harbormasters from './harbormasters';

var should = chai.should();

describe('Harbormasters', function () {
  it('should exist', function () {
    should.exist(Harbormasters);
  });
});
