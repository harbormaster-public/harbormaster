import { resetDatabase } from 'cleaner';
import { Shipments } from '../../../api/shipments';
import {
  loading_lanes,
  sort_by_header,
  sort_by_shipped_date,
  sort_by_total_shipments,
  sort_by_total_salvage_runs,
  sort_lane_table_reverse,
  reverse_sort,
  default_sort,
  delete_lane,
  duplicate_lane,
  ready,
  active,
  can_ply,
  current_state,
  followup_name,
  last_shipped,
  latest_shipment,
  salvage_plan_name,
  total_captains,
  empty,
  lanes,
} from './lib';
import { expect } from 'chai';
import { Lanes } from '../../../api/lanes';

const shipments_find = Shipments.find;
const call_method = H.call;

describe('Lanes Page', function () {

  describe('#empty', function () {
    before(() => resetDatabase(null));
    it('returns true if there are no lanes', () => {
      H.Session.set('total_lanes', undefined);
      expect(empty()).to.eq(true);
      H.Session.set('total_lanes', 0);
      expect(empty()).to.eq(true);
    });
  });

  describe('#sort_by_shipped_date', function () {

    beforeEach(() => {
      Shipments.find = ({ lane } = shipment) => {
        switch (lane) {
        default:
          return { fetch: () => ([]) };
        case 'test_1':
          return { fetch: () => ([{ actual: new Date(0) }]) };
        case 'test_2':
          return { fetch: () => ([{ actual: new Date(1) }]) };
        }
      };
    });

    afterEach(() => {
      Shipments.find = shipments_find;
    });

    it('returns -1 if the first lane was shipped more recently', () => {
      expect(sort_by_shipped_date({ _id: 'test_2' }, { _id: 'test_1' }))
        .to
        .eq(-1)
      ;
    });
    it(
      'returns 1 if the first lane was shipped more recently reverse sort',
      () => {
        H.Session.set('lanes_table_sort_reverse', true);
        expect(sort_by_shipped_date({ _id: 'test_2' }, { _id: 'test_1' }))
          .to
          .eq(1)
        ;
        H.Session.set('lanes_table_sort_reverse', false);
      });
    it('returns 1 if the second lane was shipped more recently', () => {
      expect(sort_by_shipped_date({ _id: 'test_1' }, { _id: 'test_2' }))
        .to
        .eq(1)
      ;
    });
    it('returns 0 if both lanes shipped at the same time', () => {
      expect(sort_by_shipped_date({ _id: 'test_3' }, { _id: 'test_3' }))
        .to
        .eq(0)
      ;
    });
  });

  describe('#sort_by_total_shipments', function () {
    beforeEach(() => {
      Shipments.find = ({ lane } = shipment) => {
        switch (lane) {
        default:
        case 'test_1':
          return { fetch: () => ([{}]) };
        case 'test_2':
          return { fetch: () => ([{}, {}]) };
        }
      };
    });

    afterEach(() => {
      Shipments.find = shipments_find;
    });
    it('returns -1 if the first lane has more shipments', () => {
      expect(sort_by_total_shipments({ _id: 'test_2' }, { _id: 'test_1' }))
        .to
        .eq(-1)
      ;
    });
    it('returns 1 if the first lane has more shipments reverse sort', () => {
      H.Session.set('lanes_table_sort_reverse', true);
      expect(sort_by_total_shipments({ _id: 'test_2' }, { _id: 'test_1' }))
        .to
        .eq(1)
      ;
      H.Session.set('lanes_table_sort_reverse', false);
    });
    it('returns 1 if the second lane has more shipments', () => {
      expect(sort_by_total_shipments({ _id: 'test_1' }, { _id: 'test_2' }))
        .to
        .eq(1)
      ;
    });
    it('returns 0 if each lane has the same number of shipments', () => {
      expect(sort_by_total_shipments({ _id: 'test_1' }, { _id: 'test_1' }))
        .to
        .eq(0)
      ;
    });
  });

  describe('#sort_by_total_salvage_runs', function () {
    beforeEach(() => {
      Shipments.find = ({ lane } = shipment) => {
        switch (lane) {
        default:
        case 'test_1':
          return { fetch: () => ([{}]) };
        case 'test_2':
          return { fetch: () => ([{}, {}]) };
        }
      };
    });

    afterEach(() => {
      Shipments.find = shipments_find;
    });
    it('returns -1 if the first lane has more failed shipments', () => {
      expect(sort_by_total_salvage_runs({ _id: 'test_2' }, { _id: 'test_1' }))
        .to
        .eq(-1)
      ;
    });
    it(
      'returns 1 if the first lane has more failed shipments reverse sort',
      () => {
        H.Session.set('lanes_table_sort_reverse', true);
        expect(sort_by_total_salvage_runs({ _id: 'test_2' }, { _id: 'test_1' }))
          .to
          .eq(1)
        ;
        H.Session.set('lanes_table_sort_reverse', false);
      });
    it('returns 1 if the second lane has more failed shipments', () => {
      expect(sort_by_total_salvage_runs({ _id: 'test_1' }, { _id: 'test_2' }))
        .to
        .eq(1)
      ;
    });
    it(
      'returns 0 if both lanes have the same number of failed shipments',
      () => {
        expect(sort_by_total_salvage_runs({ _id: 'test_1' }, { _id: 'test_1' }))
          .to
          .eq(0)
        ;
      });
  });

  describe('#lanes', function () {
    beforeEach(() => {
      resetDatabase(null);
      Factory.create('lane', {
        _id: 'b',
        name: 'b',
        captains: ['foo@bar.baz', 'qux@quux.corge'],
        type: '2',
        followup: { name: '3' },
        salvage_plan: { name: '6' },
      });
      Factory.create('lane', {
        _id: 'c',
        name: 'c',
        captains: ['foo@bar.baz'],
        type: '3',
        followup: { name: '1' },
        salvage_plan: { name: '2' },
      });
      Factory.create('lane', {
        _id: 'a',
        name: 'a',
        captains: ['foo@bar.baz', 'qux@quux.corge', 'grault@garply.waldo'],
        type: '1',
        followup: { name: '5' },
        salvage_plan: { name: '4' },
      });
      Factory.create('shipment', {
        lane: 'c',
        actual: new Date(0),
        exit_code: 1,
      });
      Factory.create('shipment', {
        lane: 'b',
        actual: new Date(1),
        exit_code: 2,
      });
      Factory.create('shipment', {
        lane: 'b',
        actual: new Date(2),
        exit_code: 1,
      });
      for (let i = 3; i < 6; i++) Factory.create('shipment', {
        lane: 'a',
        actual: new Date(i),
        exit_code: 0,
      });
    });

    it('returns a cursor of lanes sorted by name', () => {
      H.Session.set('lanes_table_sort_by', 'name');
      const list = lanes().fetch();
      expect(list[0].name).to.eq('a');
      expect(list[2].name).to.eq('c');
    });
    it('returns a cursor of lanes reverse sorted by name', () => {
      H.Session.set('lanes_table_sort_by', 'name');
      H.Session.set('lanes_table_sort_reverse', true);
      const list = lanes().fetch();
      expect(list[0].name).to.eq('c');
      expect(list[2].name).to.eq('a');
      H.Session.set('lanes_table_sort_reverse', false);
    });
    it('returns a list of lanes sorted by number of captains', () => {
      H.Session.set('lanes_table_sort_by', 'captains');
      const list = lanes();
      expect(list[0].captains.length).to.eq(3);
      expect(list[2].captains.length).to.eq(1);
      Lanes.update('a', { $unset: { captains: '' } });
      Lanes.update('b', { $unset: { captains: '' } });
      Lanes.update('c', { $unset: { captains: '' } });
      expect(lanes()[0].captains).to.eq(undefined);
      expect(lanes()[1].captains).to.eq(undefined);
      expect(lanes()[2].captains).to.eq(undefined);
    });
    it('returns a list of lanes sorted by type of lane', () => {
      H.Session.set('lanes_table_sort_by', 'type');
      const list = lanes().fetch();
      expect(list[0].type).to.eq('1');
      expect(list[2].type).to.eq('3');
    });
    it('returns a list of lanes sorted by last time shipped', () => {
      H.Session.set('lanes_table_sort_by', 'shipped');
      const list = lanes();
      expect(list[0].name).to.eq('a');
      expect(list[2].name).to.eq('c');
    });
    it('returns a list of lanes sorted by number of shipments', () => {
      H.Session.set('lanes_table_sort_by', 'shipments');
      const list = lanes();
      expect(list[0].name).to.eq('a');
      expect(list[2].name).to.eq('c');
    });
    it('returns a list of lanes sorted by number of salvage runs', () => {
      H.Session.set('lanes_table_sort_by', 'salvage-runs');
      const list = lanes();
      expect(list[0].name).to.eq('b');
      expect(list[2].name).to.eq('a');
    });
    it('returns a list of lanes sorted by exit code state', () => {
      H.Session.set('lanes_table_sort_by', 'state');
      const list = lanes().fetch();
      expect(list[0].name).to.eq('b');
      expect(list[2].name).to.eq('a');
    });
    it('returns a list of lanes sorted by name of followup lane', () => {
      H.Session.set('lanes_table_sort_by', 'followup');
      const list = lanes().fetch();
      expect(list[0].name).to.eq('c');
      expect(list[2].name).to.eq('a');
    });
    it('returns a list of lanes sorted by name of salvage lane', () => {
      H.Session.set('lanes_table_sort_by', 'salvage');
      const list = lanes().fetch();
      expect(list[0].name).to.eq('c');
      expect(list[2].name).to.eq('b');
    });
    it('returns a list of lanes', () => {
      H.Session.set('lanes_table_sort_by', undefined);
      const list = lanes().fetch();
      expect(list.length).to.eq(3);
    });
  });

  describe('#loading_lanes', function () {
    it('returns true if the Session is not tracking total_lanes', () => {
      H.Session.set('total_lanes', undefined);
      expect(loading_lanes()).to.eq(true);
    });
    it(
      'returns true if the current count of lanes is less than the total',
      () => {
        resetDatabase(null);
        H.Session.set('total_lanes', 5);
        expect(loading_lanes()).to.eq(true);
      });
    it('returns false otherwise', () => {
      H.Session.set('total_lanes', 0);
      expect(loading_lanes()).to.eq(false);
    });
  });

  describe('#sort_lane_table_reverse', function () {
    it(
      'returns true if the given value is already sorted not in reverse',
      () => {
        H.Session.set('lanes_table_sort_by', 'test');
        expect(sort_lane_table_reverse('test')).to.eq(true);
      });
    it('returns false otherwise', () => {
      H.Session.set('lanes_table_sort_by', 'test');
      H.Session.set('lanes_table_sort_reverse', true);
      expect(sort_lane_table_reverse('test')).to.eq(false);
    });
  });

  describe('#reverse_sort', function () {
    it('sets that the sort should be in reverse in Session', () => {
      H.Session.set('lanes_table_sort_reverse', false);
      reverse_sort({ target: {} });
      expect(H.Session.get('lanes_table_sort_reverse')).to.eq(true);
    });
    it('adds a class to the target of the event', () => {
      const event = { target: {} };
      reverse_sort(event);
      expect(event.target.reverse).to.eq(true);
    });
    it('returns the event given', () => {
      expect(reverse_sort({ target: { id: 'foo' } }).target.id).to.eq('foo');
    });
  });

  describe('#default_sort', function () {
    it('sets that the sort should be the default way', () => {
      H.Session.set('lanes_table_sort_reverse', true);
      default_sort({ target: {} });
      expect(H.Session.get('lanes_table_sort_reverse')).to.eq(false);
    });
    it('removes a class from the target of the event', () => {
      const event = { target: {} };
      default_sort(event);
      expect(event.target.reverse).to.eq(false);
    });
    it('returns the event given', () => {
      expect(default_sort({ target: { id: 'foo' } }).target.id).to.eq('foo');
    });
  });

  describe('#sort_by_header', function () {
    it('removes classes from siblings of the target element', () => {
      const event = { target: { siblings: {} } };
      H.Session.set('lanes_table_sort_reverse', undefined);
      H.Session.set('lanes_table_sort_by', undefined);
      sort_by_header(event);
      expect(event.target.siblings.reverse).to.eq(false);
      expect(event.target.siblings.active).to.eq(false);
    });
    it('adds a class to the target element', () => {
      const event = { target: { siblings: {} } };
      H.Session.set('lanes_table_sort_reverse', undefined);
      H.Session.set('lanes_table_sort_by', undefined);
      sort_by_header(event);
      expect(event.target.active).to.eq(true);
      expect(event.target.reverse).to.eq(undefined);
    });
    it('adds a reverse class to the target element if reversed', () => {
      const event = { target: { siblings: {} } };
      H.Session.set('lanes_table_sort_reverse', false);
      H.Session.set('lanes_table_sort_by', 'test_value');
      sort_by_header(event);
      expect(event.target.active).to.eq(true);
      expect(event.target.reverse).to.eq(true);
    });
    it('sets the sort value in the Session', () => {
      const event = { target: { siblings: {} } };
      H.Session.set('lanes_table_sort_reverse', true);
      H.Session.set('lanes_table_sort_by', undefined);
      sort_by_header(event);
      expect(H.Session.get('lanes_table_sort_by')).to.eq('test_value');
    });
  });

  describe('#delete_lane', function () {
    it('confirms the lane should be deleted', () => {
      let called = false;
      H.confirm = () => called = true;
      H.call = () => { };
      delete_lane({ target: { parents: {} } }, { name: 'test' });
      expect(called).to.eq(true);
    });
    it('deletes the lane and updates the Session total_lanes', () => {
      H.call = (method) => {
        expect(method).to.eq('Lanes#delete');
      };
      delete_lane({ target: { parents: {} } }, { name: 'test' });
      H.call = call_method;
    });
  });

  describe('#duplicate_lane', function () {
    it('confirms the lane should be duplicated', () => {
      let called = false;
      H.confirm = () => called = true;
      H.call = () => { };
      duplicate_lane({}, {});
      expect(called).to.eq(true);
    });
    it('duplicates the lane and then navigates to that Edit Lane Page', () => {
      this.$router = [];
      H.call = (method, $lane, callback) => {
        callback();
        expect(method).to.eq('Lanes#duplicate');
      };
      duplicate_lane.bind(this)({}, {});
      expect(this.$router.length).to.eq(1);
      H.call = call_method;
    });
  });

  describe('#ready', function () {
    it(
      'returns true when Lanes, LatestShipment subscriptions are ready',
      () => {
        this.$subReady = {
          Lanes: true,
          LatestShipment: true,
        };
        expect(ready.bind(this)()).to.eq(true);
      });
    it('returns false otherwise', () => {
      this.$subReady = {
        Lanes: false,
        LatestShipment: true,
      };
      expect(ready.bind(this)()).to.eq(false);
    });
  });

  describe('#active', function () {
    it('returns empty string if no sort is set', () => {
      expect(active()).to.eq('');
    });
    it('returns an active string if a sort it set', () => {
      H.Session.set('lanes_table_sort_by', 'test');
      H.Session.set('lanes_table_sort_reverse', undefined);
      expect(active('test')).to.eq('active');
    });
    it('returns an active reverse string if sort and reverse are set', () => {
      H.Session.set('lanes_table_sort_by', 'test');
      H.Session.set('lanes_table_sort_reverse', true);
      expect(active('test')).to.eq('active reverse');
    });
  });

  describe('#can_ply', function () {
    beforeEach(() => resetDatabase(null));

    it('returns true if the user is a harbormaster', () => {
      Factory.create('user', {
        _id: 'test@harbormaster.io',
        harbormaster: true,
      });
      expect(can_ply({})).to.eq(true);
    });
    it('returns true if the user is a captain of the lane', () => {
      expect(can_ply({ captains: ['foo@harbormaster.io'] })).to.eq(false);
      expect(can_ply({ captains: ['test@harbormaster.io'] })).to.eq(true);
    });
    it('returns true if the user has a token for the lane', () => {
      expect(can_ply({ tokens: { test_token: 'foo@harbormaster.io' } }))
        .to
        .eq(false)
      ;
      expect(can_ply({ tokens: { test_token: 'test@harbormaster.io' } }))
        .to
        .eq(true)
      ;
    });
    it('returns false otherwise', () => { expect(can_ply({})).to.eq(false); });
  });

  describe('#current_state', function () {
    const $lane = { _id: 'test' };
    beforeEach(() => {
      resetDatabase(null);
      Factory.create('lane', { _id: 'test' });
    });

    it('returns "active" if there are any active shipments on the lane', () => {
      $lane.last_shipment = { active: true };
      expect(current_state($lane)).to.eq('active');
      Factory.create('shipment', {
        _id: 'test_shipment',
        lane: 'test',
        active: true,
      });
      expect(current_state($lane)).to.eq('active');
    });
    it('returns "error" if the last shipment has a non-0 exit code', () => {
      $lane.last_shipment = { exit_code: 1 };
      expect(current_state($lane)).to.eq('error');
      delete $lane.last_shipment;
    });
    it('returns "ready" if the last exit code was 0', () => {
      $lane.last_shipment = { exit_code: 0 };
      expect(current_state($lane)).to.eq('ready');
      delete $lane.last_shipment;
    });
    it('returns "N/A" otherwise', () => {
      expect(current_state($lane)).to.eq('N/A');
    });
  });

  describe('#followup_name', function () {
    it('returns the name of the followup lane or an empty string', () => {
      resetDatabase(null);
      expect(followup_name({})).to.eq('');
      expect(followup_name({ followup: { name: 'test' } })).to.eq('test');
      Factory.create('lane', { _id: 'test', name: 'test' });
      expect(followup_name({ followup: { _id: 'test' } })).to.eq('test');
    });
  });

  describe('#last_shipped', function () {
    it(
      'returns the last shipped date as a locale string or Loading... string',
      () => {
        const expected_datestring = new Date(0).toLocaleString();
        resetDatabase(null);
        expect(last_shipped({ last_shipment: { actual: '' } }))
          .to.eq('');
        Factory.create('latest_shipment', {
          _id: 'test',
          shipment: { actual: new Date(0) },
        });
        expect(last_shipped({ last_shipment: { actual: new Date(0) } }))
          .to.eq(expected_datestring);
      });
  });

  describe('#latest_shipment', function () {
    it(
      'returns the latest shipment start date for a lane or an empty string',
      () => {
        resetDatabase(null);
        expect(latest_shipment({ last_shipment: { start: '' } })).to.eq('');
        Factory.create('latest_shipment', {
          _id: 'test',
          shipment: { start: 'test_date' },
        });
        expect(latest_shipment({ last_shipment: { start: 'test_date' } }))
          .to.eq('test_date');
      });
  });

  describe('#salvage_plan_name', function () {
    it('returns the name of the salvage plan or an empty string', () => {
      resetDatabase(null);
      expect(salvage_plan_name({})).to.eq('');
      expect(salvage_plan_name({ salvage_plan: { name: 'test' } }))
        .to
        .eq('test')
      ;
      Factory.create('lane', { _id: 'test', name: 'test' });
      expect(salvage_plan_name({ salvage_plan: { _id: 'test' } }))
        .to
        .eq('test')
      ;
    });
  });

  describe('#total_captains', function () {
    it('returns 0 if there are no captains', () => {
      expect(total_captains({})).to.eq(0);
    });
    it('returns the number of captains assigned to a lane', () => {
      expect(total_captains({ captains: ['foo', 'bar'] })).to.eq(2);
    });
  });
});
