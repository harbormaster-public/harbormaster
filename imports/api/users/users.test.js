import Users from '.';
import chai from 'chai';
const expect = chai.expect;

describe('Users collection', function () {
  it('should exist', function () {
    expect(Users).to.not.eq(undefined);
  });
});
