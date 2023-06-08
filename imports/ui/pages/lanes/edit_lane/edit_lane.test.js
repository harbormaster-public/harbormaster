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

const call_method = H.call;
const lanes_find = Lanes.find;
const lanes_find_one = Lanes.findOne;
const users_find = Users.find;
const users_find_one = Users.findOne;
const harbors_find_one = Harbors.findOne;

describe('Edit Lane Page', function () {
  afterEach(() => {
    H.call = call_method;
  });

  describe('#update_harbor', function () {
    it('collects values from the form input objects with a timestamp', () => {
      H.call = () => { };
      const values = update_harbor();
      expect(typeof values.timestamp).to.eq('number');
      expect(values['foo']).to.eq('foo');
      expect(values['bar']).to.eq('bar');
      expect(values['baz']).to.eq(undefined);
      expect(values['qux']).to.eq('qux');
    });
    it('updates the saved record for the lane', () => {
      let called = false;
      H.call = (method, $lane, values, callback) => {
        called = true;
        expect(method).to.eq('Harbors#update');
        expect(_.isEmpty($lane)).to.eq(true);
        expect(Object.keys(values).length).to.eq(5);
        expect(callback.toString()).to.eq(
          (() => update_harbor_method.bind(this)()).toString()
        );
      };
      update_harbor();
      expect(called).to.eq(true);
    });
  });

  describe('#update_harbor_method', () => {
    it('alerts for invalid values', () => {
      let called = false;
      H.alert = () => called = true;
      H.Session.set('validating_fields', true);
      update_harbor_method(null, { success: false });
      expect(called).to.eq(true);
    });
    it('throws if it receives an error', () => {
      const err = new Error();
      expect(() => update_harbor_method(err)).to.throw();
    });
    it('updates the Session lane and validation state', () => {
      H.Session.set('lane', false);
      H.Session.set('validating_fields', false);
      update_harbor_method(null, {
        lane: { name: 'test' },
        success: true,
      });
      expect(H.Session.get('validating_fields')).to.eq(false);
    });
    it('refreshes the harbor view', () => {
      H.Session.set('lane', false);
      H.Session.set('validating_fields', false);
      this.harbor_refresh = 0;

      update_harbor_method.bind(this)(null, {
        lane: { name: 'test' },
        success: true,
      });
      expect(this.harbor_refresh).to.eq(1);
    });
    it('returns the active lane', () => {
      const $lane = update_harbor_method(null, {
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
    it('updates the Session record for the current lane', () => {
      H.call = (method, $lane, callback) => callback(null, true);
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
      H.Session.set('lane', undefined);
    });

    it('updates the lane with the new name', () => {
      expect(H.Session.get('lane')).to.eq(false);
      const test_event = { target: { value: 'test' } };
      change_lane_name.bind(this)(test_event);
      expect(H.Session.get('lane').name).to.eq('test');
    });
    it('sets the updated lane as the active lane in the Session', () => {
      H.Session.set('lane', { name: 'foo' });
      change_lane_name.bind(this)({ target: { value: 'bar' } });
      expect(H.Session.get('lane').name).to.eq('bar');
    });
    it('navigates to the edit path for the new lane', () => {
      change_lane_name.bind(this)({ target: { value: 'baz' } });
      expect(this.$router.length).to.eq(1);
      expect(this.$router[0]).to.eq('/lanes/baz/edit');
    });
  });

  describe('#slug', function () {
    const $lane = { name: 'Test Lane' };
    const bogus_lane = { name: '' };
    it('updates a lane with a slug based on its name', () => {
      expect((/test/i).test(slug($lane))).to.eq(true);
      expect((/lane/i).test(slug($lane))).to.eq(true);
    });
    it('returns the slug url', () => {
      const expected_url_regex = /localhost:4040\/lanes\/test-lane\/ship/;
      expect(expected_url_regex.test(slug($lane))).to.eq(true);
    });
    it('returns empty string if the lane has no name yet', () => {
      expect(slug(bogus_lane)).to.eq('');
    });
  });

  describe('#followup_lane', function () {
    before(() => {
      H.Session.set('lane', undefined);
    });
    it('returns false if the lane does not yet exist', () => {
      this.$route = { params: { slug: 'foo' } };
      expect(followup_lane.bind(this)()).to.eq(false);
    });
    it('returns the name of the associated followup lane', () => {
      H.Session.set('lane', { name: 'bar', followup: { name: 'baz' } });
      this.$route = { params: { slug: 'bar' } };
      expect(followup_lane.bind(this)()).to.eq(
        H.Session.get('lane').followup.name
      );
    });
    it('returns empty string if no followup exists', () => {
      H.Session.set('lane', { name: 'qux' });
      this.$route = { params: { slug: 'qux' } };
      expect(followup_lane.bind(this)()).to.eq('');
    });
  });

  describe('#salvage_plan_lane', function () {
    before(() => {
      H.Session.set('lane', undefined);
    });
    it('returns false if the lane does not yet exist', () => {
      this.$route = { params: { slug: 'foo' } };
      expect(salvage_plan_lane.bind(this)()).to.eq(false);
    });
    it('returns the name of the associated salvage plan lane', () => {
      H.Session.set('lane', { name: 'bar', salvage_plan: { name: 'baz' } });
      this.$route = { params: { slug: 'bar' } };
      expect(salvage_plan_lane.bind(this)()).to.eq(
        H.Session.get('lane').salvage_plan.name
      );
    });
    it('returns empty string if no salvage plan exists', () => {
      H.Session.set('lane', { name: 'qux' });
      this.$route = { params: { slug: 'qux' } };
      expect(salvage_plan_lane.bind(this)()).to.eq('');
    });
  });

  describe('#lanes', function () {
    it('returns a cursor of lanes sorted by name', () => {
      expect(lanes()._cursorDescription.collectionName).to.eq('Lanes');
      expect(lanes()._cursorDescription.options.sort.name).to.eq(1);
    });
  });

  describe('#lane', function () {
    it('returns the active lane', () => {
      H.Session.set('lane', { name: 'foo' });
      expect(lane().name).to.eq('foo');
    });
  });

  describe('#lane_count', function () {
    let shipments_find = Shipments.find;
    const test_shipment_count = 2;

    before(() => {
      Shipments.find = () => ({ count: () => test_shipment_count });
    });

    after(() => {
      Shipments.find = shipments_find;
    });

    it('returns the number of shipments the lane has made', () => {
      H.Session.set('lane', { name: 'foo' });
      expect(lane_count()).to.eq(test_shipment_count);
    });
  });

  describe('#shipment_history', function () {
    it('returns false if no lane is found', () => {
      expect(shipment_history()).to.eq(false);
    });
    it('returns a cursor of the shipments a lane has made', () => {
      const $lane = { _id: 'foo' };
      H.Session.set('lane', $lane);
      expect(shipment_history()._cursorDescription.collectionName)
        .to.eq('Shipments');
    });
  });

  describe('#no_followup', function () {
    afterEach(() => { Lanes.find = lanes_find; });

    it('returns true if there are fewer than 2 lanes', () => {
      Lanes.find = () => ({ count: () => 1 });
      expect(no_followup()).to.eq(true);
    });
    it('returns the followup lane if it exists', () => {
      Lanes.find = () => ({ count: () => 2 });
      const $lane = { name: 'foo', followup: { name: 'bar' } };
      H.Session.set('lane', $lane);
      expect(no_followup().name).to.eq($lane.followup.name);
    });
    it('returns the choose_followup Session state if it is truthy', () => {
      Lanes.find = () => ({ count: () => 3 });
      H.Session.set('lane', undefined);
      H.Session.set('choose_followup', true);
      expect(no_followup()).to.eq(true);
      H.Session.set('choose_followup', {});
      expect(_.isEmpty(no_followup())).to.eq(true);
    });
    it('returns false otherwise', () => {
      Lanes.find = () => ({ count: () => 2 });
      H.Session.set('lane', undefined);
      H.Session.set('choose_followup', undefined);
      expect(no_followup()).to.eq(false);
    });
  });

  describe('#no_salvage', function () {
    afterEach(() => { Lanes.find = lanes_find; });

    it('returns true if there are fewer than 2 lanes', () => {
      Lanes.find = () => ({ count: () => 1 });
      expect(no_salvage()).to.eq(true);
    });
    it('returns the salvage plan lane if it exists', () => {
      Lanes.find = () => ({ count: () => 2 });
      const $lane = { name: 'foo', salvage_plan: { name: 'bar' } };
      H.Session.set('lane', $lane);
      expect(no_salvage().name).to.eq($lane.salvage_plan.name);
    });
    it('returns the choose_salvage_plan Session state if it is truthy', () => {
      Lanes.find = () => ({ count: () => 3 });
      H.Session.set('lane', undefined);
      H.Session.set('choose_salvage_plan', true);
      expect(no_salvage()).to.eq(true);
      H.Session.set('choose_salvage_plan', {});
      expect(_.isEmpty(no_salvage())).to.eq(true);
    });
    it('returns false otherwise', () => {
      Lanes.find = () => ({ count: () => 2 });
      H.Session.set('lane', undefined);
      H.Session.set('choose_salvage_plan', undefined);
      expect(no_salvage()).to.eq(false);
    });
  });

  describe('#choose_followup', function () {
    it('returns the choose_followup session state if truthy', () => {
      H.Session.set('choose_followup', true);
      expect(choose_followup()).to.eq(true);
      H.Session.set('choose_followup', {});
      expect(_.isEmpty(choose_followup())).to.eq(true);
    });
    it('returns the followup lane if it exists', () => {
      Lanes.find = () => ({ count: () => 2 });
      const $lane = { name: 'foo', followup: { name: 'bar' } };
      H.Session.set('lane', $lane);
      H.Session.set('choose_followup', undefined);
      expect(choose_followup().name).to.eq($lane.followup.name);
    });
    after(() => Lanes.find = lanes_find);
  });

  describe('#choose_salvage_plan', function () {
    it('returns the choose_salvage_plan session state if truthy', () => {
      H.Session.set('choose_salvage_plan', true);
      expect(choose_salvage_plan()).to.eq(true);
      H.Session.set('choose_salvage_plan', {});
      expect(_.isEmpty(choose_salvage_plan())).to.eq(true);
    });
    it('returns the salvage plan lane if it exists', () => {
      Lanes.find = () => ({ count: () => 2 });
      const $lane = { name: 'foo', salvage_plan: { name: 'bar' } };
      H.Session.set('lane', $lane);
      H.Session.set('choose_salvage_plan', undefined);
      expect(choose_salvage_plan().name).to.eq($lane.salvage_plan.name);
    });
    after(() => Lanes.find = lanes_find);
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
  });

  describe('#captain_list', function () {
    const harbormaster = { harbormaster: true };
    const captain = { _id: 'captain' };
    const user = { _id: 'user' };
    before(() => {
      Users.find = () => ({ fetch: () => [harbormaster, captain, user] });
      H.Session.set('lane', { captains: [captain._id] });
      Users.findOne = () => harbormaster;
    });
    after(() => {
      Users.find = users_find;
      H.Session.set('lane', undefined);
      Users.findOne = users_find_one;
    });

    it('returns a list of users who can ply the lane', () => {
      const list = captain_list();
      expect(list.length).to.eq(3);
      expect(list[0].can_ply).to.eq(true);
      expect(list[1].can_ply).to.eq(true);
      expect(list[2].can_ply).to.eq(false);
    });
  });

  describe('#plying', function () {
    before(() => {
      H.user = () => ({ emails: [{ address: 'test@harbormaster.io' } ] });
    });
    it('returns true if the user is a harbormaster', () => {
      Users.findOne = () => ({ harbormaster: true });
      expect(plying()).to.eq(true);
    });
    it('returns true if the current user is a captain', () => {
      H.Session.set('lane', { captains: ['test@harbormaster.io'] });
      expect(plying()).to.eq(true);
    });
    it('returns false otherwise', () => {
      H.Session.set('lane', undefined);
      Users.findOne = () => ({});
      expect(plying()).to.eq(false);
    });
    after(() => {
      Users.findOne = users_find_one;
      H.user = Meteor.user;
    });
  });

  describe('#harbors', function () {
    it('returns a list of registered harbors', () => {
      expect(harbors().length).to.eq(0);
    });
  });

  describe('#current_lane', function () {
    const $lane = { _id: 'test', name: 'test', slug: 'test' };
    this.$route = { params: { slug: 'test' } };

    it('returns the current lane from Session if found', () => {
      H.Session.set('lane', $lane);
      expect(current_lane()._id).to.eq($lane._id);
    });
    it('returns the current lane from lookup if no Session lane found', () => {
      H.Session.set('lane', undefined);
      Lanes.findOne = () => $lane;
      expect(current_lane.bind(this)()._id).to.eq($lane._id);
    });
    it('returns an object matching { "type": false } if no lane found', () => {
      Lanes.findOne = () => false;
      expect(current_lane.bind(this)().type).to.eq(false);
    });
    after(() => Lanes.findOne = lanes_find_one);
  });

  describe('#lane_type', function () {
    it('returns the lane type if it exists, otherwise undefined', () => {
      H.Session.set('lane', { type: 'test' });
      expect(lane_type()).to.eq('test');
      H.Session.set('lane', undefined);
      expect(lane_type()).to.eq(undefined);
    });
  });

  describe('#render_harbor', function () {
    let called = false;
    const render_harbor_test_method = (method, $lane, manifest, callback) => {
      called = true;
      callback();
    };
    const rendered_input = '<h1>Test</h1>';

    before(() => {
      Harbors.findOne = () => {
        return {
          lanes: { test: { foo: { manifest: { bar: true } } } },
          rendered_input,
        };
      };
    });

    after(() => {
      H.call = call_method;
      Harbors.findOne = harbors_find_one;
    });

    it('returns false if unable to find a lane', () => {
      expect(render_harbor()).to.eq(false);
    });
    it('renders input if a harbor manifest is found', () => {
      H.call = render_harbor_test_method;
      H.Session.set('lane', { _id: 'test' });
      render_harbor();
      expect(called).to.eq(true);
    });
    it('renders not found text if the lane is not found', () => {
      H.call = render_harbor_test_method;
      not_found.set(true);
      expect(render_harbor()).to.eq(not_found_text);
    });
    it('returns the rendered input for the lane if it exists', () => {
      H.call = render_harbor_test_method;
      not_found.set(false);
      H.Session.set('lane', { _id: 'test', rendered_input });
      expect(render_harbor()).to.eq(rendered_input);
    });
    it('returns the rendered input associated with the harbor', () => {
      H.call = render_harbor_test_method;
      not_found.set(false);
      H.Session.set('lane', { _id: 'test', type: 'test' });
      expect(render_harbor()).to.eq(rendered_input);
    });
    it('returns loading text if no other text is ready', () => {
      H.call = render_harbor_test_method;
      not_found.set(false);
      H.Session.set('lane', { _id: 'test' });
      expect(render_harbor()).to.eq(loading_text);
    });
  });

  describe('#validate_done', function () {
    it('returns true if the minimum has been completed for the lane', () => {
      H.Session.set('lane', { _id: 'test', minimum_complete: true });
      expect(validate_done()).to.eq(true);
    });
  });

  describe('#chosen_followup', function () {
    it('returns true if the argument is the assigned followup', () => {
      const followup = { _id: 'test_followup' };
      H.Session.set('lane', { _id: 'test', followup });
      expect(chosen_followup(followup)).to.eq(true);
    });
  });

  describe('#chosen_salvage_plan', function () {
    it('returns true if the argument is the assigned salvage plan', () => {
      const salvage_plan = { _id: 'test_salvage_plan' };
      H.Session.set('lane', { _id: 'test', salvage_plan });
      expect(chosen_salvage_plan(salvage_plan)).to.eq(true);
    });
  });

  describe('#submit_form', function () {
    let called = false;

    after(() => { H.call = call_method; });

    it('returns false if no lane can be found', () => {
      H.Session.set('lane', undefined);
      expect(submit_form()).to.eq(false);
    });
    it('sets a lane slug', () => {
      H.call = () => { called = true; };
      H.Session.set('lane', { _id: 'test', name: 'test', type: 'test' });
      submit_form();
      expect(called).to.eq(true);
    });
    it('Sets that the lane is validating its fields', () => {
      H.call = () => { called = true; };
      H.Session.set('validating_fields', false);
      H.Session.set('lane', { _id: 'test', name: 'test', type: 'test' });
      submit_form();
      expect(H.Session.get('validating_fields', true));
    });
    it('updates and returns the lane values if not new', () => {
      H.call = () => { called = true; };
      H.Session.set('lane', { _id: 'test', name: 'test', type: 'test' });
      expect(submit_form().foo).to.eq('foo');
      expect(typeof submit_form().timestamp == 'number').to.eq(true);
    });
    it('returns the lane if new, or lacking name or type', () => {
      H.Session.set('lane', { _id: 'new', name: 'New', type: 'new' });
      expect(submit_form()._id).to.eq('new');
      H.Session.set('lane', { _id: 'no_name', type: 'no_name' });
      expect(submit_form()._id).to.eq('no_name');
      H.Session.set('lane', { _id: 'no_type', name: 'no type' });
      expect(submit_form()._id).to.eq('no_type');
    });
  });

  describe('#change_followup_lane', function () {
    before(() => {
      Lanes.findOne = () => ({
        _id: 'test_followup',
      });
    });

    after(() => { Lanes.findOne = lanes_find_one; });

    it(
      'assigns a new followup lane or null and returns the updated lane',
      () => {
        const $lane = { _id: 'test', name: 'test', type: 'test' };
        H.Session.set('lane', $lane);
        expect(change_followup_lane()).to.eq($lane);
    });
    it('returns false if no update is made', () => {
      H.Session.set('lane', { _id: 'test_no_update' });
      expect(change_followup_lane()).to.eq(false);
    });
  });

  describe('#change_salvage_plan', function () {
    it(
      'assigns a new salvage plan lane or null and returns the updated lane',
      () => {
        const $lane = { _id: 'test', name: 'test', type: 'test' };
        H.Session.set('lane', $lane);
        expect(change_salvage_plan()).to.eq($lane);
      }
    );
    it('returns false if no update is made', () => {
      H.Session.set('lane', { _id: 'test_no_update' });
      expect(change_salvage_plan()).to.eq(false);
    });
  });

  describe('#change_captains', function () {
    it('updates the list of captains based on the event data given', () => {
      H.call = (name, lane_to_update, callback) => {
        H.Session.set('lane', lane_to_update);
      };
      const $lane = {
        _id: 'test',
        name: 'test',
        type: 'test',
        captains: ['test'],
      };
      H.Session.set('lane', $lane);
      change_captains({
        target: { value: 'test_added_captain', checked: true },
      });
      expect(H.Session.get('lane').captains.length).to.eq(2);
      H.call = call_method;
    });
  });

  describe('#back_to_lanes', function () {
    it('clears the active lane in the Session', () => {
      H.Session.set('lanes', { _id: 'test' });
      this.$router = [];
      back_to_lanes.bind(this)();
      expect(H.Session.get('lane')).to.eq(false);
    });
    it('navigates to the Lanes Page', () => {
      H.Session.set('lanes', { _id: 'test' });
      this.$router = [];
      back_to_lanes.bind(this)();
      expect(this.$router[0]).to.eq('/lanes');
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
    });
    it('updates the lane slug and returns true', () => {
      H.call = (method, $lane, callback) => callback();
      H.Session.set('lane', { _id: 'test', name: 'test' });
      expect(choose_harbor_type()).to.eq(true);
      expect(H.Session.get('lane').slug).to.eq('test');
    });
  });

  describe('#get_lane_name', function () {
    it('sets the active session lane', () => {
      this.$route = { params: { slug: 'test' } };
      get_lane_name.bind(this)();
      expect(H.Session.get('lane').name).to.eq('test');
    });
    it('returns the lane name or an empty string if lane is new', () => {
      this.$route = { params: { slug: 'test' } };
      H.Session.set('lane', undefined);
      expect(get_lane_name.bind(this)()).to.eq('test');

      this.$route = { params: { slug: 'new' } };
      H.Session.set('lane', { name: 'New' });
      expect(get_lane_name.bind(this)()).to.eq('');
    });
  });
});

