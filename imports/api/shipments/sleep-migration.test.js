import { expect } from 'chai';
import { Mongo } from 'meteor/mongo';
import { ObjectId, Binary } from 'mongodb';
import { Shipments } from '.';
import { resetDatabase } from '../../test-helpers/reset-database';
import { plan_sleep_migration, apply_sleep_migration } from './sleep-migration';

describe('Sleep migration', () => {
  const shipment = {
    _id: 'legacy', lane: 'sleep-lane', active: true,
    actual: new Date(100000), start: 'planned',
  };
  const harbor = { lanes: {
    'sleep-lane': { manifest: { seconds: '5', exit_code: '0' } },
  } };

  beforeEach(async () => { await resetDatabase(); });

  it('previews estimated settings without changing the inputs', () => {
    const plan = plan_sleep_migration([shipment], harbor);
    expect(plan.report[0].estimated).to.eq(true);
    expect(plan.report[0].deadline).to.deep.eq(new Date(105000));
    expect(plan.changes[0].manifest.shipment_id).to.eq('legacy');
    expect(plan.changes[0].manifest.shipment_start_date).to.eq('planned');
    expect(shipment.manifest).to.eq(undefined);
  });

  it('preserves saved deadlines and original manifests', () => {
    const saved = { ...shipment, sleep_resume: {
      deadline: new Date(999999), exit_code: 1,
      manifest: { seconds: 10, exit_code: 1, prior_manifest: 'original' },
    } };
    const plan = plan_sleep_migration([saved], harbor);
    expect(plan.report[0].estimated).to.eq(false);
    expect(plan.report[0].deadline).to.deep.eq(saved.sleep_resume.deadline);
    expect(plan.changes[0].manifest.prior_manifest).to.eq('original');
  });

  it('preserves typed saved context without changing the original', () => {
    const record_id = new Mongo.ObjectID();
    const manifest = { seconds: 5, exit_code: 0,
      prior_manifest: { record_id },
    };
    const saved = { ...shipment, sleep_resume: {
      deadline: new Date(105000), exit_code: 0, manifest,
    } };
    const plan = plan_sleep_migration([saved], harbor);
    expect(plan.changes[0].manifest.prior_manifest.record_id)
      .to.be.instanceOf(Mongo.ObjectID);
    expect(plan.changes[0].manifest.prior_manifest.record_id.equals(record_id))
      .to.eq(true);
    expect(manifest.shipment_id).to.eq(undefined);
    expect(manifest.shipment_start_date).to.eq(undefined);
  });

  it('normalizes a typed template without changing its settings', () => {
    const record_id = new Mongo.ObjectID();
    const manifest = { seconds: '5', exit_code: 0,
      prior_manifest: { record_id },
    };
    const plan = plan_sleep_migration([shipment], { lanes: {
      'sleep-lane': { manifest },
    } });
    expect(plan.changes[0].manifest.seconds).to.eq(5);
    expect(plan.changes[0].manifest.prior_manifest.record_id.equals(record_id))
      .to.eq(true);
    expect(manifest.seconds).to.eq('5');
    expect(manifest.shipment_id).to.eq(undefined);
  });

  it('preserves BSON values through an offline backfill', async () => {
    const raw = Shipments.rawCollection();
    const record_id = new ObjectId();
    const manifest = { seconds: 5, exit_code: 0,
      prior_manifest: { record_id, binary: new Binary(Buffer.from('context')) },
    };
    await raw.insertOne({ ...shipment, sleep_resume: {
      deadline: new Date(105000), exit_code: 0, manifest,
    } });
    const plan = plan_sleep_migration(await raw.find().toArray(), harbor);
    expect((await apply_sleep_migration(raw, plan)).updated).to.eq(1);
    const saved = await raw.findOne({ _id: shipment._id });
    const context = saved.manifest.prior_manifest;
    expect(context.record_id.toHexString()).to.eq(record_id.toHexString());
    expect(context.binary.value().toString()).to.eq('context');
    expect(saved.sleep_resume.manifest.prior_manifest).to.deep.eq(context);
    expect(saved.sleep_resume.manifest.shipment_id).to.eq(undefined);
  });

  it('does not rewrite initialized or inactive shipments', () => {
    const initialized = { ...shipment, manifest: {
      seconds: 5, exit_code: 0,
    } };
    const plan = plan_sleep_migration([
      initialized, { ...shipment, active: false },
    ], undefined);
    expect(plan.changes).to.deep.eq([]);
    expect(plan.report.length).to.eq(1);
    expect(plan.report[0].estimated).to.eq(false);
  });

  it('validates the complete plan before any write', () => {
    expect(() => plan_sleep_migration([shipment], undefined))
      .to.throw('Missing sleep settings');
    expect(() => plan_sleep_migration([shipment], {}))
      .to.throw('Missing sleep settings');
    expect(() => plan_sleep_migration([shipment], { lanes: {} }))
      .to.throw('Missing sleep settings');
    for (const manifest of [
      { seconds: -1, exit_code: 0 },
      { seconds: 'invalid', exit_code: 0 },
      { seconds: 5, exit_code: 'invalid' },
      { seconds: null, exit_code: 0 },
      { seconds: true, exit_code: 0 },
      { seconds: 1e13, exit_code: 0 },
    ]) {
      expect(() => plan_sleep_migration([{ ...shipment, manifest }], harbor))
        .to.throw('Invalid sleep settings');
    }
    for (const seconds of [' ', 'invalid']) {
      expect(() => plan_sleep_migration([shipment], { lanes: {
        'sleep-lane': { manifest: { seconds, exit_code: 0 } },
      } })).to.throw('Invalid sleep settings');
    }
    expect(() => plan_sleep_migration([{ ...shipment, actual: null,
      sleep_resume: { deadline: null, exit_code: 0,
        manifest: { seconds: 1, exit_code: 0 } },
    }], harbor)).to.throw('Invalid sleep settings');
    expect(() => plan_sleep_migration([
      { ...shipment, actual: 'invalid' },
    ], harbor)).to.throw('Invalid sleep settings');
  });

  it('applies only to unchanged active records and can be rerun', async () => {
    await Shipments.insertAsync(shipment);
    await Shipments.insertAsync({ ...shipment, _id: 'reset', manifest: null });
    const plan = plan_sleep_migration(
      await Shipments.find().fetchAsync(), harbor,
    );
    await Shipments.updateAsync('reset', { $set: { active: false } });
    const result = await apply_sleep_migration(Shipments.rawCollection(), plan);
    expect(result.updated).to.eq(1);
    expect(result.skipped).to.deep.eq(['reset']);
    const repeated = await apply_sleep_migration(
      Shipments.rawCollection(), plan,
    );
    expect(repeated.updated).to.eq(0);
    expect(repeated.skipped.length).to.eq(2);
    expect(plan_sleep_migration(await Shipments.find().fetchAsync(), harbor)
      .changes).to.deep.eq([]);
  });
});
