import { chai } from 'meteor/practicalmeteor:chai';
import Captains from './captains';

var should = chai.should();

describe('Captains', function () {
  it('should exist', function () {
    should.exist(Captains);
  });
});
