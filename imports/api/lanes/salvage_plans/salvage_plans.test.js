import { chai } from 'meteor/practicalmeteor:chai';
import SalvagePlans from './salvage_plans';

var should = chai.should();

describe('Salvage Plans', function () {
  it('should exist', function () {
    should.exist(SalvagePlans);
  });
});
