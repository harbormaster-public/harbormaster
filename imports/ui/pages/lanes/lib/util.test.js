import {
  count,
  history,
  get_lane,
} from './util';
import { Lanes } from '../../../../api/lanes';
import { Shipments } from '../../../../api/shipments';
import chai from 'chai';
import faker from 'faker';
import _ from 'lodash';
const { expect } = chai;

const test_lane_one_shipment_id = faker.random.uuid();
const test_lane_no_shipments_id = faker.random.uuid();
const test_lane_multiple_shipments_id = faker.random.uuid();
const first_complete_actual = 1;
const second_complete_actual = 2;
const third_complete_actual = 3;
Factory.define('test_one_shipment_lane', Lanes, {
  _id: test_lane_one_shipment_id,
  name: 'One Shipment',
  slug: 'one-shipment',
});
Factory.define('test_no_shipments_lane', Lanes, {
  _id: test_lane_no_shipments_id,
});
Factory.define('test_lane_multiple_shipments', Lanes, {
  _id: test_lane_multiple_shipments_id,
});
Factory.define('test_one_shipment', Shipments, {
  lane: test_lane_one_shipment_id,
});
Factory.define('test_multi_shipment_1', Shipments, {
  lane: test_lane_multiple_shipments_id,
  actual: first_complete_actual,
});
Factory.define('test_multi_shipment_2', Shipments, {
  lane: test_lane_multiple_shipments_id,
  actual: third_complete_actual,
});
Factory.define('test_multi_shipment_3', Shipments, {
  lane: test_lane_multiple_shipments_id,
  actual: second_complete_actual,
});

describe('pages/lanes/lib/util', function () {
  let test_lane_no_shipments;
  let test_lane_one_shipment;
  let test_lane_multiple_shipments;

  before(() => {
    Factory.create('test_one_shipment');
    Factory.create('test_multi_shipment_1');
    Factory.create('test_multi_shipment_2');
    Factory.create('test_multi_shipment_3');
    test_lane_one_shipment = Factory.create('test_one_shipment_lane');
    test_lane_no_shipments = Factory.create('test_no_shipments_lane');
    test_lane_multiple_shipments = Factory.create(
      'test_lane_multiple_shipments'
    );
  });

  describe('#count', function () {
    it('returns the number of shipments found for a lane', () => {
      expect(count(test_lane_one_shipment)).to.eq(1);
      expect(count(test_lane_no_shipments)).to.eq(0);
      expect(count(test_lane_multiple_shipments)).to.eq(3);
      expect(count()).to.eq(0);
    });
  });

  describe('#history', function () {
    it(
      'returns the shipments for a lane sorted descending by date and limited',
      () => {
        const test_limit = 2;
        const test_shipments = history(test_lane_multiple_shipments, test_limit)
          .fetch();
        expect(test_shipments.length).to.eq(2);
        expect(test_shipments[0].actual).to.eq(3);
        expect(test_shipments[1].actual).to.eq(2);
      });
    it('returns false if not given a lane', () => {
      const test_arbitrary_limit = Math.round(Math.random() * 100);
      expect(history()).to.eq(false);
      expect(history(null, test_arbitrary_limit)).to.eq(false);
      expect(history({}, test_arbitrary_limit)).to.eq(false);
    });
  });

  describe('#get_lane', function () {
    let test_session_lane_id;

    before(() => {
      test_session_lane_id = faker.random.uuid();
      H.Session.set('lane', {
        _id: test_session_lane_id,
      });
    });

    it('returns a lane by client Session with id', () => {
      const test_lane_by_session = get_lane(test_session_lane_id);
      expect(test_lane_by_session._id).to.eq(test_session_lane_id);
    });

    it('returns a lane by client Session without id', () => {
      const test_lane_no_arg = get_lane();
      expect(test_lane_no_arg._id).to.eq(test_session_lane_id);
    });

    it('returns an empty object if no lane is found', () => {
      const test_not_found_lane_id = 'non-existant';
      const test_non_existant_lane = get_lane(test_not_found_lane_id);
      expect(_.isEmpty(test_non_existant_lane)).to.eq(true);
    });

    it('returns a lane by name', () => {
      const test_lane_by_name = get_lane('One Shipment');
      expect(test_lane_by_name._id).to.eq(test_lane_one_shipment_id);
    });

    it('returns a lane by slug', () => {
      const test_lane_by_slug = get_lane('one-shipment');
      expect(test_lane_by_slug._id).to.eq(test_lane_one_shipment_id);
    });
  });
});
