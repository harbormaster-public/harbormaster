import { chai } from 'meteor/practicalmeteor:chai';
import { manifest_index } from './global_helpers.js';

describe('Global Helpers', function () {
  describe('#manifest_index', function () {
    it('should exist as a function', function () {
      manifest_index.should.be.a('function');
    });

    it('should properly handle the first index', function () {
      manifest_index(0).should.equal('1st');
    });

    it('should properly handle the second index', function () {
      manifest_index(1).should.equal('2nd');
    });

    it('should properly handle the third index', function () {
      manifest_index(2).should.equal('3rd');
    });

    it('should properly handle any given index after the third', function () {
      let random_integer = Math.round(
        Math.random() * (100000000000000000 - 4) + 4
      );

      let expected_integer = random_integer + 1;

      manifest_index(random_integer).should.equal((expected_integer++) + 'th');
    });
  });
});
