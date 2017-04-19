import { chai } from 'meteor/practicalmeteor:chai';
import Shipments from '.';

var should = chai.should();

describe('Shipments', function () {
  it('should exist', function () {

    should.exist(Shipments);
  });
});
