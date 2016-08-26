import { chai } from 'meteor/practicalmeteor:chai';
import Shipments from './shipments';

var should = chai.should();

describe('Shipments', function () {
  it('should exist', function () {

    should.exist(Shipments);
  });
});
