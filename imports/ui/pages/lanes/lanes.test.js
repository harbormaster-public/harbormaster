import { resetDatabase } from '../../../test-helpers/reset-database';
import { Shipments, LatestShipment } from '../../../api/shipments';
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
  ship_now_working,
  reset_working,
  reset_all_working,
  start_shipment_now,
  reset_shipment_now,
  reset_all_active_now,
  empty,
  lanes,
  handle_import_yaml,
  handle_download_yaml,
  handle_file_upload_change,
  import_yaml_callback,
} from './lib';
import { expect } from 'chai';
import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';
import { Harbors } from '../../../api/harbors';
import {
  setupInMemoryCollection,
} from '../../../test-helpers/setup-collection-stubs';

const call_method = H.call;

describe('Lanes Page', function () {
  let lanesStub;
  let shipmentsStub;
  let usersStub;
  let latestShipmentStub;
  let harborsStub;

  beforeEach(async () => {
    await resetDatabase();
    lanesStub = setupInMemoryCollection(Lanes);
    shipmentsStub = setupInMemoryCollection(Shipments);
    usersStub = setupInMemoryCollection(Users);
    latestShipmentStub = setupInMemoryCollection(LatestShipment);
    harborsStub = setupInMemoryCollection(Harbors);
  });

  afterEach(async () => {
    await resetDatabase();
    H.call = call_method;
    if (lanesStub) lanesStub.restore();
    if (shipmentsStub) shipmentsStub.restore();
    if (usersStub) usersStub.restore();
    if (latestShipmentStub) latestShipmentStub.restore();
    if (harborsStub) harborsStub.restore();
  });
  describe('#empty', function () {

    it('returns true if no total is set and there are no lanes', async () => {
      H.Session.set('total_lanes', undefined);
      expect(await empty()).to.eq(true);
      H.Session.set('total_lanes', 0);
      expect(await empty()).to.eq(true);
    });
    it('returns false if there are lanes even without total set', async () => {
      H.Session.set('total_lanes', undefined);
      lanesStub.insert({ _id: 'lane1', name: 'L1' });
      expect(await empty()).to.eq(false);
    });
    it('returns false if total is set regardless of count', async () => {
      H.Session.set('total_lanes', 5);
      expect(await empty()).to.eq(false);
    });
  });

  describe('#sort_by_shipped_date', function () {
    beforeEach(() => {
      H.Session.set('lanes_table_sort_reverse', undefined);
      shipmentsStub.insert({ lane: 'test_1', actual: new Date(0) });
      shipmentsStub.insert({ lane: 'test_2', actual: new Date(1) });
    });

    it('returns -1 if the first lane was shipped more recently', async () => {
      expect(await sort_by_shipped_date({ _id: 'test_2' }, { _id: 'test_1' }))
        .to
        .eq(-1)
      ;
    });
    it(
      'returns 1 if the first lane was shipped more recently reverse sort',
      async () => {
        H.Session.set('lanes_table_sort_reverse', true);
        expect(await sort_by_shipped_date({ _id: 'test_2' }, { _id: 'test_1' }))
          .to
          .eq(1)
        ;
        H.Session.set('lanes_table_sort_reverse', false);
      });
    it('returns 1 if the second lane was shipped more recently', async () => {
      expect(await sort_by_shipped_date({ _id: 'test_1' }, { _id: 'test_2' }))
        .to
        .eq(1)
      ;
    });
    it('returns 0 if both lanes shipped at the same time', async () => {
      expect(await sort_by_shipped_date({ _id: 'test_3' }, { _id: 'test_3' }))
        .to
        .eq(0)
      ;
    });
  });

  describe('#sort_by_total_shipments', function () {
    beforeEach(() => {
      H.Session.set('lanes_table_sort_reverse', undefined);
      shipmentsStub.insert({ lane: 'test_1', exit_code: 0 });
      for (let i = 0; i < 2; i++) {
        shipmentsStub.insert({ lane: 'test_2', exit_code: 0 });
      }
    });
    it('returns -1 if the first lane has more shipments', async () => {
      expect(
        await sort_by_total_shipments({ _id: 'test_2' }, { _id: 'test_1' }),
      ).to.eq(-1);
    });
    it(
      'returns 1 if the first lane has more shipments reverse sort',
      async () => {
        H.Session.set('lanes_table_sort_reverse', true);
        expect(
          await sort_by_total_shipments({ _id: 'test_2' }, { _id: 'test_1' }),
        ).to.eq(1);
        H.Session.set('lanes_table_sort_reverse', false);
      });
    it('returns 1 if the second lane has more shipments', async () => {
      expect(
        await sort_by_total_shipments({ _id: 'test_1' }, { _id: 'test_2' }),
      ).to.eq(1);
    });
    it('returns 0 if each lane has the same number of shipments', async () => {
      expect(
        await sort_by_total_shipments({ _id: 'test_1' }, { _id: 'test_1' }),
      ).to.eq(0);
    });
  });

  describe('#sort_by_total_salvage_runs', function () {

    beforeEach(() => {
      H.Session.set('lanes_table_sort_reverse', undefined);
      shipmentsStub.insert({ lane: 'test_1', exit_code: 1 });
      for (let i = 0; i < 2; i++) {
        shipmentsStub.insert({ lane: 'test_2', exit_code: 1 });
      }
    });

    it('returns -1 if the first lane has more failed shipments', async () => {
      expect(
        await sort_by_total_salvage_runs({ _id: 'test_2' }, { _id: 'test_1' }),
      ).to.eq(-1);
    });
    it(
      'returns 1 if the first lane has more failed shipments reverse sort',
      async () => {
        H.Session.set('lanes_table_sort_reverse', true);
        shipmentsStub.insert({ lane: 'test_1', exit_code: 1 });
        for (let i = 0; i < 2; i++) {
          shipmentsStub.insert({ lane: 'test_2', exit_code: 1 });
        }
        expect(
          await sort_by_total_salvage_runs(
            { _id: 'test_2' }, { _id: 'test_1' },
          ),
        ).to.eq(1);
        H.Session.set('lanes_table_sort_reverse', false);
      });
    it('returns 1 if the second lane has more failed shipments', async () => {
      H.Session.set('lanes_table_sort_reverse', undefined);
      shipmentsStub.insert({ lane: 'test_1', exit_code: 1 });
      for (let i = 0; i < 2; i++) {
        shipmentsStub.insert({ lane: 'test_2', exit_code: 1 });
      }
      expect(
        await sort_by_total_salvage_runs({ _id: 'test_1' }, { _id: 'test_2' }),
      ).to.eq(1);
    });
    it(
      'returns 0 if both lanes have the same number of failed shipments',
      async () => {
        expect(
          await sort_by_total_salvage_runs(
            { _id: 'test_1' }, { _id: 'test_1' },
          ),
        ).to.eq(0);
      });
  });

  describe('#lanes', function () {
    beforeEach(() => {
      lanesStub.insert({
        _id: 'b',
        name: 'b',
        captains: ['foo@bar.baz', 'qux@quux.corge'],
        type: '2',
        followup: { name: '3' },
        salvage_plan: { name: '6' },
      });
      lanesStub.insert({
        _id: 'c',
        name: 'c',
        captains: ['foo@bar.baz'],
        type: '3',
        followup: { name: '1' },
        salvage_plan: { name: '2' },
      });
      lanesStub.insert({
        _id: 'a',
        name: 'a',
        captains: ['foo@bar.baz', 'qux@quux.corge', 'grault@garply.waldo'],
        type: '1',
        followup: { name: '5' },
        salvage_plan: { name: '4' },
      });
      shipmentsStub.insert({
        lane: 'c',
        actual: new Date(0),
        exit_code: 1,
      });
      shipmentsStub.insert({
        lane: 'b',
        actual: new Date(1),
        exit_code: 2,
      });
      shipmentsStub.insert({
        lane: 'b',
        actual: new Date(2),
        exit_code: 1,
      });
      for (let i = 3; i < 6; i++) shipmentsStub.insert({
        lane: 'a',
        actual: new Date(i),
        exit_code: 0,
      });
    });

    it('returns a cursor of lanes sorted by name', async () => {
      H.Session.set('lanes_table_sort_by', 'name');
      H.Session.set('lanes_table_sort_reverse', undefined);
      const list = await lanes();
      expect(list[0].name).to.eq('a');
      expect(list[2].name).to.eq('c');
    });
    it('returns a cursor of lanes reverse sorted by name', async () => {
      H.Session.set('lanes_table_sort_by', 'name');
      H.Session.set('lanes_table_sort_reverse', true);
      const result = await lanes();
      const list = (result.fetch ? result.fetch() : result);
      expect(list[0].name).to.eq('c');
      expect(list[2].name).to.eq('a');
      H.Session.set('lanes_table_sort_reverse', false);
    });
    it('returns a list of lanes sorted by number of captains', async () => {
      H.Session.set('lanes_table_sort_by', 'captains');
      const list = await lanes();
      expect(list[0].captains.length).to.eq(3);
      expect(list[2].captains.length).to.eq(1);
      lanesStub.clear();
      lanesStub.insert({
        _id: 'a',
        name: 'a',
        type: '1',
        followup: { name: '5' },
        salvage_plan: { name: '4' },
      });
      lanesStub.insert({
        _id: 'b',
        name: 'b',
        type: '2',
        followup: { name: '3' },
        salvage_plan: { name: '6' },
      });
      lanesStub.insert({
        _id: 'c',
        name: 'c',
        type: '3',
        followup: { name: '1' },
        salvage_plan: { name: '2' },
      });
      const after = await lanes();
      expect(after[0].captains).to.eq(undefined);
      expect(after[1].captains).to.eq(undefined);
      expect(after[2].captains).to.eq(undefined);
    });
    it('returns a list of lanes sorted by type of lane', async () => {
      H.Session.set('lanes_table_sort_by', 'type');
      const result = await lanes();
      const list = (result.fetch ? result.fetch() : result);
      expect(list[0].type).to.eq('1');
      expect(list[2].type).to.eq('3');
    });
    it('returns a list of lanes sorted by last time shipped', async () => {
      H.Session.set('lanes_table_sort_by', 'shipped');
      const list = await lanes();
      expect(list[0].name).to.eq('b');
      expect(list[2].name).to.eq('a');
    });
    it('returns a list of lanes sorted by number of shipments', async () => {
      H.Session.set('lanes_table_sort_by', 'shipments');
      const list = await lanes();
      expect(list[0].name).to.eq('a');
      expect(list[2].name).to.eq('c');
    });
    it('returns a list of lanes sorted by number of salvage runs', async () => {
      H.Session.set('lanes_table_sort_by', 'salvage-runs');
      const list = await lanes();
      expect(list[0].name).to.eq('b');
      expect(list[2].name).to.eq('a');
    });
    it('returns a list of lanes sorted by exit code state', async () => {
      H.Session.set('lanes_table_sort_by', 'state');
      const result = await lanes();
      const list = (result.fetch ? result.fetch() : result);
      expect(list[0].name).to.eq('b');
      expect(list[2].name).to.eq('a');
    });
    it('returns a list of lanes sorted by name of followup lane', async () => {
      H.Session.set('lanes_table_sort_by', 'followup');
      const result = await lanes();
      const list = (result.fetch ? result.fetch() : result);
      expect(list[0].name).to.eq('c');
      expect(list[2].name).to.eq('a');
    });
    it('returns a list of lanes sorted by name of salvage lane', async () => {
      H.Session.set('lanes_table_sort_by', 'salvage');
      const result = await lanes();
      const list = (result.fetch ? result.fetch() : result);
      expect(list[0].name).to.eq('c');
      expect(list[2].name).to.eq('b');
    });
    it('returns unsorted lanes when sort_by is undefined', async () => {
      H.Session.set('lanes_table_sort_by', undefined);
      const list = await lanes();
      expect(list.length).to.eq(3);
      expect(list).to.be.an('array');
    });
    it('returns unsorted lanes when sort_by is invalid', async () => {
      H.Session.set('lanes_table_sort_by', 'invalid-sort-value');
      const list = await lanes();
      expect(list.length).to.eq(3);
      expect(list).to.be.an('array');
    });
  });

  describe('#loading_lanes', function () {
    it('returns true if Session is not tracking total_lanes', async () => {
      H.Session.set('total_lanes', undefined);
      expect(await loading_lanes()).to.eq(true);
    });
    it(
      'returns true if current count of lanes is less than the total',
      async () => {
        H.Session.set('total_lanes', 5);
        expect(await loading_lanes()).to.eq(true);
      });
    it('returns false otherwise', async () => {
      H.Session.set('total_lanes', 0);
      expect(await loading_lanes()).to.eq(false);
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
      H.call = call_method;
    });
    it('deletes the lane and updates the Session total_lanes', () => {
      H.call = (method) => {
        expect(method).to.eq('Lanes#delete');
      };
      delete_lane({ target: { parents: {} } }, { name: 'test' });
      H.call = call_method;
    });
    it('updates total_lanes from the server callback when confirmed', () => {
      const confirm_orig = H.confirm;
      const $orig = H.$;
      try {
        let addedClass = '';
        H.confirm = () => true;
        H.$ = () => ({
          parents: () => ({
            addClass: (cls) => { addedClass = cls; },
          }),
        });
        H.call = (method, lane, cb) => {
          expect(method).to.eq('Lanes#delete');
          expect(lane.name).to.eq('test');
          cb(null, 123);
        };
        H.Session.set('total_lanes', undefined);
        delete_lane({ target: {} }, { name: 'test' });
        expect(addedClass).to.eq('deleting');
        expect(H.Session.get('total_lanes')).to.eq(123);
      }
      finally {
        H.confirm = confirm_orig;
        H.$ = $orig;
        H.call = call_method;
      }
    });
  });

  describe('#duplicate_lane', function () {
    it('confirms the lane should be duplicated', () => {
      let called = false;
      H.confirm = () => called = true;
      H.call = () => { };
      const ctx = { $router: { push: () => {} } };
      duplicate_lane.bind(ctx)({}, {});
      expect(called).to.eq(true);
      H.call = call_method;
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
    it('returns early when confirmation is denied', () => {
      const confirm_orig = H.confirm;
      try {
        let called = 0;
        H.confirm = () => false;
        H.call = () => { called++; };
        duplicate_lane.bind({ $router: { push: () => { called++; } } })({}, {});
        expect(called).to.eq(0);
      }
      finally {
        H.confirm = confirm_orig;
        H.call = call_method;
      }
    });
    it('alerts on error returned by duplicate method', () => {
      const confirm_orig = H.confirm;
      const alert_orig = global.alert;
      try {
        H.confirm = () => true;
        let alerted = '';
        // eslint-disable-next-line no-native-reassign
        global.alert = (msg) => { alerted = String(msg); };
        this.$router = [];
        H.call = (method, lane, cb) => {
          expect(method).to.eq('Lanes#duplicate');
          cb(new Error('boom'), '/lanes/x/edit');
        };
        duplicate_lane.bind(this)({}, {});
        expect(alerted).to.include('Error');
      }
      finally {
        H.confirm = confirm_orig;
        // eslint-disable-next-line no-native-reassign
        global.alert = alert_orig;
        H.call = call_method;
      }
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

    it('returns true if the user is a harbormaster', async () => {
      usersStub.insert({
        _id: 'test@harbormaster.io',
        emails: [{ address: 'test@harbormaster.io' }],
        harbormaster: true,
      });
      expect(await can_ply({})).to.eq(true);
    });
    it('returns true if the user is a captain of the lane', async () => {
      expect(await can_ply({ captains: ['foo@harbormaster.io'] })).to.eq(false);
      expect(await can_ply({ captains: ['test@harbormaster.io'] })).to.eq(true);
    });
    it('returns true if the user has a token for the lane', async () => {
      expect(await can_ply({ tokens: { test_token: 'foo@harbormaster.io' } }))
        .to
        .eq(false)
      ;
      expect(await can_ply({ tokens: { test_token: 'test@harbormaster.io' } }))
        .to
        .eq(true)
      ;
    });
    it('returns false otherwise', async () => {
      expect(await can_ply({})).to.eq(false);
    });
  });

  describe('#current_state', function () {
    const $lane = { _id: 'test' };
    beforeEach(() => {
      lanesStub.insert({ _id: 'test' });
    });

    it(
      'returns "active" if there are any active shipments on the lane',
      async () => {
        $lane.last_shipment = { active: true };
        expect(await current_state($lane)).to.eq('active');
      });
    it(
      'returns "error" if the last shipment has a non-0 exit code',
      async () => {
        $lane.last_shipment = { exit_code: 1 };
        expect(await current_state($lane)).to.eq('error');
        delete $lane.last_shipment;
      });
    it('returns "ready" if the last exit code was 0', async () => {
      $lane.last_shipment = { exit_code: 0 };
      expect(await current_state($lane)).to.eq('ready');
      delete $lane.last_shipment;
    });
    it('returns "N/A" otherwise', async () => {
      expect(await current_state($lane)).to.eq('N/A');
    });
  });

  describe('#followup_name', function () {
    it('returns the name of the followup lane or an empty string', async () => {
      expect(await followup_name({})).to.eq('(none)');
      expect(await followup_name({ followup: { name: 'test' } })).to.eq('test');
      lanesStub.insert({ _id: 'test', name: 'test', slug: 'test' });
      const found = await Lanes.findOneAsync({ slug: 'test' });
      expect(found).to.not.be.null;
      expect(await followup_name({ followup: { slug: 'test' } })).to.eq('test');
    });
  });

  describe('#last_shipped', function () {
    it(
      'returns the last shipped date as a locale string or Loading... string',
      () => {
        const expected_datestring = new Date(0).toLocaleString();
        expect(last_shipped({ last_shipment: { actual: '' } }))
          .to.eq('');
        latestShipmentStub.insert({
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
        expect(latest_shipment({ last_shipment: { start: '' } })).to.eq('');
        latestShipmentStub.insert({
          _id: 'test',
          shipment: { start: 'test_date' },
        });
        expect(latest_shipment({ last_shipment: { start: 'test_date' } }))
          .to.eq('test_date');
      });
  });

  describe('#salvage_plan_name', function () {
    it('returns the name of the salvage plan or an empty string', async () => {
      expect(await salvage_plan_name({})).to.eq('(none)');
      expect(await salvage_plan_name({ salvage_plan: { name: 'test' } }))
        .to
        .eq('test')
      ;
      lanesStub.insert({ _id: 'test', name: 'test', slug: 'test' });
      const found = await Lanes.findOneAsync({ slug: 'test' });
      expect(found).to.not.be.null;
      expect(await salvage_plan_name({ salvage_plan: { slug: 'test' } }))
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

  describe('Quick actions (Ship Now / Reset / Reset All)', function () {
    it('reports working state from Session (ship/reset/reset-all)', () => {
      const lane = { _id: 'lane1' };
      H.Session.set('working_lanes', { lane1: true });
      H.Session.set('resetting_lanes', { lane1: true });
      H.Session.set('resetting_all_lanes', { lane1: true });

      expect(ship_now_working(lane)).to.eq(true);
      expect(reset_working(lane)).to.eq(true);
      expect(reset_all_working(lane)).to.eq(true);

      expect(ship_now_working({ _id: 'other' })).to.eq(false);
      expect(reset_working({ _id: 'other' })).to.eq(false);
      expect(reset_all_working({ _id: 'other' })).to.eq(false);

      // Cover optional chaining lane?._id branch (no lane provided).
      expect(ship_now_working()).to.eq(false);
      expect(reset_working()).to.eq(false);
      expect(reset_all_working()).to.eq(false);
    });

    describe('#start_shipment_now', function () {
      it('returns early when lane is missing required identifiers', () => {
        let called = 0;
        H.call = () => { called += 1; };
        start_shipment_now({ preventDefault () {} }, {});
        expect(called).to.eq(0);
        H.call = call_method;
      });

      it('alerts and returns when lane already has an active shipment', () => {
        const alertOrig = H.alert;
        let alerted = '';
        try {
          H.alert = (msg) => { alerted = String(msg); };
          let called = 0;
          H.call = () => { called += 1; };
          start_shipment_now(
            { preventDefault () {} },
            { _id: 'lane1', slug: 'lane1', last_shipment: { active: true, start: 'd' } },
          );
          expect(alerted).to.include('already has an active shipment');
          expect(called).to.eq(0);
        }
        finally {
          H.alert = alertOrig;
          H.call = call_method;
        }
      });

      it('alerts and returns when harbor manifest is missing', () => {
        const alertOrig = H.alert;
        let alerted = '';
        try {
          H.alert = (msg) => { alerted = String(msg); };
          let called = 0;
          H.call = () => { called += 1; };
          // No harbor inserted -> manifest missing.
          start_shipment_now(
            { preventDefault () {} },
            { _id: 'lane1', slug: 'lane1', type: 'harbor1', last_shipment: { active: false } },
          );
          expect(alerted).to.include('not ready');
          expect(called).to.eq(0);
        }
        finally {
          H.alert = alertOrig;
          H.call = call_method;
        }
      });

      it('starts a shipment and clears working state on success', () => {
        let prevented = 0;
        const lane = { _id: 'lane1', slug: 'lane1', type: 'harbor1', last_shipment: { active: false } };
        harborsStub.insert({ _id: 'harbor1', lanes: { lane1: { manifest: {} } } });

        H.Session.set('working_lanes', undefined);
        H.call = (method, id, manifest, dateString, cb) => {
          expect(method).to.eq('Lanes#start_shipment');
          expect(id).to.eq('lane1');
          expect(typeof manifest).to.eq('object');
          expect(typeof dateString).to.eq('string');
          expect(H.Session.get('working_lanes').lane1).to.eq(true);
          cb(null, { ok: true });
        };

        start_shipment_now({ preventDefault () { prevented += 1; } }, lane);
        expect(prevented).to.eq(1);
        expect(H.Session.get('working_lanes').lane1).to.eq(false);
        H.call = call_method;
      });

      it('clears working state even if Session value is cleared before callback', () => {
        const lane = { _id: 'lane1', slug: 'lane1', type: 'harbor1', last_shipment: { active: false } };
        harborsStub.insert({ _id: 'harbor1', lanes: { lane1: { manifest: {} } } });

        H.call = (method, id, manifest, dateString, cb) => {
          expect(H.Session.get('working_lanes').lane1).to.eq(true);
          // Simulate an external reset/clear before callback executes.
          H.Session.set('working_lanes', null);
          cb(null, { ok: true });
        };

        start_shipment_now({ preventDefault () {} }, lane);
        expect(H.Session.get('working_lanes').lane1).to.eq(false);
        H.call = call_method;
      });

      it('throws on callback error and still clears working state', () => {
        const lane = { _id: 'lane1', slug: 'lane1', type: 'harbor1', last_shipment: { active: false } };
        harborsStub.insert({ _id: 'harbor1', lanes: { lane1: { manifest: {} } } });
        H.call = (method, id, manifest, dateString, cb) => cb(new Error('boom'));

        expect(() => start_shipment_now({ preventDefault () {} }, lane)).to.throw('boom');
        expect(H.Session.get('working_lanes').lane1).to.eq(false);
        H.call = call_method;
      });
    });

    describe('#reset_shipment_now', function () {
      it('returns early for invalid lane', () => {
        let called = 0;
        H.call = () => { called += 1; };
        reset_shipment_now({ preventDefault () {} }, {});
        expect(called).to.eq(0);
        H.call = call_method;
      });

      it('returns early when lane is missing a slug (covers guard branch)', () => {
        let called = 0;
        H.call = () => { called += 1; };
        reset_shipment_now({ preventDefault () {} }, { _id: 'lane1' });
        expect(called).to.eq(0);
        H.call = call_method;
      });

      it('alerts and returns when no shipment exists', () => {
        const alertOrig = H.alert;
        let alerted = '';
        try {
          H.alert = (msg) => { alerted = String(msg); };
          let called = 0;
          H.call = () => { called += 1; };
          reset_shipment_now(
            { preventDefault () {} },
            { _id: 'lane1', slug: 'lane1', last_shipment: { active: false } },
          );
          expect(alerted).to.include('No shipments found');
          expect(called).to.eq(0);
        }
        finally {
          H.alert = alertOrig;
          H.call = call_method;
        }
      });

      it('resets latest shipment and clears working state', () => {
        const lane = { _id: 'lane1', slug: 'lane1', last_shipment: { active: true, start: 'd' } };
        // Ensure we cover the "Session already has a map" branch.
        H.Session.set('resetting_lanes', { other: true });
        H.call = (method, slug, date, cb) => {
          expect(method).to.eq('Lanes#reset_shipment');
          expect(slug).to.eq('lane1');
          expect(date).to.eq('d');
          expect(H.Session.get('resetting_lanes').other).to.eq(true);
          expect(H.Session.get('resetting_lanes').lane1).to.eq(true);
          cb(null, { ok: true });
        };

        reset_shipment_now({ preventDefault () {} }, lane);
        expect(H.Session.get('resetting_lanes').lane1).to.eq(false);
        H.call = call_method;
      });

      it('handles a null Session value (covers `|| {}` fallback branch)', () => {
        const lane = { _id: 'lane1', slug: 'lane1', last_shipment: { active: true, start: 'd' } };
        H.Session.set('resetting_lanes', null);
        H.call = (method, slug, date, cb) => {
          expect(method).to.eq('Lanes#reset_shipment');
          expect(H.Session.get('resetting_lanes')).to.be.an('object');
          expect(H.Session.get('resetting_lanes')).to.not.eq(null);
          expect(H.Session.get('resetting_lanes').lane1).to.eq(true);
          cb(null, { ok: true });
        };
        reset_shipment_now({ preventDefault () {} }, lane);
        expect(H.Session.get('resetting_lanes').lane1).to.eq(false);
        H.call = call_method;
      });

      it('clears reset state even if Session value is cleared before callback', () => {
        const lane = { _id: 'lane1', slug: 'lane1', last_shipment: { active: true, start: 'd' } };
        H.call = (method, slug, date, cb) => {
          expect(H.Session.get('resetting_lanes').lane1).to.eq(true);
          H.Session.set('resetting_lanes', null);
          cb(null, { ok: true });
        };
        reset_shipment_now({ preventDefault () {} }, lane);
        expect(H.Session.get('resetting_lanes').lane1).to.eq(false);
        H.call = call_method;
      });

      it('throws on callback error and still clears working state', () => {
        const lane = { _id: 'lane1', slug: 'lane1', last_shipment: { active: true, start: 'd' } };
        H.call = (method, slug, date, cb) => cb(new Error('boom'));

        expect(() => reset_shipment_now({ preventDefault () {} }, lane)).to.throw('boom');
        expect(H.Session.get('resetting_lanes').lane1).to.eq(false);
        H.call = call_method;
      });
    });

    describe('#reset_all_active_now', function () {
      it('returns early for invalid lane', () => {
        let called = 0;
        H.call = () => { called += 1; };
        reset_all_active_now({ preventDefault () {} }, {});
        expect(called).to.eq(0);
        H.call = call_method;
      });

      it('returns early when lane is missing a slug (covers guard branch)', () => {
        let called = 0;
        H.call = () => { called += 1; };
        reset_all_active_now({ preventDefault () {} }, { _id: 'lane1' });
        expect(called).to.eq(0);
        H.call = call_method;
      });

      it('resets all active shipments and clears working state', () => {
        const lane = { _id: 'lane1', slug: 'lane1', last_shipment: { active: true } };
        // Ensure we cover the "Session already has a map" branch.
        H.Session.set('resetting_all_lanes', { other: true });
        H.call = (method, slug, cb) => {
          expect(method).to.eq('Lanes#reset_all_active_shipments');
          expect(slug).to.eq('lane1');
          expect(H.Session.get('resetting_all_lanes').other).to.eq(true);
          expect(H.Session.get('resetting_all_lanes').lane1).to.eq(true);
          cb(null, { ok: true });
        };

        reset_all_active_now({ preventDefault () {} }, lane);
        expect(H.Session.get('resetting_all_lanes').lane1).to.eq(false);
        H.call = call_method;
      });

      it('handles a null Session value (covers `|| {}` fallback branch)', () => {
        const lane = { _id: 'lane1', slug: 'lane1', last_shipment: { active: true } };
        H.Session.set('resetting_all_lanes', null);
        H.call = (method, slug, cb) => {
          expect(method).to.eq('Lanes#reset_all_active_shipments');
          expect(H.Session.get('resetting_all_lanes')).to.be.an('object');
          expect(H.Session.get('resetting_all_lanes')).to.not.eq(null);
          expect(H.Session.get('resetting_all_lanes').lane1).to.eq(true);
          cb(null, { ok: true });
        };
        reset_all_active_now({ preventDefault () {} }, lane);
        expect(H.Session.get('resetting_all_lanes').lane1).to.eq(false);
        H.call = call_method;
      });

      it('clears reset-all state even if Session value is cleared before callback', () => {
        const lane = { _id: 'lane1', slug: 'lane1', last_shipment: { active: true } };
        H.call = (method, slug, cb) => {
          expect(H.Session.get('resetting_all_lanes').lane1).to.eq(true);
          H.Session.set('resetting_all_lanes', null);
          cb(null, { ok: true });
        };
        reset_all_active_now({ preventDefault () {} }, lane);
        expect(H.Session.get('resetting_all_lanes').lane1).to.eq(false);
        H.call = call_method;
      });

      it('throws on callback error and still clears working state', () => {
        const lane = { _id: 'lane1', slug: 'lane1', last_shipment: { active: true } };
        H.call = (method, slug, cb) => cb(new Error('boom'));

        expect(() => reset_all_active_now({ preventDefault () {} }, lane)).to.throw('boom');
        expect(H.Session.get('resetting_all_lanes').lane1).to.eq(false);
        H.call = call_method;
      });
    });
  });

  describe('#handle_import_yaml', () => {
    const evt = { target: {
      innerHTML: '',
      removeAttribute: () => {},
      setAttribute: () => {},
    } };
    before(() => {
      this.files = [{ name: 'test', async text () { return 'test'; } }];
      let changeCb;
      let cancelCb;
      // eslint-disable-next-line no-native-reassign
      if (typeof document === 'undefined') global.document = {
        createElement: () => ({
          setAttribute: () => {},
          addEventListener: (event, callback) => {
            if (event === 'change') changeCb = callback.bind(this);
            if (event === 'cancel') cancelCb = callback.bind(this);
          },
          click: () => {
            // Prefer exercising the real 'change' flow; fall back to cancel.
            if (changeCb) {
              changeCb({ target: { files: this.files } });
              return;
            }
            if (cancelCb) cancelCb();
          },
        }),
      };
    });
    after(() => {
      // eslint-disable-next-line no-native-reassign
      if (typeof document !== 'undefined') document = null;
    });

    it('uploads filename and YAML text to the server', async () => {
      H.call = (method, filename, yaml, cb) => {
        expect(method).to.eq('Lanes#import_yaml');
        expect(filename).to.eq('test');
        expect(yaml).to.eq('test');
        cb(null, { found: [], missing: [], created: [] });
      };
      handle_import_yaml.bind(this)(evt);
      // Allow the async file read + callback chain to complete.
      await Promise.resolve();
      await Promise.resolve();
      expect(evt.target.innerHTML).to.eq('Import from YAML');
      H.call = call_method;
    });

    it(
      'restores the button state when the file picker is cancelled',
      async () => {
        const removeOrig = evt.target.removeAttribute;
        const setOrig = evt.target.setAttribute;
        const createOrig = global.document?.createElement;

        let removed = [];
        let disabledSet = false;
        try {
          evt.target.innerHTML = '';
          evt.target.setAttribute = (k) => {
            if (k === 'disabled') disabledSet = true;
          };
          evt.target.removeAttribute = (k) => { removed.push(k); };

          let cancelCb;
          global.document.createElement = () => ({
            setAttribute: () => {},
            addEventListener: (event, callback) => {
              if (event === 'cancel') cancelCb = callback.bind(this);
            },
            click: () => { if (cancelCb) cancelCb(); },
          });

          handle_import_yaml.bind(this)(evt);
          expect(disabledSet).to.eq(true);
          expect(evt.target.innerHTML).to.eq('Import from YAML');
          expect(removed).to.include('disabled');
        }
        finally {
          evt.target.removeAttribute = removeOrig;
          evt.target.setAttribute = setOrig;
          if (createOrig) global.document.createElement = createOrig;
        }
      },
    );
  });

  describe('#handle_file_upload_change', () => {
    it('passes the filename and yaml text to the server', async () => {
      let called_method;
      let called_filename;
      let called_yaml;
      H.call = (method, filename, yaml) => {
        called_method = method;
        called_filename = filename;
        called_yaml = yaml;
      };
      const files = [{ name: 'test', async text () { return 'test'; } }];
      await handle_file_upload_change(files);
      expect(called_method).to.eq('Lanes#import_yaml');
      expect(called_filename).to.eq('test');
      expect(called_yaml).to.eq('test');
      H.call = call_method;
    });
    it(
      'invokes import_yaml_callback via the call callback and logs details',
      async () => {
        const isTestOrig = H.isTest;
        const logOrig = console.log;
        const alertOrig = H.alert;
        try {
          H.isTest = false;
          const logs = [];
          console.log = (...args) => { logs.push(args.join(' ')); };
          let alerted = '';
          H.alert = (msg) => { alerted = String(msg); };
          const evt = { target: { innerHTML: '', removeAttribute: () => {} } };
          H.call = (method, filename, yaml, cb) => {
            expect(method).to.eq('Lanes#import_yaml');
            cb(null, { found: ['a'], missing: ['b'], created: ['c'] });
          };
          const files = [{
            name: 'test.yml',
            async text () { return 'yaml'; },
          }];
          await handle_file_upload_change(files, evt);
          expect(alerted).to.include('Import complete.');
          expect(logs.join('\n')).to.include('Lanes found: a');
          expect(logs.join('\n')).to.include('Harbors missing: b');
          expect(logs.join('\n')).to.include('Lanes created: c');
        }
        finally {
          H.isTest = isTestOrig;
          console.log = logOrig;
          H.alert = alertOrig;
          H.call = call_method;
        }
      },
    );
  });

  describe('#import_yaml_callback', () => {
    it('throws when it receives an error', () => {
      expect(() => import_yaml_callback({})).to.throw();
    });
    it('alerts the user with the results', () => {
      const evt = { target: { innerHTML: '', removeAttribute: () => {} } };
      let called = false;
      H.alert = () => called = true;
      import_yaml_callback
        .bind(this)(null, { found: [], missing: [], created: [] }, evt);
      expect(called).to.eq(true);
    });
    it('logs found/missing/created details when present', () => {
      const logOrig = console.log;
      const alertOrig = H.alert;
      try {
        const logs = [];
        console.log = (...args) => { logs.push(args.join(' ')); };
        let alerted = '';
        H.alert = (msg) => { alerted = String(msg); };
        const evt = { target: {
          innerHTML: '',
          removeAttribute: () => {},
        } };
        import_yaml_callback(
          null,
          { found: ['a'], missing: ['b'], created: ['c'] },
          evt,
        );
        expect(alerted).to.include('Some lanes were found already');
        expect(alerted).to.include('Some harbors are missing');
        expect(logs.join('\n')).to.include('Lanes found: a');
        expect(logs.join('\n')).to.include('Harbors missing: b');
        expect(logs.join('\n')).to.include('Lanes created: c');
      }
      finally {
        console.log = logOrig;
        H.alert = alertOrig;
      }
    });
  });

  describe('#handle_download_yaml', () => {
    it('triggers a download from the server', () => {
      // Ensure location and document are available in test context
      // eslint-disable-next-line no-native-reassign
      if (typeof location === 'undefined') {
        global.location = { host: 'test' };
      }
      const setAttributes = [];
      let clickCount = 0;
      // eslint-disable-next-line no-native-reassign
      global.document = {
        createElement: () => ({
          setAttribute: (key, value) => {
            setAttributes.push([key, value]);
          },
          click: () => { clickCount += 1; },
        }),
      };

      let calledMethod;
      H.call = (method, callback) => {
        calledMethod = method;
        callback(null, 'test');
      };

      handle_download_yaml();

      expect(calledMethod).to.eq('Lanes#download_charter_yaml');
      const hrefAttribute = setAttributes
        .find(([key]) => key === 'href')[1];
      const downloadAttribute = setAttributes
        .find(([key]) => key === 'download')[1];
      expect(hrefAttribute.includes('data:text/plain;charset=utf-8,'))
        .to
        .eq(true);
      expect(hrefAttribute.includes(encodeURIComponent('test')))
        .to
        .eq(true);
      expect(/^test_.+_all_charters\.yml$/.test(downloadAttribute))
        .to
        .eq(true);
      expect(clickCount).to.eq(1);

      // Error path
      H.call = (method, callback) => callback(true);
      expect(handle_download_yaml).to.throw();
      H.call = call_method;
    });
  });
});
