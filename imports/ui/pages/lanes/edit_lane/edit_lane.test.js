import { expect } from 'chai';
import _ from 'lodash';
import {
  update_harbor,
  update_harbor_method,
  change_lane_name,
  slug,
  followup_lane,
  salvage_plan_lane,
  lanes,
  lane,
  lane_count,
  shipment_history,
  no_followup,
  no_salvage,
  choose_followup,
  choose_salvage_plan,
  can_ply,
  captain_list,
  harbors,
  current_lane,
  render_harbor,
  validate_done,
  chosen_followup,
  chosen_salvage_plan,
  submit_form,
  change_followup_lane,
  change_salvage_plan,
  change_captains,
  back_to_lanes,
  choose_harbor_type,
  get_lane_name,
  plying,
  lane_type,
  not_found,
  update_lane,
  not_found_text,
  loading_text,
} from './lib';
import { Shipments } from '../../../../api/shipments';
import { Lanes } from '../../../../api/lanes';
import { Users } from '../../../../api/users';
import { Harbors } from '../../../../api/harbors';
import { resetDatabase } from '../../../../test-helpers/reset-database';
import {
  setupInMemoryCollection,
} from '../../../../test-helpers/setup-collection-stubs';

const call_method = H.call;

describe('Edit Lane Page', function () {
  let shipmentsStub;
  let lanesStub;
  let usersStub;
  let harborsStub;

  beforeEach(async function () {
    await resetDatabase();
    shipmentsStub = setupInMemoryCollection(Shipments);
    lanesStub = setupInMemoryCollection(Lanes);
    usersStub = setupInMemoryCollection(Users);
    harborsStub = setupInMemoryCollection(Harbors);
    this.$route = { params: { slug: 'test' } };
  });
  afterEach(() => {
    H.call = call_method;
    if (shipmentsStub) shipmentsStub.restore();
    if (lanesStub) lanesStub.restore();
    if (usersStub) usersStub.restore();
    if (harborsStub) harborsStub.restore();
  });

  describe('#update_harbor', function () {
    it('collects values from the form input objects with a timestamp', () => {
      H.call = () => { };
      const values = update_harbor();
      expect(typeof values.timestamp).to.eq('number');
      expect(values.foo).to.eq('foo');
      expect(values.bar).to.eq('bar');
      expect(values.baz).to.eq(undefined);
      expect(values.qux).to.eq('qux');
    });
    it('updates the saved record for the lane', () => {
      H.Session.set('lane', undefined);
      let called = false;
      H.call = (method, $lane, values) => {
        called = true;
        expect(method).to.eq('Harbors#update');
        expect(_.isEmpty($lane)).to.eq(true);
        expect(Object.keys(values).length).to.eq(5);
      };
      update_harbor();
      expect(called).to.eq(true);
    });
    it('invokes update_harbor_method when call callback runs', function () {
      const ctx = { $route: this.$route, harbor_refresh: 0 };
      const laneFromServer = { _id: 'test', name: 'test' };
      H.Session.set('lane', { _id: 'test', name: 'test' });
      H.Session.set('validating_fields', true);
      H.call = (method, a, b, cb) => {
        if (method === 'Harbors#update') {
          cb(null, { success: true, lane: laneFromServer });
          return;
        }
        if (method === 'Lanes#upsert') {
          // update_harbor_method calls update_lane(), which upserts the lane.
          b(null, a);
          return;
        }
        throw new Error(`Unexpected method: ${method}`);
      };
      const values = update_harbor.bind(ctx)();
      expect(values).to.have.property('timestamp');
      expect(H.Session.get('validating_fields')).to.eq(false);
      expect(ctx.harbor_refresh).to.eq(1);
    });
  });

  describe('#update_harbor_method', function () {
    it('alerts for invalid values', function () {
      let called = false;
      H.alert = () => called = true;
      H.Session.set('validating_fields', true);
      update_harbor_method.bind(this)(null, { success: false });
      expect(called).to.eq(true);
    });
    it('throws if it receives an error', () => {
      const err = new Error();
      expect(() =>
        update_harbor_method.bind({ harbor_refresh: 0 })(err),
      ).to.throw();
    });
    it('updates the Session lane and validation state', function () {
      H.Session.set('lane', false);
      H.Session.set('validating_fields', undefined);
      H.call = (method, $lane, callback) => callback(null, $lane);
      update_harbor_method.bind(this)(null, {
        lane: { name: 'test' },
        success: true,
      });
      expect(H.Session.get('validating_fields')).to.eq(false);
      expect(H.Session.get('lane').name).to.eq('test');
    });
    it('refreshes the harbor view', function () {
      const ctx = { harbor_refresh: 0 };
      H.Session.set('lane', false);
      H.Session.set('validating_fields', false);

      update_harbor_method.bind(ctx)(null, {
        lane: { name: 'test' },
        success: true,
      });
      expect(ctx.harbor_refresh).to.eq(1);
    });
    it('returns the active lane', function () {
      const $lane = update_harbor_method.bind(this)(null, {
        lane: { name: 'test' },
        success: true,
      });
      expect($lane).to.eq(H.Session.get('lane'));
    });
  });

  describe('#update_lane', function () {
    it('saves the lane record with updated values', () => {
      let called = false;
      H.call = (method, $lane, callback) => {
        called = true;
        expect(method).to.eq('Lanes#upsert');
        expect($lane.name).to.eq('test');
        expect(callback).to.not.throw();
      };
      update_lane({ name: 'test' });
      expect(called).to.eq(true);
    });
    it('logs when not in test mode and lane has a name', () => {
      const originalIsTest = H.isTest;
      const originalLog = console.log;
      let logged = '';
      try {
        H.isTest = false;
        console.log = (msg) => { logged = String(msg); };
        H.call = (method, $lane, callback) => {
          expect(method).to.eq('Lanes#upsert');
          callback(null, { _id: 'x', name: 'Logged Lane' });
        };
        update_lane({ _id: 'x', name: 'Logged Lane' });
        expect(logged).to.include('Lane "Logged Lane" updated');
      }
      finally {
        H.isTest = originalIsTest;
        console.log = originalLog;
      }
    });
    it('updates the Session record for the current lane', () => {
      H.call = (method, $lane, callback) => callback(null, $lane);
      const $lane = { name: 'test' };
      update_lane($lane);
      expect(H.Session.get('lane')).to.eq($lane);
    });
    it('returns the response from the update', () => {
      H.call = (method, $lane, callback) => {
        const res = { test: true };
        const result = callback(null, res);
        expect(result).to.eq(res);
      };
      update_lane({ name: 'test' });
    });
  });

  describe('#change_lane_name', function () {
    beforeEach(() => {
      this.$route = {};
      this.$router = [];
      this.$data = {};
      H.Session.set('lane', undefined);
    });
    afterEach(() => {
      H.Session.set('lane', undefined);
      H.call = call_method;
    });

    it('updates the lane with the new name', async function () {
      expect(H.Session.get('lane')).to.eq(undefined);
      const test_event = { target: { value: 'test' } };
      await change_lane_name.bind(this)(test_event);
      expect(H.Session.get('lane').name).to.eq('test');
      lanesStub.insert({ _id: 'test', name: 'test' });
      test_event.target.value = 'test2';
      const $lane = H.Session.get('lane');
      $lane._id = 'test';
      H.call = async (method, updated_lane, callback) => {
        lanesStub.clear();
        lanesStub.insert({ _id: 'test', ...updated_lane });
        callback(null, updated_lane);
      };
      await change_lane_name.bind(this)(test_event);
      const found = await Lanes.findOneAsync('test');
      expect(found.name).to.eq('test2');
    });
    it(
      'sets the updated lane as the active lane in the Session',
      async function () {
        H.Session.set('lane', { name: 'foo', _id: 'test' });
        await change_lane_name.bind(this)({ target: { value: 'bar' } });
        expect(H.Session.get('lane').name).to.eq('bar');
      },
    );
    it('navigates to the new lane edit path', async function () {
      this.$router = [];
      this.$route = { path: '/lanes/old/edit' };
      H.Session.set('lane', { name: 'old', _id: 'test' });
      await change_lane_name.bind(this)({ target: { value: 'baz' } });
      expect(this.$router.length).to.eq(1);
      expect(this.$router[0]).to.eq('/lanes/baz/edit');
    });
    it('does not navigate if already on destination path', async function () {
      this.$router = [];
      this.$route = { path: '/lanes/baz/edit' };
      H.Session.set('lane', { name: 'old', _id: 'test' });
      await change_lane_name.bind(this)({ target: { value: 'baz' } });
      expect(this.$router.length).to.eq(0);
    });
  });

  describe('#slug', function () {
    const $lane = { name: 'Test Lane_' };
    const bogus_lane = { name: '' };
    beforeEach(() => {
      H.Session.set('lane', undefined);
      this.$route = { params: { slug: undefined } };
      lanesStub.clear();
    });
    it('updates a lane with a slug based on its name', async () => {
      expect((/test/i).test(await slug($lane))).to.eq(true);
      expect((/lane/i).test(await slug($lane))).to.eq(true);
    });
    it('returns the slug', async () => {
      const expected_url_regex = /test-lane/;
      const rendered = await slug($lane, true);
      expect(expected_url_regex.test(rendered)).to.eq(true);
    });
    it('returns empty string if the lane has no name yet', async () => {
      expect(await slug(bogus_lane)).to.eq('');
    });
    it('updates the lane when render_only is false', async () => {
      let called = false;
      H.call = (method, laneArg, callback) => {
        if (method === 'Lanes#upsert') {
          called = true;
          callback(null, laneArg);
        }
      };
      const laneToUpdate = { _id: 'x', name: 'Test Lane' };
      await slug(laneToUpdate, false);
      expect(called).to.eq(true);
    });
  });

  describe('#followup_lane', function () {
    beforeEach(() => {
      H.Session.set('lane', undefined);
    });
    afterEach(() => {
      H.Session.set('lane', undefined);
    });
    it('returns false if the lane does not yet exist', async () => {
      this.$route = { params: { slug: 'foo' } };
      expect(await followup_lane.call(this)).to.eq(false);
    });
    it('returns false when $route is missing', async () => {
      delete this.$route;
      H.Session.set('lane', undefined);
      expect(await followup_lane.call(this)).to.eq(false);
    });
    it('returns false when $route has no params', async () => {
      this.$route = {};
      H.Session.set('lane', undefined);
      expect(await followup_lane.call(this)).to.eq(false);
    });
    it('returns the name of the associated followup lane', async () => {
      H.Session.set('lane', { name: 'bar', followup: { name: 'baz' } });
      this.$route = { params: { slug: 'bar' } };
      expect(await followup_lane.call(this)).to.eq(
        H.Session.get('lane').followup.name,
      );
    });
    it('returns empty string if no followup exists', async () => {
      H.Session.set('lane', { name: 'qux' });
      this.$route = { params: { slug: 'qux' } };
      expect(await followup_lane.call(this)).to.eq('');
    });
  });

  describe('#salvage_plan_lane', function () {
    beforeEach(() => {
      H.Session.set('lane', undefined);
    });
    afterEach(() => {
      H.Session.set('lane', undefined);
    });
    it('returns false if the lane does not yet exist', async () => {
      this.$route = { params: { slug: 'foo' } };
      expect(await salvage_plan_lane.call(this)).to.eq(false);
    });
    it('returns false when $route is missing', async () => {
      delete this.$route;
      H.Session.set('lane', undefined);
      expect(await salvage_plan_lane.call(this)).to.eq(false);
    });
    it('returns false when $route has no params', async () => {
      this.$route = {};
      H.Session.set('lane', undefined);
      expect(await salvage_plan_lane.call(this)).to.eq(false);
    });
    it('returns the name of the associated salvage plan lane', async () => {
      H.Session.set('lane', {
        name: 'bar',
        salvage_plan: { name: 'baz' },
      });
      this.$route = { params: { slug: 'bar' } };
      expect(await salvage_plan_lane.call(this)).to.eq(
        H.Session.get('lane').salvage_plan.name,
      );
    });
    it('returns empty string if no salvage plan exists', async () => {
      H.Session.set('lane', { name: 'qux' });
      this.$route = { params: { slug: 'qux' } };
      expect(await salvage_plan_lane.call(this)).to.eq('');
    });
  });

  describe('#lanes', function () {
    it('returns a cursor of lanes sorted by name', () => {
      expect(lanes()._cursorDescription.collectionName).to.eq('Lanes');
      expect(lanes()._cursorDescription.options.sort.name).to.eq(1);
    });
  });

  describe('#lane', function () {
    it('returns the active lane', async function () {
      this.$route = { params: { slug: 'foo' } };
      H.Session.set('lane', { name: 'foo' });
      expect((await lane.call(this)).name).to.eq('foo');
    });
    it('returns empty object when $route has no params', async function () {
      this.$route = {};
      H.Session.set('lane', undefined);
      const result = await lane.call(this);
      expect(result).to.deep.eq({});
    });
    it('returns empty object when $route.params is null', async function () {
      this.$route = { params: null };
      H.Session.set('lane', undefined);
      const result = await lane.call(this);
      expect(result).to.deep.eq({});
    });
    it('returns empty object when slug missing', async function () {
      this.$route = { params: {} };
      H.Session.set('lane', undefined);
      const result = await lane.call(this);
      expect(result).to.deep.eq({});
    });
  });

  describe('#lane_count', function () {
    const test_shipment_count = 2;
    beforeEach(() => {
      for (let i = 0; i < test_shipment_count; i++) {
        shipmentsStub.insert({
          lane: 'foo',
          actual: new Date(),
        });
      }
    });

    it('returns the number of shipments the lane has made', async function () {
      this.$route = { params: { slug: 'foo' } };
      H.Session.set('lane', { _id: 'foo', name: 'foo', slug: 'foo' });
      expect(await lane_count.call(this)).to.eq(test_shipment_count);
    });
    it('returns count when $route is missing', async function () {
      delete this.$route;
      H.Session.set('lane', undefined);
      // Minimongo treats selectors with undefined values as no-op, so this
      // counts all shipments in this test's stubbed collection.
      expect(await lane_count.call(this)).to.eq(test_shipment_count);
    });
    it('returns count when $route has no params', async function () {
      this.$route = {};
      H.Session.set('lane', undefined);
      expect(await lane_count.call(this)).to.eq(test_shipment_count);
    });
  });

  describe('#shipment_history', function () {
    it('returns false if no lane is found', async function () {
      // this.$route = { params: { slug: undefined } };
      H.Session.set('lane', undefined);
      const result = await shipment_history.call(this);
      expect(result).to.eq(false);
    });
    it('returns a cursor of the shipments a lane has made', async function () {
      const $lane = { _id: 'foo', slug: 'foo' };
      this.$route = { params: { slug: 'foo' } };
      H.Session.set('lane', $lane);
      const result = await shipment_history.call(this);
      expect(result._cursorDescription?.collectionName)
        .to.eq('Shipments');
    });
    it('returns false when $route missing and no lane', async function () {
      delete this.$route;
      H.Session.set('lane', undefined);
      expect(await shipment_history.call(this)).to.eq(false);
    });
    it('returns false when route has no params', async function () {
      this.$route = {};
      H.Session.set('lane', undefined);
      expect(await shipment_history.call(this)).to.eq(false);
    });
  });

  describe('#no_followup', function () {
    afterEach(() => {
      H.Session.set('lane', undefined);
      H.Session.set('choose_followup', undefined);
    });

    it('returns the followup lane if it exists', async function () {
      this.$route = { params: { slug: 'foo' } };
      const $lane = { name: 'foo', slug: 'foo', followup: { name: 'bar' } };
      H.Session.set('lane', $lane);
      expect((await no_followup.call(this)).name).to.eq('bar');
    });
    it(
      'returns the choose_followup Session state if it is truthy',
      async function () {
        H.Session.set('lane', { slug: 'test' });
        H.Session.set('choose_followup', true);
        expect(await no_followup.call(this)).to.eq(true);
        H.Session.set('choose_followup', {});
        expect(_.isEmpty(await no_followup.call(this))).to.eq(true);
      });
    it('returns false otherwise', async function () {
      H.Session.set('lane', { slug: 'test' });
      H.Session.set('choose_followup', undefined);
      expect(await no_followup.call(this)).to.eq(false);
    });
    it('works when $route.params is null', async function () {
      this.$route = { params: null };
      const $lane = {
        name: 'foo',
        slug: 'foo',
        followup: { name: 'bar' },
      };
      H.Session.set('lane', $lane);
      expect((await no_followup.call(this)).name).to.eq('bar');
    });
  });

  describe('#no_salvage', function () {
    afterEach(() => {
      H.Session.set('lane', undefined);
      H.Session.set('choose_salvage_plan', undefined);
    });

    it('returns the salvage plan lane if it exists', async function () {
      this.$route = { params: { slug: 'foo' } };
      const $lane = { name: 'foo', slug: 'foo', salvage_plan: { name: 'bar' } };
      H.Session.set('lane', $lane);
      expect((await no_salvage.call(this)).name).to.eq('bar');
    });
    it(
      'returns the choose_salvage_plan Session state if it is truthy',
      async function () {
        H.Session.set('lane', { slug: 'test' });
        H.Session.set('choose_salvage_plan', true);
        expect(await no_salvage.call(this)).to.eq(true);
        H.Session.set('choose_salvage_plan', {});
        expect(_.isEmpty(await no_salvage.call(this))).to.eq(true);
      });
    it('returns false otherwise', async function () {
      H.Session.set('lane', { slug: 'test' });
      H.Session.set('choose_salvage_plan', undefined);
      expect(await no_salvage.call(this)).to.eq(false);
    });
    it('works when $route.params is null', async function () {
      this.$route = { params: null };
      const $lane = {
        name: 'foo',
        slug: 'foo',
        salvage_plan: { name: 'bar' },
      };
      H.Session.set('lane', $lane);
      expect((await no_salvage.call(this)).name).to.eq('bar');
    });
  });

  describe('#choose_followup', function () {

    afterEach(() => {
      H.Session.set('lane', undefined);
      H.Session.set('choose_followup', undefined);
    });
    it(
      'returns the choose_followup session state if truthy',
      async function () {
        H.Session.set('choose_followup', true);
        expect(await choose_followup.call(this)).to.eq(true);
        H.Session.set('choose_followup', {});
        expect(_.isEmpty(await choose_followup.call(this))).to.eq(true);
      },
    );
    it('returns the followup lane if it exists', async function () {
      this.$route = { params: { slug: 'foo' } };
      const $lane = { name: 'foo', followup: { name: 'bar' } };
      H.Session.set('lane', $lane);
      H.Session.set('choose_followup', undefined);
      expect((await choose_followup.call(this)).name)
        .to.eq($lane.followup.name);
    });
    it('works when $route.params is null', async function () {
      this.$route = { params: null };
      const $lane = { name: 'foo', followup: { name: 'bar' } };
      H.Session.set('lane', $lane);
      expect((await choose_followup.call(this)).name).to.eq('bar');
    });
  });

  describe('#choose_salvage_plan', function () {

    afterEach(() => {
      H.Session.set('lane', undefined);
      H.Session.set('choose_salvage_plan', undefined);
    });
    it(
      'returns the choose_salvage_plan session state if truthy',
      async function () {
        H.Session.set('choose_salvage_plan', true);
        expect(await choose_salvage_plan.call(this)).to.eq(true);
        H.Session.set('choose_salvage_plan', {});
        expect(_.isEmpty(await choose_salvage_plan.call(this))).to.eq(true);
      });
    it('returns the salvage plan lane if it exists', async function () {
      this.$route = { params: { slug: 'foo' } };
      const $lane = { name: 'foo', salvage_plan: { name: 'bar' } };
      H.Session.set('lane', $lane);
      H.Session.set('choose_salvage_plan', undefined);
      expect((await choose_salvage_plan.call(this)).name)
        .to.eq($lane.salvage_plan.name);
    });
    it('works when $route.params is null', async function () {
      this.$route = { params: null };
      const $lane = { name: 'foo', salvage_plan: { name: 'bar' } };
      H.Session.set('lane', $lane);
      expect((await choose_salvage_plan.call(this)).name).to.eq('bar');
    });
  });

  describe('#can_ply', function () {
    it('returns true if the user is a harbormaster', () => {
      const user = { harbormaster: true };
      expect(can_ply(user, {})).to.eq(true);
    });
    it('returns true if the user is a captain of the lane', () => {
      const user = { _id: 'test' };
      const $lane = { captains: [user._id] };
      expect(can_ply(user, $lane)).to.eq(true);
    });
    it('returns false otherwise', () => {
      expect(can_ply()).to.eq(false);
      expect(can_ply({}, {})).to.eq(false);
    });
    it('returns false when captains exists but is empty', () => {
      const user = { _id: 'u1' };
      expect(can_ply(user, { captains: [] })).to.eq(false);
    });
    it('returns false when lane is null (optional chaining)', () => {
      const user = { _id: 'u1' };
      expect(can_ply(user, null)).to.eq(false);
    });
    it('returns false when captains is null (optional chaining)', () => {
      const user = { _id: 'u1' };
      expect(can_ply(user, { captains: null })).to.eq(false);
    });
    it('returns false when captains is undefined (optional chaining)', () => {
      const user = { _id: 'u1' };
      expect(can_ply(user, {})).to.eq(false);
    });
    it('returns false when captains does not include the user', () => {
      const user = { _id: 'u1' };
      expect(can_ply(user, { captains: ['u2'] })).to.eq(false);
    });
    it('returns true when captains is non-empty and includes the user', () => {
      const user = { _id: 'u1' };
      expect(can_ply(user, { captains: ['u1'] })).to.eq(true);
    });
  });

  describe('#captain_list', function () {
    const captain = { _id: 'captain@harbormaster.io' };
    beforeEach(() => {
      usersStub.insert({
        _id: 'test@harbormaster.io',
        harbormaster: true,
      });
      usersStub.insert({
        _id: 'captain@harbormaster.io',
      });
      usersStub.insert({
        _id: 'foo@bar.com',
      });
      H.Session.set('lane', { captains: [captain._id] });
    });
    afterEach(() => {
      H.Session.set('lane', undefined);
    });

    it('returns a list of users who can ply the lane', async () => {
      const list1 = await captain_list();
      expect(list1.length).to.eq(3);
      expect(list1[0].can_ply).to.eq(true);
      expect(list1[1].can_ply).to.eq(true);
      expect(list1[2].can_ply).to.eq(false);
      H.Session.set('lane', undefined);
      const list2 = await captain_list();
      expect(list2[0].can_ply).to.eq(true);
      expect(list2[1].can_ply).to.eq(false);
      expect(list2[2].can_ply).to.eq(false);
    });
  });

  describe('#plying', function () {
    let originalUserMethod;

    beforeEach(() => {
      originalUserMethod = H.user;
    });

    afterEach(() => {
      H.Session.set('lane', undefined);
      H.user = originalUserMethod;
    });

    it('returns true if the user is a harbormaster', async () => {
      usersStub.insert({
        _id: 'test@harbormaster.io',
        harbormaster: true,
      });
      expect(await plying()).to.eq(true);
    });
    it('returns true if the current user is a captain', async () => {
      H.Session.set('lane', { captains: ['test@harbormaster.io'] });
      expect(await plying()).to.eq(true);
    });
    it('returns false if currentUserEmail is falsy', async () => {
      H.user = () => null;
      expect(await plying()).to.eq(false);
    });
    it('returns false if user has no email', async () => {
      expect(await plying()).to.eq(false);
    });
    it('returns false if user is null/undefined', async () => {
      expect(await plying()).to.eq(false);
    });
    it('returns false otherwise', async () => {
      H.Session.set('lane', undefined);
      expect(await plying()).to.eq(false);
      H.Session.set('lane', { captains: ['foo@harbormaster.io'] });
      expect(await plying()).to.eq(false);
    });
    it('returns false when user emails has no address', async () => {
      H.user = () => ({ emails: [{}] });
      expect(await plying()).to.eq(false);
    });
    it('returns false when H.user returns undefined', async () => {
      H.user = () => undefined;
      expect(await plying()).to.eq(false);
    });
    it('returns false when H.user emails is null', async () => {
      H.user = () => ({ emails: null });
      expect(await plying()).to.eq(false);
    });
    it('returns false when H.user emails is an empty array', async () => {
      H.user = () => ({ emails: [] });
      expect(await plying()).to.eq(false);
    });
    it('returns false when lane has empty captains array', async () => {
      H.Session.set('lane', { captains: [] });
      expect(await plying()).to.eq(false);
    });
    it('returns false when lane has no captains field', async () => {
      H.Session.set('lane', {});
      expect(await plying()).to.eq(false);
    });
    it('returns false when lane captains is null', async () => {
      H.Session.set('lane', { captains: null });
      expect(await plying()).to.eq(false);
    });
    it('returns false when Session lane is null', async () => {
      H.Session.set('lane', null);
      expect(await plying()).to.eq(false);
    });
  });

  describe('#harbors', function () {
    it('returns a list of registered harbors', async () => {
      expect((await harbors()).length).to.eq(0);
    });
  });

  describe('#current_lane', function () {
    const $lane = { _id: 'test', name: 'test', slug: 'test' };

    beforeEach(() => {
      lanesStub.insert($lane);
    });
    afterEach(function () {
      H.Session.set('lane', undefined);
    });

    it('returns the current lane from Session if found', async function () {
      H.Session.set('lane', $lane);
      expect((await current_lane.call(this))._id).to.eq($lane._id);
    });
    it(
      'returns the current lane from lookup if no Session lane found',
      async function () {
        this.$route = { params: { slug: 'test' } };
        H.Session.set('lane', undefined);
        const result = await current_lane.call(this);
        expect(result._id).to.eq($lane._id);
      },
    );
    it(
      'returns an object matching { "type": false } if no lane found',
      async function () {
        this.$route = { params: { slug: 'bogus' } };
        expect((await current_lane.call(this)).type).to.eq(false);
      },
    );
  });

  describe('#lane_type', function () {
    it(
      'returns the lane type if it exists, otherwise undefined',
      async function () {
        H.Session.set('lane', { type: 'test', slug: 'test' });
        expect(await lane_type.call(this)).to.eq('test');
        H.Session.set('lane', undefined);
        expect(await lane_type.call(this)).to.eq(undefined);
      },
    );
  });

  describe('#render_harbor', function () {
    let called = false;
    const render_harbor_test_method = (method, $lane, manifest, callback) => {
      called = true;
      callback();
    };
    const rendered_input = '<h1>Test</h1>';

    beforeEach(() => {
      harborsStub.insert({
        _id: 'test',
        lanes: {
          test: { manifest: {} },
        },
        rendered_input: rendered_input,
      });
    });

    afterEach(() => {
      H.call = call_method;
    });

    it('returns assign name text if unable to find a lane', async function () {
      H.Session.set('lane', undefined);
      expect(await render_harbor.call(this)).to.eq('Assign a Name first!');
    });
    it('renders input if a harbor manifest is found', async function () {
      H.call = render_harbor_test_method;
      H.Session.set('lane', { _id: 'test', slug: 'test' });
      await render_harbor.call(this);
      expect(called).to.eq(true);
    });
    it('sets not_found on 404 and returns not_found_text', async function () {
      H.call = (method, $lane, manifest, callback) => {
        expect(method).to.eq('Harbors#render_input');
        callback(null, 404);
      };
      not_found.set(false);
      H.Session.set('lane', {
        _id: 'test',
        slug: 'test',
        type: 'test',
      });
      const res = await render_harbor.call(this);
      expect(res).to.eq(not_found_text);
      expect(not_found.get()).to.eq(true);
    });
    it('stores the active lane when server returns one', async function () {
      const activeLane = {
        _id: 'test',
        slug: 'test',
        rendered_input: '<p>x</p>',
      };
      H.call = (method, $lane, manifest, callback) => {
        expect(method).to.eq('Harbors#render_input');
        callback(null, activeLane);
      };
      not_found.set(true);
      H.Session.set('lane', {
        _id: 'test',
        slug: 'test',
        type: 'test',
      });
      await render_harbor.call(this);
      expect(not_found.get()).to.eq(false);
      expect(H.Session.get('lane')).to.eq(activeLane);
    });
    it('returns loading_text when callback yields no lane', async function () {
      H.call = (method, $lane, manifest, callback) => {
        expect(method).to.eq('Harbors#render_input');
        callback(null, null);
      };
      not_found.set(false);
      H.Session.set('lane', {
        _id: 'test',
        slug: 'test',
        type: 'test',
      });
      // Ensure harbor has no rendered_input so we hit loading_text fallback.
      harborsStub.clear();
      harborsStub.insert({
        _id: 'test',
        lanes: { test: { manifest: {} } },
      });
      expect(await render_harbor.call(this)).to.eq(loading_text);
    });
    it('renders not found text if the lane is not found', async function () {
      H.call = render_harbor_test_method;
      H.Session.set('lane', { _id: 'test', slug: 'test' });
      not_found.set(true);
      expect(await render_harbor.call(this)).to.eq(not_found_text);
    });
    it(
      'returns the rendered input for the lane if it exists',
      async function () {
        H.call = render_harbor_test_method;
        not_found.set(false);
        H.Session.set('lane', { _id: 'test', slug: 'test', rendered_input });
        expect(await render_harbor.call(this)).to.eq(rendered_input);
      });
    it(
      'returns the rendered input associated with the harbor',
      async function () {
        H.call = render_harbor_test_method;
        not_found.set(false);
        H.Session.set('lane', { _id: 'test', slug: 'test', type: 'test' });
        expect(await render_harbor.call(this)).to.eq(rendered_input);
      });
    it('returns loading text if no other text is ready', async function () {
      H.call = render_harbor_test_method;
      not_found.set(false);
      H.Session.set('lane', { _id: 'test', slug: 'test' });
      expect(await render_harbor.call(this)).to.eq(loading_text);
    });
  });

  describe('#validate_done', function () {
    it(
      'returns true if the minimum has been completed for the lane',
      async function () {
        H.Session.set('lane', { _id: 'test', minimum_complete: true });
        expect(await validate_done.call(this)).to.eq(true);
      });
    it('returns true when lane is resolved via slug()', async function () {
      lanesStub.insert({
        _id: 'lane1',
        name: 'My Lane',
        slug: 'my-lane',
        minimum_complete: true,
      });
      this.$route = { params: { slug: 'my-lane' } };
      H.Session.set('lane', undefined);
      expect(await validate_done.call(this)).to.eq(true);
    });
    it('returns undefined when route params are missing', async function () {
      this.$route = undefined;
      H.Session.set('lane', undefined);
      expect(await validate_done.call(this)).to.eq(undefined);
    });
    it('returns undefined when $route has no params', async function () {
      this.$route = {};
      H.Session.set('lane', undefined);
      expect(await validate_done.call(this)).to.eq(undefined);
    });
  });

  describe('#chosen_followup', function () {
    it(
      'returns true if the argument is the assigned followup',
      async function () {
        const followup = { _id: 'test_followup' };
        H.Session.set('lane', { _id: 'test', followup });
        expect(await chosen_followup.call(this, followup)).to.eq(true);
        H.Session.set('lane', undefined);
        expect(await chosen_followup.call(this, followup)).to.eq(false);
      });
    it('returns false when followup slug does not match', async function () {
      const followup = { _id: 'f1', slug: 'a' };
      H.Session.set('lane', { _id: 'lane', followup: { slug: 'b' } });
      expect(await chosen_followup.call(this, followup)).to.eq(false);
    });
    it('compares followup slugs from Lanes', async function () {
      const followup = { _id: 'f1', slug: 'f-slug' };
      lanesStub.insert({
        _id: 'lane1',
        name: 'My Lane',
        slug: 'my-lane',
        followup: { slug: 'f-slug' },
      });
      this.$route = { params: { slug: 'my-lane' } };
      H.Session.set('lane', undefined);
      expect(await chosen_followup.call(this, followup)).to.eq(true);
    });
    it('returns false when lane has no followup', async function () {
      const followup = { _id: 'f1', slug: 'f-slug' };
      H.Session.set('lane', { _id: 'lane1', slug: 'lane1' });
      expect(await chosen_followup.call(this, followup)).to.eq(false);
    });
    it('handles $route.params null (optional chaining)', async function () {
      this.$route = { params: null };
      const followup = { _id: 'f1', slug: 'f-slug' };
      H.Session.set('lane', { _id: 'lane1', slug: 'lane1' });
      expect(await chosen_followup.call(this, followup)).to.eq(false);
    });
  });

  describe('#chosen_salvage_plan', function () {
    it(
      'returns true if the argument is the assigned salvage plan',
      async function () {
        const salvage_plan = {
          _id: 'test_salvage_plan',
          slug: 'test_salvage_plan',
        };
        H.Session.set('lane', { _id: 'test', slug: 'test', salvage_plan });
        expect(await chosen_salvage_plan.call(this, salvage_plan)).to.eq(true);
        H.Session.set('lane', undefined);
        expect(await chosen_salvage_plan.call(this, salvage_plan)).to.eq(false);
      });
    it('returns false when salvage slug does not match', async function () {
      const salvage = { _id: 's1', slug: 'a' };
      H.Session.set('lane', {
        _id: 'lane',
        salvage_plan: { slug: 'b' },
      });
      expect(await chosen_salvage_plan.call(this, salvage)).to.eq(false);
    });
    it('resolves lane via Lanes and compares salvage slugs', async function () {
      const salvage = { _id: 's1', slug: 's-slug' };
      lanesStub.insert({
        _id: 'lane1',
        name: 'My Lane',
        slug: 'my-lane',
        salvage_plan: { slug: 's-slug' },
      });
      this.$route = { params: { slug: 'my-lane' } };
      H.Session.set('lane', undefined);
      expect(await chosen_salvage_plan.call(this, salvage)).to.eq(true);
    });
    it('returns false when lane has no salvage_plan', async function () {
      const salvage = { _id: 's1', slug: 's-slug' };
      H.Session.set('lane', { _id: 'lane1', slug: 'lane1' });
      expect(await chosen_salvage_plan.call(this, salvage)).to.eq(false);
    });
    it('handles $route.params null (optional chaining)', async function () {
      this.$route = { params: null };
      const salvage = { _id: 's1', slug: 's-slug' };
      H.Session.set('lane', { _id: 'lane1', slug: 'lane1' });
      expect(await chosen_salvage_plan.call(this, salvage)).to.eq(false);
    });
  });

  describe('#submit_form', function () {
    let called = false;

    afterEach(() => {
      H.call = call_method;
      H.Session.set('lane', undefined);
    });

    it('returns false if no lane can be found', async function () {
      H.Session.set('lane', undefined);
      expect(await submit_form.call(this)).to.eq(false);
    });
    it('returns false when $route has no params', async function () {
      this.$route = {};
      H.Session.set('lane', undefined);
      expect(await submit_form.call(this)).to.eq(false);
    });
    it('sets a lane slug', async function () {
      H.call = () => { called = true; };
      H.Session.set('lane', {
        _id: 'test',
        name: 'test',
        slug: 'test',
        type: 'test',
      });
      await submit_form.call(this);
      expect(called).to.eq(true);
    });
    it('Sets that the lane is validating its fields', async function () {
      H.call = () => { called = true; };
      H.Session.set('validating_fields', false);
      H.Session.set('lane', {
        _id: 'test',
        name: 'test',
        slug: 'test',
        type: 'test',
      });
      await submit_form.call(this);
      expect(H.Session.get('validating_fields', true));
    });
    it('updates and returns the lane values if not new', async function () {
      H.call = () => { called = true; };
      H.Session.set('lane', {
        _id: 'test',
        name: 'test',
        slug: 'test',
        type: 'test',
      });
      expect((await submit_form.call(this)).foo).to.eq('foo');
      expect(typeof (await submit_form.call(this)).timestamp == 'number')
        .to.eq(true);
    });
    it('returns the lane if new, or lacking name or type', async function () {
      this.$route = { params: { slug: 'new' } };
      H.Session.set('lane', {
        _id: 'new',
        name: 'New',
        slug: 'new',
        type: 'new',
      });
      expect((await submit_form.call(this))._id).to.eq('new');
      H.Session.set('lane', {
        _id: 'no_name',
        slug: 'no_name',
        type: 'no_name',
      });
      expect((await submit_form.call(this))._id).to.eq('no_name');
      H.Session.set('lane', {
        _id: 'no_type',
        name: 'no type',
        slug: 'no-type',
      });
      expect((await submit_form.call(this))._id).to.eq('no_type');
    });
  });

  describe('#change_followup_lane', function () {

    afterEach(() => {
      H.Session.set('lane', undefined);
      H.call = call_method;
    });

    it(
      'assigns a new followup lane or null and returns the updated lane',
      async () => {
        const $lane = { _id: 'test', name: 'test', type: 'test' };
        lanesStub.insert({ _id: 'test_followup', slug: 'test_followup' });
        H.Session.set('lane', $lane);
        H.call = (method, laneToUpdate, callback) => {
          if (method === 'Lanes#upsert') {
            callback(null, laneToUpdate);
          }
        };
        expect(
          await change_followup_lane.bind(this)({
            target: { value: 'test_followup' },
          }),
        ).to.eq($lane);
        expect(
          await change_followup_lane.bind(this)({
            target: { value: 'test_followup' },
          }),
        ).to.eq($lane);
      });
    it('returns false if no update is made', async () => {
      H.Session.set('lane', { _id: 'test_no_update' });
      expect(
        await change_followup_lane.bind(this)({ target: { value: 'test' } }),
      ).to.eq(false);
    });
    it('returns false if lane is New or missing type', async () => {
      H.Session.set('lane', { _id: 'x', name: 'New', type: 'test' });
      expect(
        await change_followup_lane.bind(this)({ target: { value: 'test' } }),
      ).to.eq(false);
      H.Session.set('lane', { _id: 'x', name: 'test' });
      expect(
        await change_followup_lane.bind(this)({ target: { value: 'test' } }),
      ).to.eq(false);
    });
    it('sets followup to null when no matching lane is found', async () => {
      const $lane = { _id: 'test', name: 'test', type: 'test' };
      H.Session.set('lane', $lane);
      H.call = (method, laneToUpdate, callback) => {
        if (method === 'Lanes#upsert') {
          callback(null, laneToUpdate);
        }
      };
      await change_followup_lane.bind(this)({
        target: { value: 'nonexistent_lane' },
      });
      expect($lane.followup).to.eq(null);
    });
    it('updates when $route has no params (optional chaining)', async () => {
      const $lane = { _id: 'test', name: 'test', type: 'test' };
      this.$route = {};
      H.Session.set('lane', $lane);
      H.call = (method, laneToUpdate, callback) => {
        if (method === 'Lanes#upsert') callback(null, laneToUpdate);
      };
      const result = await change_followup_lane.call(this, { target: {} });
      expect(result).to.eq($lane);
    });
    it('updates when $route.params is null (optional chaining)', async () => {
      const $lane = { _id: 'test', name: 'test', type: 'test' };
      this.$route = { params: null };
      H.Session.set('lane', $lane);
      H.call = (method, laneToUpdate, callback) => {
        if (method === 'Lanes#upsert') callback(null, laneToUpdate);
      };
      const result = await change_followup_lane.call(this, { target: {} });
      expect(result).to.eq($lane);
    });
    it('updates when $route.params exists but slug is missing', async () => {
      const $lane = { _id: 'test', name: 'test', type: 'test' };
      this.$route = { params: {} };
      H.Session.set('lane', $lane);
      H.call = (method, laneToUpdate, callback) => {
        if (method === 'Lanes#upsert') callback(null, laneToUpdate);
      };
      const result = await change_followup_lane.call(this, { target: {} });
      expect(result).to.eq($lane);
    });
  });

  describe('#change_salvage_plan', function () {
    afterEach(() => {
      H.Session.set('lane', undefined);
      H.call = call_method;
    });
    it(
      'assigns a new salvage plan lane or null and returns the updated lane',
      async () => {
        const $lane = { _id: 'test', name: 'test', type: 'test' };
        lanesStub.insert({ _id: 'test_salvage', slug: 'test_salvage' });
        H.Session.set('lane', $lane);
        H.call = (method, laneToUpdate, callback) => {
          if (method === 'Lanes#upsert') {
            callback(null, laneToUpdate);
          }
        };
        expect(
          await change_salvage_plan.bind(this)({
            target: { value: 'test_salvage' },
          }),
        ).to.eq($lane);
        expect(
          await change_salvage_plan.bind(this)({
            target: { value: 'test_salvage' },
          }),
        ).to.eq($lane);
      },
    );
    it('returns false if no update is made', async () => {
      H.Session.set('lane', { _id: 'test_no_update' });
      expect(
        await change_salvage_plan.bind(this)({ target: { value: 'test' } }),
      ).to.eq(false);
    });
    it('sets salvage_plan to null when no matching lane is found', async () => {
      const $lane = { _id: 'test', name: 'test', type: 'test' };
      H.Session.set('lane', $lane);
      H.call = (method, laneToUpdate, callback) => {
        if (method === 'Lanes#upsert') {
          callback(null, laneToUpdate);
        }
      };
      await change_salvage_plan.bind(this)({
        target: { value: 'nonexistent_lane' },
      });
      expect($lane.salvage_plan).to.eq(null);
    });
    it('returns false if lane is New or missing type', async () => {
      H.Session.set('lane', { _id: 'x', name: 'New', type: 'test' });
      expect(
        await change_salvage_plan.bind(this)({ target: { value: 'test' } }),
      ).to.eq(false);
      H.Session.set('lane', { _id: 'x', name: 'test' });
      expect(
        await change_salvage_plan.bind(this)({ target: { value: 'test' } }),
      ).to.eq(false);
    });
    it('does not throw when event is missing (optional chaining)', async () => {
      const $lane = { _id: 'test', name: 'test', type: 'test' };
      H.Session.set('lane', $lane);
      H.call = (method, laneToUpdate, callback) => {
        if (method === 'Lanes#upsert') callback(null, laneToUpdate);
      };
      expect(() => change_salvage_plan.call(this)).to.not.throw();
    });
    it('sets salvage_plan to null when event has no target', async () => {
      const $lane = { _id: 'test', name: 'test', type: 'test' };
      this.$route = {};
      H.Session.set('lane', $lane);
      H.call = (method, laneToUpdate, callback) => {
        if (method === 'Lanes#upsert') callback(null, laneToUpdate);
      };
      await change_salvage_plan.call(this, {});
      expect($lane.salvage_plan).to.eq(null);
    });
    it('sets salvage_plan to null when $route.params is null', async () => {
      const $lane = { _id: 'test', name: 'test', type: 'test' };
      this.$route = { params: null };
      H.Session.set('lane', $lane);
      H.call = (method, laneToUpdate, callback) => {
        if (method === 'Lanes#upsert') callback(null, laneToUpdate);
      };
      await change_salvage_plan.call(this, {});
      expect($lane.salvage_plan).to.eq(null);
    });
    it('sets salvage_plan to null when slug is missing', async () => {
      const $lane = { _id: 'test', name: 'test', type: 'test' };
      this.$route = { params: {} };
      H.Session.set('lane', $lane);
      H.call = (method, laneToUpdate, callback) => {
        if (method === 'Lanes#upsert') callback(null, laneToUpdate);
      };
      await change_salvage_plan.call(this, {});
      expect($lane.salvage_plan).to.eq(null);
    });
  });

  describe('#change_captains', function () {
    let originalCall;
    beforeEach(() => {
      originalCall = H.call;
      H.call = (name, lane_to_update) => {
        H.Session.set('lane', lane_to_update);
      };
    });
    afterEach(() => {
      H.call = originalCall;
      H.Session.set('lane', undefined);
    });
    it(
      'updates the list of captains based on the event data given',
      async () => {
        const $lane = {
          _id: 'test',
          name: 'test',
          type: 'test',
          captains: ['test'],
        };
        lanesStub.insert($lane);
        H.Session.set('lane', $lane);
        await change_captains.bind(this)({
          target: { value: 'test_added_captain', checked: true },
        });
        expect(H.Session.get('lane').captains.length).to.eq(2);
        delete $lane.captains;
        H.Session.set('lane', $lane);
        await change_captains.bind(this)({
          target: { value: 'test_added_captain', checked: false },
        });
        expect(H.Session.get('lane').captains.length).to.eq(0);
      });
    it('removes a captain when unchecked', async () => {
      const $lane = {
        _id: 'test',
        name: 'test',
        type: 'test',
        captains: ['a', 'b', 'c'],
      };
      lanesStub.insert($lane);
      H.Session.set('lane', $lane);
      await change_captains.bind(this)({
        target: { value: 'b', checked: false },
      });
      const updated = H.Session.get('lane');
      expect(updated.captains).to.deep.eq(['a', 'c']);
    });
    it('does not throw when event is missing (optional chaining)', async () => {
      const $lane = {
        _id: 'test',
        name: 'test',
        type: 'test',
        captains: ['a'],
      };
      lanesStub.insert($lane);
      H.Session.set('lane', $lane);
      expect(() => change_captains.call(this)).to.not.throw();
    });
    it('does not throw when event has no target', async () => {
      const $lane = {
        _id: 'test',
        name: 'test',
        type: 'test',
        captains: ['a'],
      };
      lanesStub.insert($lane);
      H.Session.set('lane', $lane);
      expect(() => change_captains.call(this, {})).to.not.throw();
    });
    it('does not throw when $route.params is null', async () => {
      this.$route = { params: null };
      const $lane = {
        _id: 'test',
        name: 'test',
        type: 'test',
        captains: ['a'],
      };
      lanesStub.insert($lane);
      H.Session.set('lane', $lane);
      expect(() => change_captains.call(this, {})).to.not.throw();
    });
    it('does not throw when slug is missing', async () => {
      this.$route = { params: {} };
      const $lane = {
        _id: 'test',
        name: 'test',
        type: 'test',
        captains: ['a'],
      };
      lanesStub.insert($lane);
      H.Session.set('lane', $lane);
      expect(() => change_captains.call(this, {})).to.not.throw();
    });
  });

  describe('#back_to_lanes', function () {
    it('clears the active lane in the Session', () => {
      H.Session.set('lanes', { _id: 'test' });
      this.$router = [];
      back_to_lanes.bind(this)();
      expect(H.Session.get('lane')).to.eq(undefined);
    });
    it('navigates to the Lanes Page', () => {
      H.Session.set('lanes', { _id: 'test' });
      this.$router = [];
      back_to_lanes.bind(this)();
      expect(this.$router[0]).to.eq('/lanes');
    });
    it('does not throw when $router is missing', () => {
      expect(() => back_to_lanes.call({})).to.not.throw();
    });
  });

  describe('#choose_harbor_type', function () {
    it('returns false if no lane can be found', () => {
      H.Session.set('lane', undefined);
      expect(choose_harbor_type()).to.eq(false);
    });
    it('sets the lane type to the type given', () => {
      H.call = (method, $lane, callback) => callback();
      H.Session.set('lane', { _id: 'test' });
      choose_harbor_type();
      expect(H.Session.get('lane').type).to.eq('test_type');
      H.call = call_method;
    });
    it('updates the lane slug and returns true', () => {
      H.call = (method, $lane, callback) => callback(null, $lane);
      H.Session.set('lane', { _id: 'test', name: 'test' });
      expect(choose_harbor_type()).to.eq(true);
      expect(H.Session.get('lane').slug).to.eq('test');
      H.call = call_method;
    });
  });

  describe('#get_lane_name', function () {
    it('sets the active session lane', async function () {
      lanesStub.insert({ _id: 'test', name: 'test', slug: 'test' });
      this.$route = { params: { slug: 'test' } };
      await get_lane_name.call(this);
      const $lane = H.Session.get('lane');
      expect($lane).to.not.be.undefined;
      expect($lane.name).to.eq('test');
    });
    it(
      'returns the lane name or an empty string if lane is new',
      async function () {
        lanesStub.insert({
          _id: 'test',
          name: 'test',
          slug: 'test',
        });
        this.$route = { params: { slug: 'test' } };
        expect(await get_lane_name.call(this)).to.eq('test');

        this.$route = { params: { slug: 'new' } };
        H.Session.set('lane', { name: 'New' });
        expect(await get_lane_name.call(this)).to.eq('');
      });
    it('returns empty string when $route missing', async function () {
      this.$route = undefined;
      H.Session.set('lane', undefined);
      expect(await get_lane_name.call(this)).to.eq('');
    });
  });
});

