import { resetDatabase } from 'cleaner';
import '.';
import { Lanes } from '..';
import {
  trim_manifest,
  collect_latest_shipments,
  delete_lane,
  duplicate,
  end_shipment,
  get_increment,
  publish_lanes,
  reset_all_active_shipments,
  reset_shipment,
  start_shipment,
  update_slug,
  update_webhook_token,
  download_charter_yaml,
  import_yaml,
} from './methods';
import { expect } from 'chai';
import { LatestShipment } from '../../shipments';
import { Shipments } from '../../shipments';
import { Harbors } from '../../harbors';
import _ from 'lodash';

const call_method = H.call;

describe('Lanes', function () {
  beforeEach(function () { resetDatabase(null); });

  describe('#trim_manifest', () => {
    expect(trim_manifest({ prior_manifest: true }).prior_manifest)
      .to.eq(undefined);
  });

  describe('#collect_latest_shipments', () => {
    beforeEach(() => Factory.create('lane', {
      _id: 'test',
      last_shipment: undefined,
    }));

    it('updates Lanes with their last Shipment reference', () => {
      collect_latest_shipments();
      expect(Lanes.findOne('test').last_shipment.actual).to.eq('Never');
    });
    it('records the Shipment in the list of LatestShipments', () => {
      collect_latest_shipments();
      expect(LatestShipment.findOne('test').shipment.actual).to.eq('Never');
    });
  });

  describe('#get_increment', () => {
    it('increments a given lane by 1 based on slug', () => {
      const lane = Factory.create('lane', {
        _id: 'test',
        slug: 'test-23',
      });
      expect(get_increment(lane)).to.eq(24);
    });
    it('increments recursively if a dupe exists', () => {
      const lane = Factory.create('lane', {
        _id: 'test',
        slug: 'test',
      });
      Factory.create('lane', {
        _id: 'test-2',
        slug: 'test-2',
      });
      expect(get_increment(lane)).to.eq(3);
    });
  });

  describe('#publish_lanes', () => {
    beforeEach(() => {
      resetDatabase(null);
      Factory.create('lane');
    });
    after(() => resetDatabase(null));

    it('returns undefined for an invalid page subscription', () => {
      expect(publish_lanes()).to.eq(undefined);
    });
    it('publishes the correct fields for the / (root) page', () => {
      const result = publish_lanes('/').fetch()[0];
      const expected_fields = [
        '_id',
        'name',
        'last_shipment',
        'followup',
        'salvage_plan',
      ];
      expect(Object.keys(result).sort().join(''))
        .to.eq(expected_fields.sort().join(''));
      expect(result.last_shipment.exit_code).to.eq(1);
      expect(result.last_shipment.active).to.eq(false);
      expect(result.followup._id).to.eq('foo');
      expect(result.salvage_plan._id).to.eq('bar');
    });
    it('publishes the correct fields for the /lanes page', () => {
      const result = publish_lanes('/lanes').fetch()[0];
      const expected_fields = [
        '_id',
        'name',
        'captains',
        'slug',
        'type',
        'shipment_count',
        'salvage_runs',
        'last_shipment',
        'followup',
        'salvage_plan',
      ];
      expect(Object.keys(result).sort().join(''))
        .to.eq(expected_fields.sort().join(''));
      expect(result.last_shipment.exit_code).to.eq(1);
      expect(result.captains.length).to.eq(0);
      expect(result.last_shipment.active).to.eq(false);
      expect(result.last_shipment.actual instanceof Date).to.eq(true);
      expect(result.last_shipment.start).to.eq('start-date');
    });
    it('publishes the correct fields for the /charter page', () => {
      const result = publish_lanes('/charter').fetch()[0];
      const expected_fields = [
        '_id',
        'name',
        'slug',
        'last_shipment',
        'followup',
        'salvage_plan',
      ];
      expect(Object.keys(result).sort().join(''))
        .to.eq(expected_fields.sort().join(''));
      expect(result.last_shipment.exit_code).to.eq(1);
      expect(result.last_shipment.active).to.eq(false);
      expect(result.followup._id).to.eq('foo');
      expect(result.salvage_plan._id).to.eq('bar');
    });
    it('publishes the correct fields for the /edit page', () => {
      const result = publish_lanes('/edit').fetch()[0];
      const expected_fields = [
        '_id',
        'name',
        'captains',
        'slug',
        'type',
        'rendered_input',
        'minimum_complete',
        'tokens',
        'last_shipment',
        'followup',
        'salvage_plan',
      ];
      expect(Object.keys(result).sort().join(''))
        .to.eq(expected_fields.sort().join(''));
      expect(result.last_shipment.exit_code).to.eq(1);
      expect(result.last_shipment.active).to.eq(false);
      expect(result.captains.length).to.eq(0);
      expect(result.slug).to.eq('test');
      expect(result.type).to.eq('test');
      expect(result.rendered_input).to.eq('<form></form>');
      expect(result.followup._id).to.eq('foo');
      expect(result.salvage_plan._id).to.eq('bar');
    });
    it('publishes the correct fields for the /log component', () => {
      const result = publish_lanes('/log').fetch()[0];
      const expected_fields = [
        '_id',
        'shipment_count',
        'last_shipment',
      ];
      expect(Object.keys(result).sort().join(''))
        .to.eq(expected_fields.sort().join(''));
      expect(result.last_shipment.exit_code).to.eq(1);
      expect(result.last_shipment.active).to.eq(false);
    });
    it('publishes the correct fields for the /ship page', () => {
      const result = publish_lanes('/ship').fetch()[0];
      const expected_fields = [
        '_id',
        'name',
        'captains',
        'slug',
        'type',
        'rendered_work_preview',
        'last_shipment',
        'followup',
        'salvage_plan',
      ];
      expect(Object.keys(result).sort().join(''))
        .to.eq(expected_fields.sort().join(''));
      expect(result.last_shipment.exit_code).to.eq(1);
      expect(result.last_shipment.active).to.eq(false);
      expect(Object.keys(result.last_shipment.stdout).length).to.eq(1);
      expect(Object.keys(result.last_shipment.stderr).length).to.eq(1);
      expect(result.captains.length).to.eq(0);
      expect(result.slug).to.eq('test');
      expect(result.type).to.eq('test');
      expect(result.rendered_work_preview).to.eq('<figure></figure>');
      expect(result.followup.name).to.eq('foo');
      expect(result.followup.slug).to.eq('foo');
      expect(result.salvage_plan.name).to.eq('bar');
      expect(result.salvage_plan.slug).to.eq('bar');
    });
    it('publishes the correct fields for the /profile page', () => {
      const result = publish_lanes('/profile').fetch()[0];
      const expected_fields = [
        '_id',
        'name',
        'slug',
        'tokens',
        'captains',
      ];
      expect(Object.keys(result).sort().join(''))
        .to.eq(expected_fields.sort().join(''));
      expect(result._id).to.eq('test');
      expect(result.name).to.eq('test');
      expect(result.slug).to.eq('test');
      expect(result.tokens.foo).to.eq('test@harbormaster.io');
      expect(result.captains.length).to.eq(0);
    });
  });

  describe('#update_webhook_token', () => {
    it('can remove tokens', () => {
      Factory.create('lane', {
        _id: 'test',
        tokens: { test_token: 'test@harbormaster.io' },
      });
      expect(update_webhook_token('test', 'test@harbormaster.io', true))
        .to
        .eq(1)
      ;
      expect(Lanes.findOne('test').tokens.test_token).to.eq(undefined);
    });
    it('can assign a token to a given user', () => {
      Factory.create('lane', {
        _id: 'test',
      });
      update_webhook_token('test', 'test@harbormaster.io');
      expect(
        typeof _.invert(Lanes.findOne('test').tokens)['test@harbormaster.io']
      ).to.eq('string');
    });
  });

  describe('#start_shipment', () => {
    beforeEach(() => resetDatabase(null));

    it('starts a shipment', async () => {
      let called = false;
      Factory.create('lane', { _id: 'test', type: 'test' });
      H.harbors.test = { work: (lane, manifest) => called = manifest.called };
      await start_shipment('test', { called: true }, 'test_start_date');
      expect(called).to.eq(true);
    });
    it('throws for improper arguments', async () => {
      const expected_error_text = (
        'Improper arguments for "Lanes#start_shipment" method!\n'
        + 'The first argument must be a String; the _id of the lane.\n'
        + 'The second argument, if present, must be an object;'
        + 'parameters to pass to the Harbor.\n'
        + 'The third argument must be the shipment start date.'
      );
      try {
        await start_shipment();
      }
      catch (err) {
        expect(err instanceof TypeError).to.eq(true);
        expect(err.message).to.eq(expected_error_text);
      }
    });
    it('updates the LatestShipment collection', async () => {
      Factory.create('lane', { _id: 'test', type: 'test' });
      H.harbors.test = { work: () => { } };
      expect(LatestShipment.find().count()).to.eq(0);
      await start_shipment('test', {}, 'test_start_date');
      expect(LatestShipment.find().count()).to.eq(1);
    });
    it("increases  the lane's shipment count", async () => {
      Factory.create('lane', {
        _id: 'test', type: 'test', shipment_count: undefined,
      });
      H.harbors.test = { work: () => { } };
      expect(Shipments.find().count()).to.eq(0);
      await start_shipment('test', {}, 'test_start_date');
      expect(Shipments.find().count()).to.eq(1);
      expect(Lanes.findOne('test').shipment_count).to.eq(1);
      await start_shipment('test', {}, 'test_start_date');
      expect(Shipments.find().count()).to.eq(2);
      expect(Lanes.findOne('test').shipment_count).to.eq(2);
    });
    it(
      "catches errors and records them as part of the Shipment manifest",
      async () => {
        Factory.create('lane', { _id: 'test', type: 'test' });
        H.harbors.test = { work: () => { throw new Error('test'); } };
        H.call = () => { };
        await start_shipment('test', {}, 'test_start_date');
        const shipment = Shipments.findOne({ lane: 'test' });
        const key = Object.keys(shipment.stderr)[0];
        expect(shipment.stderr[key]).to.eq('Error: test');
        expect(shipment.stderr[key].length).to.eq(11);
        H.call = call_method;
      });
    it("ends a shipment with exit code 1 on an error", async () => {
      Factory.create('lane', { _id: 'test', type: 'test' });
      H.harbors.test = { work: () => { throw new Error('test'); } };
      H.call = (method, $lane, exit_code) => {
        expect(method).to.eq('Lanes#end_shipment');
        expect(exit_code).to.eq(1);
      };
      await start_shipment('test', {}, 'test_start_date');
      H.call = call_method;
    });
    it('returns an updated manifest with its results', async () => {
      Factory.create('lane', { _id: 'test', type: 'test' });
      H.harbors.test = { work: () => ({ success: true }) };
      H.call = () => { };
      const manifest = await start_shipment('test', {}, 'test_start_date');
      expect(manifest.success).to.eq(true);
      H.call = call_method;
    });
  });

  describe('#end_shipment', () => {
    let $lane;
    let salvage_plan;
    beforeEach(() => {
      resetDatabase(null);
      salvage_plan = Factory.create('lane', {
        _id: 'test_salvage_plan',
        type: 'test',
      });
      $lane = Factory.create('lane', {
        _id: 'test',
        type: 'test',
        followup: undefined,
        salvage_plan,
        salvage_runs: undefined,
      });
      Factory.create('lane', {
        _id: 'bar', salvage_plan: null, followup: null,
      });

      Lanes.update({ _id: 'test' }, $lane);
      Factory.create('shipment', { _id: 'test', lane: 'test' });
      Factory.create('harbor', {
        _id: 'test',
        lanes: {
          test_salvage_plan: { manifest: {} },
          test_followup: { manifest: {} },
          bar: { manifest: {} },
        },
      });
    });

    it('throws for improper arguments', async () => {
      const expected_error_text = (
        'Invalid arguments for "Lanes#end_shipment" method!\n' +
        'The first argument must be a reference to a lane object.\n' +
        'The second argument must be the exit code of the finished work; ' +
        'An Integer or String representing one.\n' +
        'The third argument, if present, must be an object;' +
        'The (modified) manifest object originally passed to the Harbor.'
      );
      try {
        await end_shipment();
      }
      catch (err) {
        expect(err instanceof TypeError).to.eq(true);
        expect(err.message).to.eq(expected_error_text);
      }
    });
    it('increments salvage runs for a non-zero exit code', async () => {
      await end_shipment($lane, 1, {
        shipment_id: 'test', salvage_runs: undefined,
      });
      expect(Lanes.findOne('test').salvage_runs).to.eq(1);
      await end_shipment($lane, 1, { shipment_id: 'test' });
      expect(Lanes.findOne('test').salvage_runs).to.eq(2);
    });
    it(
      'updates a shipment record with results and sets it inactive',
      async () => {
        await end_shipment($lane, 1, { shipment_id: 'test' });
        expect(Shipments.findOne('test').exit_code).to.eq(1);
        expect(Shipments.findOne('test').active).to.eq(false);
        expect(Shipments.findOne('test').manifest.lane_id).to.eq('test');
      });
    it('updates a Lane with the last shipment', async () => {
      await end_shipment($lane, 1, { shipment_id: 'test' });
      expect(Lanes.findOne('test').last_shipment._id).to.eq('test');
    });
    it('updates the LatestShipment collection', async () => {
      expect(LatestShipment.find().count()).to.eq(0);
      await end_shipment($lane, 0, { shipment_id: 'test' });
      expect(LatestShipment.find().count()).to.eq(1);
    });
    it(
      'executes a salvage run if one is specified for non-0 exits',
      async () => {
        await end_shipment($lane, 1, { shipment_id: 'test' });
        expect(Shipments.find({ lane: 'test_salvage_plan' }).count()).to.eq(1);
      });
    it(
      'executes a followup if one is specified upon successful exit',
      async () => {
        const followup = Factory.create('lane', {
          _id: 'test_followup',
          type: 'test',
        });
        $lane.followup = followup;
        Lanes.update({ _id: $lane._id }, $lane);
        await end_shipment($lane, 0, { shipment_id: 'test' });
        expect(Shipments.find({ lane: 'test_followup' }).count()).to.eq(1);
      });
  });

  describe('#reset_shipment', () => {
    beforeEach(() => {
      Factory.create('lane', { _id: 'test', slug: 'test_slug' });
      Factory.create('lane', { _id: 'test-2', slug: 'test-2_slug' });
      Factory.create('shipment', {
        start: 'test_date',
        lane: 'test',
        active: true,
      });
      Factory.create('shipment', {
        lane: 'test-2',
        active: true,
      });
    });
    it('sets a given shipment to inactive with exit code 1', () => {
      reset_shipment('test_slug', 'test_date');
      reset_shipment('test-2_slug', 'test-2_date');
      expect(Shipments.findOne({ lane: 'test' }).active).to.eq(false);
      expect(Shipments.findOne({ lane: 'test' }).exit_code).to.eq(1);
      expect(Shipments.findOne({ lane: 'test-2' }).active).to.eq(false);
      expect(Shipments.findOne({ lane: 'test-2' }).exit_code).to.eq(1);
    });
    it("updates the LatestShipment collection and Lane's last shipment", () => {
      reset_shipment('test_slug', 'test_date');
      expect(LatestShipment.findOne().shipment.active).to.eq(false);
      expect(Lanes.findOne().last_shipment.active).to.eq(false);
    });
  });

  describe('#reset_all_Active_shipments', () => {
    beforeEach(() => {
      Factory.create('lane', { _id: 'test', slug: 'test_slug' });
      Factory.create('shipment', {
        _id: 'shipment_1',
        start: 'test_date',
        lane: 'test',
        active: true,
        actual: 2,
      });
      Factory.create('shipment', {
        _id: 'shipment_2',
        start: 'test_date',
        lane: 'test',
        active: true,
        actual: 1,
      });
    });
    it("sets all active shipments for a lane to false with exit code 1", () => {
      reset_all_active_shipments('test_slug');
      Shipments.find()
        .fetch()
        .forEach(shipment => expect(shipment.active).to.eq(false));
    });
    it("updates the lane record and LatesShipment collection", () => {
      reset_all_active_shipments('test_slug');
      expect(Lanes.findOne('test').last_shipment.active).to.eq(false);
      expect(Lanes.findOne('test').last_shipment._id).to.eq('shipment_1');
      expect(LatestShipment.findOne('test').shipment._id).to.eq('shipment_1');
    });
  });

  describe('#update_slug', () => {
    it('returns true when the slug has been updated', () => {
      const $lane = Factory.create('lane', { _id: 'test' });
      $lane.slug = 'foo';
      expect(update_slug($lane)).to.eq(true);
    });
  });

  describe('#delete', () => {
    let $lane;
    beforeEach(() => {
      $lane = Factory.create('lane', { _id: 'test', type: 'test' });
      Factory.create('harbor', { _id: 'test', lanes: { test: {} } });
    });
    it('removes the Lane from its collection', () => {
      delete_lane($lane);
      expect(Lanes.find().count()).to.eq(0);
    });
    it('removes the lane from its registered Harbor', () => {
      delete_lane($lane);
      expect(Harbors.findOne('test').lanes.test).to.eq(undefined);
    });
    it('returns the total estimate of Lanes remaning', () => {
      expect(delete_lane($lane)).to.eq(0);
    });
  });

  describe('#duplicate', () => {
    let $lane;
    const expected_string = 'test2';
    beforeEach(() => {
      $lane = Factory.create('lane', {
        _id: 'test_lane',
        name: 'test',
        slug: 'test_slug',
        type: 'test_type',
      });
      Factory.create('harbor', {
        _id: 'test_type',
        lanes: {
          test_lane: { manifest: {} },
        },
      });
    });
    it('resets shipment and salvage counts to 0', () => {
      duplicate($lane);
      expect(Lanes.findOne({ name: expected_string }).shipment_count).to.eq(0);
      expect(Lanes.findOne({ name: expected_string }).salvage_runs).to.eq(0);
    });
    it('increments the lane name and slug properly', () => {
      duplicate($lane);
      const dupe = Lanes.findOne({ name: expected_string });
      expect(dupe.slug).to.eq('test_slug2');
      expect(dupe.name).to.eq(expected_string);
    });
    it('adds the lane to the Lanes collection and the Harbor type', () => {
      expect(Lanes.find().count()).to.eq(1);
      expect(Object.keys(Harbors.findOne('test_type').lanes).length).to.eq(1);
      duplicate($lane);
      expect(Lanes.find().count()).to.eq(2);
      expect(Object.keys(Harbors.findOne('test_type').lanes).length).to.eq(2);
    });
    it('updates the harbor with the new manifest', () => {
      duplicate($lane);
      const test_harbor = Harbors.findOne('test_type');
      Object.keys(test_harbor.lanes).forEach(lane_id => {
        expect(test_harbor.lanes[lane_id].manifest).to.not.eq(undefined);
      });
    });
    it('returns a path matching format: /lanes/:slug/edit', () => {
      const result = '/lanes/test_slug2/edit';
      expect(duplicate($lane)).to.eq(result);
    });
  });

  describe('#download_charter_yaml', () => {
    let expected_yaml = 'test:\n';
    expected_yaml += '  name: test\n';
    expected_yaml += '  type: test_type\n';
    expected_yaml += '  tokens:\n';
    expected_yaml += '    foo: test@harbormaster.io\n';
    expected_yaml += '  captains: []\n';
    expected_yaml += '  followup: test-followup\n';
    expected_yaml += '  salvage_plan: test-salvage-plan\n';
    expected_yaml += '  manifest: {}\n';
    expected_yaml += 'test-followup:\n';
    expected_yaml += '  name: test followup\n';
    expected_yaml += '  type: test_type\n';
    expected_yaml += '  tokens:\n';
    expected_yaml += '    foo: test@harbormaster.io\n';
    expected_yaml += '  captains: []\n';
    expected_yaml += '  manifest: {}\n';
    expected_yaml += 'test-salvage-plan:\n';
    expected_yaml += '  name: test salvage plan\n';
    expected_yaml += '  type: test_type\n';
    expected_yaml += '  tokens:\n';
    expected_yaml += '    foo: test@harbormaster.io\n';
    expected_yaml += '  captains: []\n';
    expected_yaml += '  manifest: {}\n';

    beforeEach(() => {
      Factory.create('lane', {
        _id: 'test_lane',
        name: 'test',
        slug: 'test',
        type: 'test_type',
        followup: {
          _id: 'test_followup_lane',
          slug: 'test-followup',
        },
        salvage_plan: {
          _id: 'test_salvage_plan',
          slug: 'test-salvage-plan',
        },
      });
      Factory.create('lane', {
        _id: 'test_salvage_plan',
        slug: 'test-salvage-plan',
        type: 'test_type',
        name: 'test salvage plan',
        followup: undefined,
        salvage_plan: undefined,
      });
      Factory.create('lane', {
        _id: 'test_followup_lane',
        slug: 'test-followup',
        type: 'test_type',
        name: 'test followup',
        followup: undefined,
        salvage_plan: undefined,
      });
      Factory.create('harbor', {
        _id: 'test_type',
        lanes: {
          test_lane: { manifest: {} },
          test_salvage_plan: { manifest: {} },
          test_followup_lane: { manifest: {} },
        },
      });
    });
    it('provides the YAML text for a specific lane charter', () => {
      expect(download_charter_yaml('test')).to.eq(expected_yaml);
    });
    it('provides the YAML text for all lanes without a slug', () => {
      expect(download_charter_yaml()).to.eq(expected_yaml);
    });
  });

  describe('#import_yaml', () => {
    let test_yaml = 'test:\n';
    test_yaml += '  name: test\n';
    test_yaml += '  type: test\n';
    test_yaml += '  manifest: {}\n';
    test_yaml += 'foo:\n';
    test_yaml += '  name: foo\n';
    test_yaml += '  type: foo\n';
    test_yaml += '  manifest: {}\n';
    test_yaml += 'bar:\n';
    test_yaml += '  name: bar\n';
    test_yaml += '  type: test\n';
    test_yaml += '  manifest: {}\n';
    test_yaml += '  followup: foo\n';
    test_yaml += '  salvage_plan: test\n';
    test_yaml += 'baz:\n';
    test_yaml += '  name: baz\n';
    test_yaml += '  type: test\n';
    test_yaml += '  manifest: {}\n';

    beforeEach(() => {
      Factory.create('lane');
      Factory.create('harbor');
    });
    it('returns a list of slugs for pre-existing lanes', () => {
      expect(import_yaml('test', test_yaml).found.length).to.eq(1);
      expect(import_yaml('test', test_yaml).found[0]).to.eq('test');
    });
    it('returns a list of missing harbors not installed', () => {
      expect(import_yaml('test', test_yaml).missing.length).to.eq(1);
      expect(import_yaml('test', test_yaml).missing[0]).to.eq('foo');
    });
    it('assigns downstreams and returns a list of lanes it created', () => {
      const results = import_yaml('test', test_yaml);
      expect(results.created.length).to.eq(2);
      expect(results.created[0]).to.eq('bar');
      expect(results.created[1]).to.eq('baz');
      expect(Lanes.findOne({ slug: 'bar' }).followup.slug).to.eq('foo');
      expect(Lanes.findOne({ slug: 'bar' }).salvage_plan.slug).to.eq('test');
      expect(Lanes.findOne({ slug: 'baz' }).followup).to.eq(undefined);
      expect(Lanes.findOne({ slug: 'baz' }).salvage_plan).to.eq(undefined);
    });
  });
});
