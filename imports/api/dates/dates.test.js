import { start_date } from '.';
import chai from 'chai';
const expect = chai.expect;

describe('#start_date ("Start Dates")', () => {
  it('match a format of YYYY-M{M}-D{D}-H{H}-S{S}', () => {
    const format_regex = /\d\d\d\d-\d{1,2}-\d{1,2}-\d{1,2}-\d{1,2}-\d{1,2}/;
    expect(start_date()).to.match(format_regex);
  });
});
