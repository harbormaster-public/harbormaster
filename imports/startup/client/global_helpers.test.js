import chai from 'chai';
import { manifest_index } from './global_helpers.js';

const {expect} = chai;

describe('Global Helpers', function () {
  describe('#manifest_index', function () {
    it('should exist as a function', function () {
      expect(manifest_index).to.be.a('function');
    });

    it('should properly handle the first index', function () {
      expect(manifest_index(0)).to.equal('1st');
    });

    it('should properly handle the second index', function () {
      expect(manifest_index(1)).to.equal('2nd');
    });

    it('should properly handle the third index', function () {
      expect(manifest_index(2)).to.equal('3rd');
    });

    it('should properly handle any given index after the third', function () {
      let random_integer = Math.round(
        Math.random() * (100000000000000000 - 4) + 4
      );

      let expected_integer = random_integer + 1;

      expect(manifest_index(random_integer))
        .to
        .equal((expected_integer++) + 'th')
        ;
    });
  });
});
