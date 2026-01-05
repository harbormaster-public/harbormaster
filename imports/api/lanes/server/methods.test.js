import { resetDatabase } from '../../../test-helpers/reset-database';
import '.';
import { Lanes } from '..';
import {
  trim_manifest,
  collect_latest_shipments,
  upsert,
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
import YAML from 'yaml';

const call_method = H.call;

describe('Lanes', function () {
  beforeEach(async function () { await resetDatabase(); });

  describe('#upsert', () => {
    it(
      'inserts a new lane when _id/slug/name are missing',
      async () => {
        const existingId = await Lanes.insertAsync({
          name: 'existing',
          slug: 'existing',
        });

        const inserted = await upsert({ type: 't1' });
        expect(inserted).to.be.an('object');
        expect(inserted._id).to.be.a('string');
        expect(inserted._id).to.not.eq(existingId);

        const existing = await Lanes.findOneAsync(existingId);
        expect(existing.name).to.eq('existing');
      },
    );

    it(
      'does not match lanes with missing slug/name on undefined values',
      async () => {
        const existingId = await Lanes.insertAsync({
          name: 'has-name',
          type: 't1',
        });
        const inserted = await upsert({
          slug: undefined,
          name: undefined,
          type: 't2',
        });

        expect(inserted._id).to.not.eq(existingId);
        expect((await Lanes.findOneAsync(existingId)).type).to.eq('t1');
      },
    );

    it('updates an existing lane when _id is provided', async () => {
      await Lanes.insertAsync({
        _id: 'lane-id',
        name: 'Lane',
        slug: 'lane',
        type: 't1',
      });

      const updated = await upsert({ _id: 'lane-id', type: 't2' });
      expect(updated._id).to.eq('lane-id');
      expect(updated.type).to.eq('t2');
    });

    it('does not wipe fields when matching by slug', async () => {
      await Lanes.insertAsync({
        _id: 'lane-1',
        slug: 'lane-1',
        name: 'Lane 1',
        type: 't1',
        captains: ['captain@example.com'],
        tokens: { webhook: 'abc' },
      });

      const updated = await upsert({ slug: 'lane-1', name: 'Lane One' });
      expect(updated._id).to.eq('lane-1');
      expect(updated.name).to.eq('Lane One');
      expect(updated.type).to.eq('t1');
      expect(updated.captains).to.deep.eq(['captain@example.com']);
      expect(updated.tokens).to.deep.eq({ webhook: 'abc' });
    });

    it('inserts with provided _id when no existing lane matches', async () => {
      const inserted = await upsert({
        _id: 'new-lane-id',
        slug: 'new-lane',
        name: 'New Lane',
        type: 't1',
      });
      expect(inserted._id).to.eq('new-lane-id');
      expect(inserted.slug).to.eq('new-lane');
      expect(inserted.name).to.eq('New Lane');
      expect(inserted.type).to.eq('t1');
    });
  });

  describe('#trim_manifest', () => {
    it('should trim the manifest', () => {
      expect(trim_manifest({ prior_manifest: true }).prior_manifest)
        .to.eq(undefined);
    });
  });

  describe('#collect_latest_shipments', () => {
    beforeEach(async () => {
      await Lanes.insertAsync({
        _id: 'test',
        last_shipment: undefined,
      });
    });

    it('updates Lanes with their last Shipment reference', async () => {
      await collect_latest_shipments();
      const lane = await Lanes.findOneAsync({ _id: 'test' });
      expect(lane).to.not.be.null;
      expect(lane.last_shipment.actual).to.eq('Never');
    });
    it('records the Shipment in the list of LatestShipments', async () => {
      await collect_latest_shipments();
      expect((await LatestShipment.findOneAsync('test')).shipment.actual)
        .to.eq('Never');
    });
    it('logs when not in test mode', async () => {
      const originalIsTest = H.isTest;
      const originalLog = console.log;
      const logs = [];
      try {
        H.isTest = false;
        console.log = (...args) => { logs.push(args.join(' ')); };
        await collect_latest_shipments();
        expect(logs.join('\n')).to.include('Collecting latest shipments');
        expect(logs.join('\n')).to.include('Done collecting latest shipments');
      }
      finally {
        H.isTest = originalIsTest;
        console.log = originalLog;
      }
    });
  });

  describe('#get_increment', () => {
    it('returns default increment when lane is null', async () => {
      expect(await get_increment(null)).to.eq(2);
    });
    it('returns default increment when lane is undefined', async () => {
      expect(await get_increment(undefined)).to.eq(2);
    });
    it('returns default increment when lane has no slug', async () => {
      expect(await get_increment({})).to.eq(2);
    });
    it('returns default increment when lane.slug is falsy', async () => {
      expect(await get_increment({ slug: null })).to.eq(2);
      expect(await get_increment({ slug: undefined })).to.eq(2);
      expect(await get_increment({ slug: '' })).to.eq(2);
    });
    it('increments a given lane by 1 based on slug', async () => {
      await Lanes.insertAsync({
        _id: 'test',
        slug: 'test-23',
      });
      expect(await get_increment({ slug: 'test-23' })).to.eq(24);
    });
    it(
      'does not override explicit increment when slug already ends in digits',
      async () => {
        // Regression: previously `get_increment({ slug: 'test-2' }, 10)`
        // would incorrectly return 3 due to re-parsing the slug suffix.
        const result = await get_increment({ slug: 'test-2' }, 10);
        expect(result).to.eq(10);
      },
    );
    it('increments recursively if a dupe exists', async () => {
      await Lanes.insertAsync({
        _id: 'test',
        slug: 'test',
      });
      await Lanes.insertAsync({
        _id: 'test-2',
        slug: 'test-2',
      });
      const result = await get_increment({ slug: 'test' });
      expect(result).to.eq(3);
    });
    it(
      'recursively increments when next increment slug already exists',
      async () => {
        await Lanes.insertAsync({
          _id: 'test-2',
          slug: 'test-2',
        });
        await Lanes.insertAsync({
          _id: 'test-3',
          slug: 'test-3',
        });
        const result = await get_increment({ slug: 'test' });
        expect(result).to.eq(4);
      },
    );
    it('recursively increments through multiple existing lanes', async () => {
      await Lanes.insertAsync({
        _id: 'mylane-2',
        slug: 'mylane-2',
      });
      await Lanes.insertAsync({
        _id: 'mylane-3',
        slug: 'mylane-3',
      });
      await Lanes.insertAsync({
        _id: 'mylane-4',
        slug: 'mylane-4',
      });
      const result = await get_increment({ slug: 'mylane' });
      expect(result).to.eq(5);
    });
    it(
      'recursively increments when existing dupe slug does not match pattern',
      async () => {
        await Lanes.insertAsync({
          _id: 'nomatch-2',
          slug: 'nomatch-2',
        });
        const originalMatch = String.prototype.match;
        const dupeSlug = 'nomatch-2';
        const mockMatch = function (regex) {
          if (this === dupeSlug && regex.toString() === '/(.*?)(\\d+)$/') {
            return null;
          }
          return originalMatch.call(this, regex);
        };
        /* eslint-disable no-extend-native */
        Object.defineProperty(String.prototype, 'match', {
          value: mockMatch,
          writable: true,
          configurable: true,
        });
        try {
          const result = await get_increment({ slug: 'nomatch' });
          expect(result).to.eq(3);
        }
        finally {
          Object.defineProperty(String.prototype, 'match', {
            value: originalMatch,
            writable: true,
            configurable: true,
          });
        }
        /* eslint-enable no-extend-native */
      },
    );
    it(
      'returns the default increment when no duplicate slug exists',
      async () => {
      // No lane exists with slug "unique-2" so this should return the initial
      // increment value (2) and hit the simple return path.
        const result = await get_increment({ slug: 'unique' });
        expect(result).to.eq(2);
      },
    );
    it('hits the final return increment path (no existing dupe)', async () => {
      // Ensure the slug does NOT end in digits, otherwise get_increment() will
      // treat the trailing digits as an increment already.
      const slug = `no-dupe-${Date.now()}x`;
      expect(await Lanes.findOneAsync({ slug: `${slug}-2` })).to.eq(undefined);
      const result = await get_increment({ slug });
      expect(result).to.eq(2);
    });
  });

  describe('#publish_lanes', () => {
    beforeEach(async () => {
      await Lanes.insertAsync({
        _id: 'test',
        name: 'test',
        captains: [],
        type: 'test',
        slug: 'test',
        shipment_count: 1,
        salvage_runs: 1,
        last_shipment: {
          exit_code: 1,
          active: false,
          actual: new Date(),
          stdout: {
            [new Date()]: 'test output',
          },
          stderr: {
            [new Date()]: 'test error',
          },
          stdin: [],
          lane: 'test',
          start: 'start-date',
          manifest: {},
          finished: new Date(),
        },
        followup: {
          _id: 'foo',
          name: 'foo',
          slug: 'foo',
          type: 'test',
        },
        salvage_plan: {
          _id: 'bar',
          name: 'bar',
          slug: 'bar',
          type: 'test',
        },
        rendered_input: '<form></form>',
        rendered_work_preview: '<figure></figure>',
        tokens: {
          foo: 'test@harbormaster.io',
        },
        minimum_complete: true,
      });
    });

    it('returns undefined for an invalid page subscription', async () => {
      expect(publish_lanes()).to.eq(undefined);
    });
    it('publishes the correct fields for the / (root) page', async () => {
      const result = (await publish_lanes('/').fetchAsync())[0];
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
      expect(result.followup.slug).to.eq('foo');
      expect(result.salvage_plan._id).to.eq('bar');
      expect(result.salvage_plan.slug).to.eq('bar');
    });
    it('publishes the correct fields for the /lanes page', async () => {
      const result = (await publish_lanes('/lanes').fetchAsync())[0];
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
    it('publishes the correct fields for the /charter page', async () => {
      const result = (await publish_lanes('/charter').fetchAsync())[0];
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
    it('publishes the correct fields for the /edit page', async () => {
      const result = (await publish_lanes('/edit').fetchAsync())[0];
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
    it(
      'publishes the correct fields for the /downstreams component',
      async () => {
        const result = (await publish_lanes('/downstreams').fetchAsync())[0];
        const expected_fields = [
          '_id',
          'slug',
          'name',
        ];
        expect(Object.keys(result).sort().join(''))
          .to.eq(expected_fields.sort().join(''));
        expect(result._id).to.eq('test');
        expect(result.slug).to.eq('test');
        expect(result.name).to.eq('test');
      });
    it('publishes the correct fields for the /log component', async () => {
      const result = (await publish_lanes('/log').fetchAsync())[0];
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
    it('publishes the correct fields for the /ship page', async () => {
      const result = (await publish_lanes('/ship').fetchAsync())[0];
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
    it('publishes the correct fields for the /profile page', async () => {
      const result = (await publish_lanes('/profile').fetchAsync())[0];
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
    it('can remove tokens', async () => {
      await Lanes.insertAsync({
        _id: 'test',
        tokens: { test_token: 'test@harbormaster.io' },
      });
      const found = await Lanes.findOneAsync({ _id: 'test' });
      expect(found).to.not.be.null;
      expect(await update_webhook_token('test', 'test@harbormaster.io', true))
        .to
        .eq(1)
      ;
      expect((await Lanes.findOneAsync({ _id: 'test' })).tokens.test_token)
        .to.eq(undefined);
    });
    it('can assign a token to a given user', async () => {
      await Lanes.insertAsync({
        _id: 'test',
      });
      const found = await Lanes.findOneAsync({ _id: 'test' });
      expect(found).to.not.be.null;
      await update_webhook_token('test', 'test@harbormaster.io');
      expect(
        typeof _.invert(
          (await Lanes.findOneAsync({ _id: 'test' })).tokens,
        )['test@harbormaster.io'],
      ).to.eq('string');
    });
    it('throws when lane is not found', async () => {
      try {
        await update_webhook_token('nonexistent', 'test@harbormaster.io');
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Lane not found: nonexistent');
      }
    });
  });

  describe('#start_shipment', () => {
    it('starts a shipment', async () => {
      let called = false;
      await Lanes.insertAsync({ _id: 'test', type: 'test' });
      H.harbors.test = { work: (lane, manifest) => called = manifest.called };
      await start_shipment('test', { called: true }, 'test_start_date');
      expect(called).to.eq(true);
    });
    it('logs when not in test mode', async () => {
      const originalIsTest = H.isTest;
      const originalLog = console.log;
      let logged = '';
      try {
        H.isTest = false;
        console.log = (...args) => { logged = args.join(' '); };
        await Lanes.insertAsync({ _id: 'test', type: 'test', name: 'Lane' });
        H.harbors.test = { work: () => ({ ok: true }) };
        await start_shipment('test', {}, 'test_start_date');
        expect(logged).to.include('Starting shipment for lane:');
      }
      finally {
        H.isTest = originalIsTest;
        console.log = originalLog;
      }
    });
    it('throws for improper arguments', async () => {
      const expected_error_text = (
        `Improper arguments for "Lanes#start_shipment" method!
        The first argument must be a String; the _id of the lane.
        The second argument, if present, must be an object;
        parameters to pass to the Harbor.
        The third argument must be the shipment start date.
        Received: ${undefined}, ${undefined}, ${undefined}`
      );
      try {
        await start_shipment();
      }
      catch (err) {
        expect(err instanceof TypeError).to.eq(true);
        expect(err.message.replace(/\s+/g, ' '))
          .to.eq(expected_error_text.replace(/\s+/g, ' '));
      }
    });
    it('updates the LatestShipment collection', async () => {
      await Lanes.insertAsync({ _id: 'test', type: 'test' });
      H.harbors.test = { work: () => { } };
      expect(await LatestShipment.find().countAsync()).to.eq(0);
      await start_shipment('test', {}, 'test_start_date');
      const latest = await LatestShipment.findOneAsync('test');
      expect(!!latest).to.eq(true);
    });
    it("increases  the lane's shipment count", async () => {
      await Lanes.insertAsync({
        _id: 'test', type: 'test', shipment_count: undefined,
      });
      H.harbors.test = { work: () => { } };
      expect(await Shipments.find({}).countAsync()).to.eq(0);
      await start_shipment('test', {}, 'test_start_date');
      expect(await Shipments.find({}).countAsync()).to.eq(1);
      expect((await Lanes.findOneAsync({ _id: 'test' })).shipment_count)
        .to.eq(1);
      await start_shipment('test', {}, 'test_start_date');
      expect(await Shipments.find({}).countAsync()).to.eq(2);
      expect((await Lanes.findOneAsync({ _id: 'test' })).shipment_count)
        .to.eq(2);
    });
    it(
      "catches errors and records them as part of the Shipment manifest",
      async () => {
        await Lanes.insertAsync({ _id: 'test', type: 'test' });
        H.harbors.test = { work: () => { throw new Error('test'); } };
        H.call = async () => { };
        await start_shipment('test', {}, 'test_start_date');
        const shipment = await Shipments.findOneAsync({ lane: 'test' });
        const key = Object.keys(shipment.stderr)[0];
        expect(shipment.stderr[key]).to.eq('Error: test');
        expect(shipment.stderr[key].length).to.eq(11);
        H.call = call_method;
      });
    it('logs errors when not in test mode', async () => {
      const originalIsTest = H.isTest;
      const originalErr = console.error;
      let errLog = '';
      try {
        H.isTest = false;
        console.error = (...args) => { errLog = args.join(' '); };
        await Lanes.insertAsync({ _id: 'test', type: 'test', name: 'Lane' });
        H.harbors.test = { work: () => { throw new Error('boom'); } };
        H.call = async () => { };
        await start_shipment('test', {}, 'test_start_date');
        expect(errLog).to.include('Shipment failed with error');
      }
      finally {
        H.isTest = originalIsTest;
        console.error = originalErr;
        H.call = call_method;
      }
    });
    it("ends a shipment with exit code 1 on an error", async () => {
      await Lanes.insertAsync({ _id: 'test', type: 'test' });
      H.harbors.test = { work: () => { throw new Error('test'); } };
      H.call = async (method, $lane, exit_code) => {
        expect(method).to.eq('Lanes#end_shipment');
        expect(exit_code).to.eq(1);
      };
      await start_shipment('test', {}, 'test_start_date');
      H.call = call_method;
    });
    it('returns an updated manifest with its results', async () => {
      await Lanes.insertAsync({ _id: 'test', type: 'test' });
      H.harbors.test = { work: () => ({ success: true }) };
      H.call = async () => { };
      const manifest = await start_shipment('test', {}, 'test_start_date');
      expect(manifest.success).to.eq(true);
      H.call = call_method;
    });
  });

  describe('#end_shipment', () => {
    let salvage_plan_id;
    beforeEach(async () => {
      salvage_plan_id = await Lanes.insertAsync({
        _id: 'test_salvage_plan',
        slug: 'test_salvage_plan',
        type: 'test',
      });
      const salvage_plan = await Lanes.findOneAsync({ _id: salvage_plan_id });
      await Lanes.insertAsync({
        _id: 'test',
        type: 'test',
        salvage_plan: salvage_plan,
      });
      H.harbors.test = {
        _id: 'test',
        lanes: {
          test_salvage_plan: { manifest: {} },
          test_followup: { manifest: {} },
          bar: { manifest: {} },
        },
        work: () => ({ success: true }),
      };

      await Lanes.insertAsync({
        _id: 'bar', salvage_plan: null, followup: null,
      });

      const testLane = await Lanes.findOneAsync({ _id: 'test' });
      await Lanes.updateAsync({ _id: 'test' }, { $set: { ...testLane } });
      await Shipments.insertAsync({ _id: 'test', lane: 'test' });

      await Harbors.insertAsync(H.harbors.test);
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

    it('logs completion details when not in test mode', async () => {
      const originalIsTest = H.isTest;
      const originalLog = console.log;
      let logged = '';
      try {
        H.isTest = false;
        console.log = (...args) => { logged = args.join(' '); };
        const lane = await Lanes.findOneAsync({ _id: 'test' });
        const manifest = { shipment_id: 'test' };
        await end_shipment(lane, 0, manifest);
        expect(logged).to.include('Shipping completed for lane:');
      }
      finally {
        H.isTest = originalIsTest;
        console.log = originalLog;
      }
    });

    it('logs salvage start when not in test mode', async () => {
      const originalIsTest = H.isTest;
      const originalLog = console.log;
      const originalCall = H.call;
      const logs = [];
      let calledMethod;
      try {
        H.isTest = false;
        console.log = (...args) => { logs.push(args.join(' ')); };
        H.call = async (method) => { calledMethod = method; };
        const lane = await Lanes.findOneAsync({ _id: 'test' });
        const manifest = { shipment_id: 'test' };
        await end_shipment(lane, 1, manifest);
        expect(calledMethod).to.eq('Lanes#start_shipment');
        expect(logs.join('\n')).to.include('as salvage run of');
      }
      finally {
        H.isTest = originalIsTest;
        console.log = originalLog;
        H.call = originalCall;
      }
    });

    it(
      'throws when salvage_plan is an id string',
      async () => {
        const originalCall = H.call;
        try {
          await Lanes.updateAsync(
            { _id: 'test' },
            {
              $set: { salvage_plan: 'test_salvage_plan' },
              $unset: { followup: '' },
            },
          );
          try {
            await end_shipment(
              await Lanes.findOneAsync({ _id: 'test' }),
              1,
              { shipment_id: 'test' },
            );
            expect.fail('Should have thrown an error');
          }
          catch (err) {
            expect(err instanceof Error).to.eq(true);
            expect(err.message).to.include('Invalid salvage_plan reference');
          }
        }
        finally {
          H.call = originalCall;
        }
      },
    );
    it('throws when salvage_plan has no _id or slug', async () => {
      await Lanes.updateAsync(
        { _id: 'test' },
        { $set: { salvage_plan: {} }, $unset: { followup: '' } },
      );
      try {
        await end_shipment(
          await Lanes.findOneAsync({ _id: 'test' }),
          1,
          { shipment_id: 'test' },
        );
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.include('Invalid salvage_plan reference');
      }
    });
    it('executes salvage when salvage_plan has slug but no _id', async () => {
      await Lanes.updateAsync(
        { _id: 'test' },
        { $set: { salvage_plan: { slug: 'test_salvage_plan' } },
          $unset: { followup: '' } },
      );
      H.start_date = H.start_date || (() => 'test_start_date');
      let startShipmentLaneId = null;
      H.call = async (method, ...args) => {
        if (method === 'Lanes#start_shipment') {
          startShipmentLaneId = args[0];
          return await start_shipment(...args);
        }
        return call_method(method, ...args);
      };
      await end_shipment(
        await Lanes.findOneAsync({ _id: 'test' }),
        1,
        { shipment_id: 'test' },
      );
      expect(startShipmentLaneId).to.eq('test_salvage_plan');
      expect(
        await Shipments.find({ lane: 'test_salvage_plan' }).countAsync(),
      ).to.eq(1);
      H.call = call_method;
    });

    it('logs followup start when not in test mode', async () => {
      const originalIsTest = H.isTest;
      const originalLog = console.log;
      const originalCall = H.call;
      const logs = [];
      let calledLaneId;
      try {
        H.isTest = false;
        console.log = (...args) => { logs.push(args.join(' ')); };
        H.call = async (method, laneId) => {
          if (method === 'Lanes#start_shipment') calledLaneId = laneId;
        };
        await Lanes.updateAsync(
          { _id: 'test' },
          {
            $set: {
              followup: { _id: 'test_followup', slug: 'test_followup' },
            },
            $unset: { salvage_plan: '' },
          },
        );
        const lane = await Lanes.findOneAsync({ _id: 'test' });
        await Lanes.insertAsync({
          _id: 'test_followup',
          type: 'test',
          slug: 'test_followup',
        });
        const harbor = await Harbors.findOneAsync('test');
        if (!harbor.lanes.test_followup) {
          await Harbors.updateAsync(
            'test',
            { $set: { 'lanes.test_followup': { manifest: {} } } },
          );
        }
        const manifest = { shipment_id: 'test' };
        await end_shipment(lane, 0, manifest);
        expect(calledLaneId).to.eq('test_followup');
        expect(logs.join('\n')).to.include('as followup of');
      }
      finally {
        H.isTest = originalIsTest;
        console.log = originalLog;
        H.call = originalCall;
      }
    });
    it('throws a clear error when salvage harbor is not found', async () => {
      await Lanes.insertAsync({
        _id: 'salvage-missing-harbor',
        slug: 'salvage-missing-harbor',
        name: 'Salvage Missing Harbor',
        type: 'missing-harbor',
      });
      await Lanes.updateAsync(
        { _id: 'test' },
        {
          $set: {
            salvage_plan: {
              _id: 'salvage-missing-harbor',
              slug: 'salvage-missing-harbor',
            },
          },
        },
      );
      try {
        await end_shipment(
          await Lanes.findOneAsync({ _id: 'test' }),
          1,
          { shipment_id: 'test' },
        );
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Harbor or lane manifest not found');
      }
    });
    it('throws a clear error when followup harbor is not found', async () => {
      await Lanes.insertAsync({
        _id: 'followup-missing-harbor',
        slug: 'followup-missing-harbor',
        name: 'Followup Missing Harbor',
        type: 'missing-harbor',
      });
      await Lanes.updateAsync(
        { _id: 'test' },
        {
          $set: {
            followup: {
              _id: 'followup-missing-harbor',
              slug: 'followup-missing-harbor',
            },
          },
        },
      );
      try {
        await end_shipment(
          await Lanes.findOneAsync({ _id: 'test' }),
          0,
          { shipment_id: 'test' },
        );
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Harbor or lane manifest not found');
      }
    });
    it('increments salvage runs for a non-zero exit code', async () => {
      await end_shipment(await Lanes.findOneAsync({ _id: 'test' }), 1, {
        shipment_id: 'test', salvage_runs: undefined,
      });
      expect((await Lanes.findOneAsync({ _id: 'test' })).salvage_runs)
        .to.eq(1);
      await end_shipment(
        await Lanes.findOneAsync({ _id: 'test' }),
        1,
        { shipment_id: 'test' },
      );
      expect((await Lanes.findOneAsync({ _id: 'test' })).salvage_runs)
        .to.eq(2);
    });
    it(
      'updates a shipment record with results and sets it inactive',
      async () => {
        await end_shipment(
          await Lanes.findOneAsync({ _id: 'test' }),
          1,
          { shipment_id: 'test' },
        );
        expect((await Shipments.findOneAsync({ _id: 'test' })).exit_code)
          .to.eq(1);
        expect((await Shipments.findOneAsync({ _id: 'test' })).active)
          .to.eq(false);
        expect(
          (await Shipments.findOneAsync({ _id: 'test' })).manifest.lane_id,
        ).to.eq('test');
      });
    it('updates a Lane with the last shipment', async () => {
      await end_shipment(
        await Lanes.findOneAsync({ _id: 'test' }),
        1,
        { shipment_id: 'test' },
      );
      expect((await Lanes.findOneAsync({ _id: 'test' })).last_shipment._id)
        .to.eq('test');
    });
    it('updates the LatestShipment collection', async () => {
      await Lanes.insertAsync({
        _id: 'lane', type: 'test', salvage_plan: null, followup: null,
      });
      await Shipments.insertAsync({ _id: 'shipment', lane: 'lane' });
      expect(await LatestShipment.find().countAsync()).to.eq(0);
      await end_shipment(
        await Lanes.findOneAsync({ _id: 'lane' }),
        0,
        { shipment_id: 'shipment' },
      );
      const latest = await LatestShipment.findOneAsync({ _id: 'lane' });
      expect(!!latest).to.eq(true);
    });
    it(
      'executes a salvage run if one is specified for non-0 exits',
      async () => {
        await end_shipment(
          await Lanes.findOneAsync({ _id: 'test' }), 1, { shipment_id: 'test' },
        );
        expect(
          await Shipments.find({ lane: 'test_salvage_plan' }).countAsync(),
        ).to.eq(1);
      });
    it(
      'throws when salvage_plan _id is stale (even if slug matches)',
      async () => {
        const originalCall = H.call;
        let calledLaneId;
        try {
          await Lanes.insertAsync({
            _id: 'salvage-real',
            slug: 'salvage-slug',
            name: 'Salvage Lane',
            type: 'test',
          });
          await Harbors.updateAsync(
            'test',
            { $set: { 'lanes.salvage-real': { manifest: {} } } },
          );
          await Lanes.updateAsync(
            { _id: 'test' },
            {
              $set: {
                salvage_plan: {
                  _id: 'wrong-id',
                  slug: 'salvage-slug',
                  name: 'Salvage Lane (stale ref)',
                },
              },
            },
          );

          H.call = async (method, laneId) => {
            if (method === 'Lanes#start_shipment') calledLaneId = laneId;
          };

          try {
            await end_shipment(
              await Lanes.findOneAsync({ _id: 'test' }),
              1,
              { shipment_id: 'test' },
            );
            expect.fail('Should have thrown an error');
          }
          catch (err) {
            expect(err instanceof Error).to.eq(true);
            expect(err.message).to.include('Salvage plan lane not found');
          }
          expect(calledLaneId).to.eq(undefined);
        }
        finally {
          H.call = originalCall;
        }
      },
    );
    it(
      'executes a followup if one is specified upon successful exit',
      async () => {
        await Lanes.insertAsync({
          _id: 'test_followup',
          type: 'test',
          slug: 'test_followup',
        });
        await Lanes.updateAsync(
          { _id: 'test' },
          {
            $set: { followup: { _id: 'test_followup', slug: 'test_followup' } },
            $unset: { salvage_plan: '' },
          },
        );
        const harbor = await Harbors.findOneAsync('test');
        if (!harbor.lanes.test_followup) {
          await Harbors.updateAsync(
            { _id: 'test' },
            { $set: { 'lanes.test_followup': { manifest: {} } } },
          );
        }
        H.start_date = H.start_date || (() => 'test_start_date');
        let startShipmentLaneId = null;
        H.call = async (method, ...args) => {
          if (method === 'Lanes#start_shipment') {
            startShipmentLaneId = args[0];
            return await start_shipment(...args);
          }
          return call_method(method, ...args);
        };
        const lane = await Lanes.findOneAsync({ _id: 'test' });
        await end_shipment(lane, 0, { shipment_id: 'test' });
        expect(startShipmentLaneId).to.eq('test_followup');
        expect(
          await Shipments.find({ lane: 'test_followup' }).countAsync(),
        ).to.eq(1);
        H.call = call_method;
      });
    it(
      'executes a followup using slug when followup has a slug',
      async () => {
        await Lanes.insertAsync({
          _id: 'test_followup_slug',
          type: 'test',
          slug: 'test_followup_slug',
        });
        await Lanes.updateAsync(
          { _id: 'test' },
          {
            $set: {
              followup: {
                _id: 'test_followup_slug',
                slug: 'test_followup_slug',
              },
            },
            $unset: { salvage_plan: '' },
          },
        );
        const harbor = await Harbors.findOneAsync('test');
        if (!harbor.lanes.test_followup_slug) {
          await Harbors.updateAsync(
            { _id: 'test' },
            { $set: { 'lanes.test_followup_slug': { manifest: {} } } },
          );
        }
        H.start_date = H.start_date || (() => 'test_start_date');
        let startShipmentLaneId = null;
        H.call = async (method, ...args) => {
          if (method === 'Lanes#start_shipment') {
            startShipmentLaneId = args[0];
            return await start_shipment(...args);
          }
          return call_method(method, ...args);
        };
        const lane = await Lanes.findOneAsync({ _id: 'test' });
        await end_shipment(lane, 0, { shipment_id: 'test' });
        expect(startShipmentLaneId).to.eq('test_followup_slug');
        expect(
          await Shipments.find({ lane: 'test_followup_slug' }).countAsync(),
        ).to.eq(1);
        H.call = call_method;
      },
    );
    it(
      'throws when followup is a string ID',
      async () => {
        await Lanes.insertAsync({
          _id: 'test_followup_string',
          type: 'test',
          slug: 'test_followup_string',
        });
        await Lanes.updateAsync(
          { _id: 'test' },
          {
            $set: { followup: 'test_followup_string' },
            $unset: { salvage_plan: '' },
          },
        );
        const lane = await Lanes.findOneAsync({ _id: 'test' });
        try {
          await end_shipment(lane, 0, { shipment_id: 'test' });
          expect.fail('Should have thrown an error');
        }
        catch (err) {
          expect(err instanceof Error).to.eq(true);
          expect(err.message).to.include('Invalid followup reference');
        }
      },
    );
    it(
      'executes a followup when followup has slug but no _id',
      async () => {
        await Lanes.insertAsync({
          _id: 'test_followup_no_id',
          type: 'test',
          slug: 'test_followup_no_id',
        });
        await Lanes.updateAsync(
          { _id: 'test' },
          {
            $set: { followup: { slug: 'test_followup_no_id' } },
            $unset: { salvage_plan: '' },
          },
        );
        const harbor = await Harbors.findOneAsync('test');
        if (!harbor.lanes.test_followup_no_id) {
          await Harbors.updateAsync(
            { _id: 'test' },
            { $set: { 'lanes.test_followup_no_id': { manifest: {} } } },
          );
        }
        H.start_date = H.start_date || (() => 'test_start_date');
        let startShipmentLaneId = null;
        H.call = async (method, ...args) => {
          if (method === 'Lanes#start_shipment') {
            startShipmentLaneId = args[0];
            return await start_shipment(...args);
          }
          return call_method(method, ...args);
        };
        const lane = await Lanes.findOneAsync({ _id: 'test' });
        await end_shipment(lane, 0, { shipment_id: 'test' });
        expect(startShipmentLaneId).to.eq('test_followup_no_id');
        expect(
          await Shipments.find({ lane: 'test_followup_no_id' }).countAsync(),
        ).to.eq(1);
        H.call = call_method;
      },
    );
    it('throws when followup lane is not found', async () => {
      await Lanes.updateAsync(
        { _id: 'test' },
        {
          $set: {
            followup: {
              _id: 'nonexistent_followup',
              slug: 'nonexistent_followup',
            },
          },
          $unset: { salvage_plan: '' },
        },
      );
      const lane = await Lanes.findOneAsync({ _id: 'test' });
      try {
        await end_shipment(lane, 0, { shipment_id: 'test' });
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.include('Followup lane not found');
        expect(err.message).to.include('nonexistent_followup');
      }
    });
    it('throws when salvage plan lane is not found', async () => {
      // Ensure we are in the salvage branch:
      // exit_code != 0 and salvage_plan is set.
      await Lanes.updateAsync(
        { _id: 'test' },
        {
          $set: {
            salvage_plan: {
              _id: 'nonexistent_salvage',
              slug: 'nonexistent_salvage',
            },
          },
        },
      );
      const lane = await Lanes.findOneAsync({ _id: 'test' });
      try {
        await end_shipment(lane, 1, { shipment_id: 'test' });
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.include('Salvage plan lane not found');
        expect(err.message).to.include('nonexistent_salvage');
      }
    });
  });

  describe('#reset_shipment', () => {
    beforeEach(async () => {
      await Lanes.insertAsync({ _id: 'test', slug: 'test_slug' });
      await Lanes.insertAsync({ _id: 'test-2', slug: 'test-2_slug' });
      await Shipments.insertAsync({
        start: 'test_date',
        lane: 'test',
        active: true,
      });
      await Shipments.insertAsync({
        lane: 'test-2',
        active: true,
      });
    });
    it('sets a given shipment to inactive with exit code 1', async () => {
      await reset_shipment('test_slug', 'test_date');
      await reset_shipment('test-2_slug', 'test-2_date');
      expect((await Shipments.findOneAsync({ lane: 'test' })).active)
        .to.eq(false);
      expect((await Shipments.findOneAsync({ lane: 'test' })).exit_code)
        .to.eq(1);
      expect((await Shipments.findOneAsync({ lane: 'test-2' })).active)
        .to.eq(false);
      expect((await Shipments.findOneAsync({ lane: 'test-2' })).exit_code)
        .to.eq(1);
    });
    it(
      "updates the LatestShipment collection and Lane's last shipment",
      async () => {
        await reset_shipment('test_slug', 'test_date');
        expect((await LatestShipment.findOneAsync()).shipment.active)
          .to.eq(false);
        expect((await Lanes.findOneAsync()).last_shipment.active)
          .to.eq(false);
      });
    it('throws when lane is not found', async () => {
      try {
        await reset_shipment('nonexistent_slug', 'test_date');
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Lane not found: nonexistent_slug');
      }
    });
  });

  describe('#reset_all_Active_shipments', () => {
    beforeEach(async () => {
      await Lanes.insertAsync({ _id: 'test', slug: 'test_slug' });
      await Shipments.insertAsync({
        _id: 'shipment_1',
        start: 'test_date',
        lane: 'test',
        active: true,
        actual: new Date(2),
      });
      await Shipments.insertAsync({
        _id: 'shipment_2',
        start: 'test_date',
        lane: 'test',
        active: true,
        actual: new Date(1),
      });
    });
    it(
      "sets all active shipments for a lane to false with exit code 1",
      async () => {
        await reset_all_active_shipments('test_slug');
        const shipments = await Shipments.rawCollection().find({}).toArray();
        shipments.forEach(shipment => expect(shipment.active).to.eq(false));
      });
    it("updates the lane record and LatesShipment collection", async () => {
      await reset_all_active_shipments('test_slug');
      expect(
        (await Lanes.findOneAsync({ _id: 'test' })).last_shipment.active,
      ).to.eq(false);
      expect(
        (await Lanes.findOneAsync({ _id: 'test' })).last_shipment._id,
      ).to.eq('shipment_1');
      expect(
        (await LatestShipment.findOneAsync('test')).shipment._id,
      ).to.eq('shipment_1');
    });
    it('throws when lane is not found by slug', async () => {
      try {
        await reset_all_active_shipments('nonexistent_slug');
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Lane not found: nonexistent_slug');
      }
    });
    it('throws when lane is not found by name', async () => {
      try {
        await reset_all_active_shipments('nonexistent_name');
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Lane not found: nonexistent_name');
      }
    });
  });

  describe('#update_slug', () => {
    it('returns true when the slug has been updated', async () => {
      await Lanes.insertAsync({ _id: 'test' });
      const $lane = await Lanes.findOneAsync({ _id: 'test' });
      expect($lane).to.not.be.null;
      $lane.slug = 'foo';
      expect(await update_slug($lane)).to.eq(true);
    });
    it('returns false when lane is null', async () => {
      expect(await update_slug(null)).to.eq(false);
    });
    it('returns false when lane is undefined', async () => {
      expect(await update_slug(undefined)).to.eq(false);
    });
    it('returns false when lane has no _id', async () => {
      expect(await update_slug({ slug: 'test' })).to.eq(false);
    });
  });

  describe('#delete', () => {
    beforeEach(async () => {
      await Lanes.insertAsync({ _id: 'test', type: 'test' });
      await Harbors.insertAsync({ _id: 'test', lanes: { test: {} } });
    });
    it('removes the Lane from its collection', async () => {
      await delete_lane(await Lanes.findOneAsync({ _id: 'test' }));
      expect(await (Lanes.find()).countAsync()).to.eq(0);
    });
    it('removes the lane from its registered Harbor', async () => {
      await delete_lane(await Lanes.findOneAsync({ _id: 'test' }));
      expect((await Harbors.findOneAsync({ _id: 'test' })).lanes.test)
        .to.eq(undefined);
    });
    it('returns the total estimate of Lanes remaning', async () => {
      expect(
        await delete_lane(await Lanes.findOneAsync({ _id: 'test' })),
      ).to.eq(0);
    });
    it('throws when lane is null', async () => {
      try {
        await delete_lane(null);
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Invalid lane');
      }
    });
    it('throws when lane is undefined', async () => {
      try {
        await delete_lane(undefined);
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Invalid lane');
      }
    });
    it('throws when lane has no _id', async () => {
      try {
        await delete_lane({ type: 'test' });
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Invalid lane');
      }
    });
  });

  describe('#duplicate', () => {
    const expected_string = 'test2';
    beforeEach(async () => {
      await Lanes.insertAsync({
        _id: 'test_lane',
        name: 'test',
        slug: 'test_slug',
        type: 'test_type',
      });
      await Harbors.insertAsync({
        _id: 'test_type',
        lanes: {
          test_lane: { manifest: {} },
        },
      });
    });
    it('resets shipment and salvage counts to 0', async () => {
      await duplicate(await Lanes.findOneAsync('test_lane'));
      expect(
        (await Lanes.findOneAsync({ name: expected_string })).shipment_count,
      ).to.eq(0);
      expect(
        (await Lanes.findOneAsync({ name: expected_string })).salvage_runs,
      ).to.eq(0);
    });
    it('increments the lane name and slug properly', async () => {
      await duplicate(await Lanes.findOneAsync('test_lane'));
      const dupe = await Lanes.findOneAsync({ name: expected_string });
      expect(dupe.slug).to.eq('test_slug2');
      expect(dupe.name).to.eq(expected_string);
    });
    it(
      'adds the lane to the Lanes collection and the Harbor type',
      async () => {
        expect(await (Lanes.find({})).countAsync()).to.eq(1);
        expect(Object.keys(
          (await Harbors.findOneAsync('test_type')).lanes).length,
        ).to.eq(1);
        await duplicate(await Lanes.findOneAsync('test_lane'));
        expect(await Lanes.find({}).countAsync()).to.eq(2);
        expect(Object.keys(
          (await Harbors.findOneAsync('test_type')).lanes).length,
        ).to.eq(2);
      });
    it('updates the harbor with the new manifest', async () => {
      await duplicate(await Lanes.findOneAsync({ _id: 'test_lane' }));
      const test_harbor = await Harbors.findOneAsync({ _id: 'test_type' });
      Object.keys(test_harbor.lanes).forEach(lane_id => {
        expect(test_harbor.lanes[lane_id].manifest).to.not.eq(undefined);
      });
    });
    it('returns a path matching format: /lanes/:slug/edit', async () => {
      const result = '/lanes/test_slug2/edit';
      expect(
        await duplicate(await Lanes.findOneAsync({ _id: 'test_lane' })),
      ).to.eq(result);
    });
    it('throws when lane is null', async () => {
      try {
        await duplicate(null);
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Invalid lane');
      }
    });
    it('throws when lane is undefined', async () => {
      try {
        await duplicate(undefined);
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Invalid lane');
      }
    });
    it('throws when lane has no _id', async () => {
      try {
        await duplicate({ type: 'test_type' });
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Invalid lane');
      }
    });
    it('throws when lane has no type', async () => {
      try {
        await duplicate({ _id: 'test_lane' });
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Invalid lane');
      }
    });
    it('throws when harbor is not found', async () => {
      const lane = await Lanes.findOneAsync({ _id: 'test_lane' });
      lane.type = 'nonexistent_type';
      try {
        await duplicate(lane);
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Harbor or lane manifest not found');
      }
    });
    it('throws when harbor has no lanes', async () => {
      await Harbors.insertAsync({
        _id: 'test_type_no_lanes',
        lanes: undefined,
      });
      const lane = await Lanes.findOneAsync({ _id: 'test_lane' });
      lane.type = 'test_type_no_lanes';
      try {
        await duplicate(lane);
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Harbor or lane manifest not found');
      }
    });
    it('throws when lane manifest is not found in harbor', async () => {
      await Harbors.insertAsync({
        _id: 'test_type_no_manifest',
        lanes: { other_lane: { manifest: {} } },
      });
      const lane = await Lanes.findOneAsync({ _id: 'test_lane' });
      lane.type = 'test_type_no_manifest';
      try {
        await duplicate(lane);
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Harbor or lane manifest not found');
      }
    });
  });

  describe('#download_charter_yaml', () => {
    const expected_charter = {
      test: {
        name: 'test',
        type: 'test_type',
        tokens: {},
        captains: [],
        followup: 'test-followup',
        salvage_plan: 'test-salvage-plan',
        manifest: {},
      },
      'test-followup': {
        name: 'test followup',
        type: 'test_type',
        tokens: {},
        captains: [],
        manifest: {},
      },
      'test-salvage-plan': {
        name: 'test salvage plan',
        type: 'test_type',
        tokens: {},
        captains: [],
        manifest: {},
      },
    };

    beforeEach(async () => {
      await Lanes.insertAsync({
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
      await Lanes.insertAsync({
        _id: 'test_salvage_plan',
        slug: 'test-salvage-plan',
        type: 'test_type',
        name: 'test salvage plan',
        followup: undefined,
        salvage_plan: undefined,
      });
      await Lanes.insertAsync({
        _id: 'test_followup_lane',
        slug: 'test-followup',
        type: 'test_type',
        name: 'test followup',
        followup: undefined,
        salvage_plan: undefined,
      });
      await Harbors.insertAsync({
        _id: 'test_type',
        lanes: {
          test_lane: { manifest: {} },
          test_salvage_plan: { manifest: {} },
          test_followup_lane: { manifest: {} },
        },
      });
    });
    it('provides the YAML text for a specific lane charter', async () => {
      const yaml = await download_charter_yaml('test');
      expect(YAML.parse(yaml)).to.deep.eq(expected_charter);
    });
    it('provides the YAML text for all lanes without a slug', async () => {
      const yaml = await download_charter_yaml();
      expect(YAML.parse(yaml)).to.deep.eq(expected_charter);
    });
    it(
      'does not include test token defaults when lane.tokens is missing',
      async () => {
        const yaml = await download_charter_yaml('test');
        expect(yaml).to.not.include('test@harbormaster.io');
        expect(yaml).to.not.include('foo:');
      },
    );
    it('throws a clear error when harbor is not found', async () => {
      await Harbors.removeAsync({ _id: 'test_type' });
      try {
        await download_charter_yaml('test');
        expect.fail('Should have thrown an error');
      }
      catch (err) {
        expect(err instanceof Error).to.eq(true);
        expect(err.message).to.eq('Harbor or lane manifest not found');
      }
    });
    it(
      'logs an error when a downstream lane cannot be found (non-test mode)',
      async () => {
        const originalIsTest = H.isTest;
        const originalErr = console.error;
        let errLog = '';
        try {
          H.isTest = false;
          console.error = (...args) => { errLog = args.join(' '); };
          await Lanes.updateAsync(
            { _id: 'test_lane' },
            {
              $set: {
                followup: { _id: 'missing-followup', slug: 'missing-followup' },
              },
            },
          );
          await download_charter_yaml('test');
          expect(errLog).to.include('Unable to find lane by slug');
        }
        finally {
          H.isTest = originalIsTest;
          console.error = originalErr;
        }
      });
  });

  describe('#import_yaml', () => {
    let harbor;
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

    beforeEach(async () => {
      await Lanes.insertAsync({ _id: 'test', slug: 'test' });
      harbor = await Harbors.insertAsync({ _id: 'test' });
    });
    it('returns a list of slugs for pre-existing lanes', async () => {
      const foundLane = await Lanes.findOneAsync({ slug: 'test' });
      expect(foundLane).to.not.be.null;
      const result = await import_yaml('test', test_yaml);
      expect(result.found.length).to.eq(1);
      expect(result.found[0]).to.eq('test');
    });
    it('returns a list of missing harbors not installed', async () => {
      const result = await import_yaml('test', test_yaml);
      expect(result.missing.length).to.eq(1);
      expect(result.missing[0]).to.eq('foo');
    });
    it('assigns a key for Lane manifests in a Harobr if needed', async () => {
      await Harbors.updateAsync(harbor._id, { $unset: { lanes: '' } });
      const results = await import_yaml('test', test_yaml);
      expect(results.created.length).to.eq(2);
    });
    it(
      'assigns downstreams and returns a list of lanes it created',
      async () => {
        const results = await import_yaml('test', test_yaml);
        expect(results.created.length).to.eq(2);
        expect(results.created[0]).to.eq('bar');
        expect(results.created[1]).to.eq('baz');
        expect(
          (await Lanes.findOneAsync({ slug: 'bar' })).followup.slug,
        ).to.eq('foo');
        expect(
          (await Lanes.findOneAsync({ slug: 'bar' })).followup._id,
        ).to.eq('foo');
        expect(
          (await Lanes.findOneAsync({ slug: 'bar' })).salvage_plan.slug,
        ).to.eq('test');
        expect(
          (await Lanes.findOneAsync({ slug: 'bar' })).salvage_plan._id,
        ).to.eq('test');
        expect(
          (await Lanes.findOneAsync({ slug: 'baz' })).followup,
        ).to.eq(undefined);
        expect(
          (await Lanes.findOneAsync({ slug: 'baz' })).salvage_plan,
        ).to.eq(undefined);
      },
    );

    it(
      'resolves followup _id from an existing lane with the same slug',
      async () => {
        await Lanes.insertAsync({ _id: 'foo-id', slug: 'foo' });
        const yaml = (
          'bar:\n' +
          '  name: bar\n' +
          '  type: test\n' +
          '  manifest: {}\n' +
          '  followup: foo\n'
        );

        const results = await import_yaml('test', yaml);
        expect(results.created).to.deep.eq(['bar']);

        const bar = await Lanes.findOneAsync({ slug: 'bar' });
        expect(bar.followup).to.deep.eq({ _id: 'foo-id', slug: 'foo' });
      },
    );

    it(
      'falls back to {_id: slug} when salvage_plan slug cannot be resolved',
      async () => {
        const yaml = (
          'bar:\n' +
          '  name: bar\n' +
          '  type: test\n' +
          '  manifest: {}\n' +
          '  salvage_plan: missing-salvage\n'
        );

        const results = await import_yaml('test', yaml);
        expect(results.created).to.deep.eq(['bar']);

        const bar = await Lanes.findOneAsync({ slug: 'bar' });
        expect(bar.salvage_plan).to.deep.eq({
          _id: 'missing-salvage',
          slug: 'missing-salvage',
        });
      },
    );
  });
});
