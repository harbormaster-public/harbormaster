import { chai } from 'meteor/practicalmeteor:chai';
import Captains from '.';

var should = chai.should();

describe('Captains collection', function () {
  it('should exist', function () {
    should.exist(Captains);
  });
});
