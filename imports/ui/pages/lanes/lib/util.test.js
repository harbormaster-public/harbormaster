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
import { resetDatabase } from '../../../../test-helpers/reset-database';
import {
  setupInMemoryCollection,
} from '../../../../test-helpers/setup-collection-stubs';
const { expect } = chai;

const test_lane_one_shipment_id = faker.random.uuid();
const test_lane_no_shipments_id = faker.random.uuid();
const test_lane_multiple_shipments_id = faker.random.uuid();
const first_complete_actual = 1;
const second_complete_actual = 2;
const third_complete_actual = 3;

describe('pages/lanes/lib/util', function () {
  let test_lane_no_shipments;
  let test_lane_one_shipment;
  let test_lane_multiple_shipments;
  let lanesStub;
  let shipmentsStub;

  before(async () => {
    await resetDatabase();
    lanesStub = setupInMemoryCollection(Lanes);
    shipmentsStub = setupInMemoryCollection(Shipments);

    shipmentsStub.insert({ lane: test_lane_one_shipment_id });
    shipmentsStub.insert({
      lane: test_lane_multiple_shipments_id, actual: first_complete_actual,
    });
    shipmentsStub.insert({
      lane: test_lane_multiple_shipments_id, actual: third_complete_actual,
    });
    shipmentsStub.insert({
      lane: test_lane_multiple_shipments_id, actual: second_complete_actual,
    });

    lanesStub.insert({
      _id: test_lane_one_shipment_id,
      name: 'One Shipment',
      slug: 'one-shipment',
    });
    lanesStub.insert({
      _id: test_lane_no_shipments_id,
    });
    lanesStub.insert({
      _id: test_lane_multiple_shipments_id,
    });
    test_lane_one_shipment = await Lanes.findOneAsync(
      test_lane_one_shipment_id,
    );
    test_lane_no_shipments = await Lanes.findOneAsync(
      test_lane_no_shipments_id,
    );
    test_lane_multiple_shipments = await Lanes.findOneAsync(
      test_lane_multiple_shipments_id,
    );
  });

  after(() => {
    if (lanesStub) lanesStub.restore();
    if (shipmentsStub) shipmentsStub.restore();
  });

  describe('#count', function () {
    it('returns the number of shipments found for a lane', async () => {
      expect(await count(test_lane_one_shipment)).to.eq(1);
      expect(await count(test_lane_no_shipments)).to.eq(0);
      expect(await count(test_lane_multiple_shipments)).to.eq(3);
      expect(await count()).to.eq(0);
    });
  });

  describe('#history', function () {
    it(
      'returns the shipments for a lane sorted descending by date and limited',
      async () => {
        const test_limit = 2;
        const test_shipments = await history(
          test_lane_multiple_shipments,
          test_limit,
        ).fetchAsync();
        expect(test_shipments.length).to.eq(2);
        expect(test_shipments[0].actual).to.eq(3);
        expect(test_shipments[1].actual).to.eq(2);
      });
    it('returns false if not given a lane', async () => {
      const test_arbitrary_limit = Math.round(Math.random() * 100);
      expect(history()).to.eq(false);
      expect(history(null, test_arbitrary_limit)).to.eq(false);
      expect(history({}, test_arbitrary_limit)).to.eq(false);
    });
  });

  describe('#get_lane', function () {
    let test_session_lane_id;

    beforeEach(() => {
      test_session_lane_id = faker.random.uuid();
      H.Session.set('lane', {
        _id: test_session_lane_id,
      });
    });

    afterEach(() => {
      H.Session.set('lane', undefined);
    });

    it('returns a lane by client Session with id', async () => {
      const test_lane_by_session = await get_lane(test_session_lane_id);
      expect(test_lane_by_session._id).to.eq(test_session_lane_id);
    });

    it('returns a lane by client Session without id', async () => {
      const test_lane_no_arg = await get_lane();
      expect(test_lane_no_arg._id).to.eq(test_session_lane_id);
    });

    it('returns an empty object if no lane is found', async () => {
      H.Session.set('lane', undefined);
      const test_not_found_lane_id = 'non-existant';
      const test_non_existant_lane = await get_lane(test_not_found_lane_id);
      expect(_.isEmpty(test_non_existant_lane)).to.eq(true);
    });

    it('returns a lane by name', async () => {
      H.Session.set('lane', undefined);
      const test_lane_by_name = await get_lane('One Shipment');
      expect(test_lane_by_name._id).to.eq(test_lane_one_shipment_id);
    });

    it('returns a lane by slug', async () => {
      H.Session.set('lane', undefined);
      const test_lane_by_slug = await get_lane('one-shipment');
      expect(test_lane_by_slug._id).to.eq(test_lane_one_shipment_id);
    });
  });
});
