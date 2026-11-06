import { expect } from 'chai';
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import H from '../../../startup/config/namespace';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { Lanes } from '..';
import { Shipments } from '../../shipments';
import { Harbors } from '../../harbors';
import { ShipmentReturns } from '../../shipments/server/returns';
import { start_shipment, recover_shipments, delete_lane } from './methods';

const sleep_path = process.env.SLEEP_HARBOR_PATH ||
  path.resolve(process.env.PWD, '../harbormaster-sleep/sleep.js');
if (process.env.SLEEP_HARBOR_PATH && !fs.existsSync(sleep_path)) {
  throw new Error('The companion Sleep harbor is missing');
}
const integration = fs.existsSync(sleep_path) ? describe : describe.skip;

integration('Sleep and core recovery integration', () => {
  const source = fs.existsSync(sleep_path) ?
    fs.readFileSync(sleep_path, 'utf8') : '';
  const restores = [];
  const replace = (target, key, value) => {
    const previous = target[key];
    restores.push(() => { target[key] = previous; });
    target[key] = value;
    return previous;
  };
  const recover = async () => Promise.all(await recover_shipments());
  const start = () => start_shipment('sleeper',
    { seconds: 0, exit_code: 0, request: true }, 'planned', 'source');
  let work;
  let followups;
  let queued;
  let errors;
  const load_sleep = () => {
    queued = [];
    errors = [];
    const module = { exports: {} };
    vm.runInNewContext(source, {
      module, H, Date,
      console: { error: (...args) => errors.push(args) },
      setTimeout: (callback, delay) => {
        const timer = { callback, delay };
        queued.push(timer);
        return timer;
      },
      clearTimeout: timer => {
        const index = queued.indexOf(timer);
        if (index != -1) queued.splice(index, 1);
      },
    });
    const sleep = module.exports;
    const original = sleep.work;
    sleep.work = (...args) => { work++; return original(...args); };
    sleep.register(Lanes, null, Harbors, Shipments);
    H.harbors.sleep = sleep;
    return sleep;
  };
  const tick = async () => {
    const timer = queued.shift();
    expect(timer, 'a recovered timer is scheduled').to.exist;
    expect(timer.delay).to.eq(0);
    await timer.callback();
    expect(errors).to.have.length(0);
    expect(queued).to.have.length(0);
  };

  beforeEach(async () => {
    await resetDatabase();
    work = 0;
    followups = 0;
    replace(console, 'error', () => {});
    replace(H, 'harbors', { test: { work: () => {
      followups++;
      return { completed_followup: true };
    } } });
    await Lanes.insertAsync({ _id: 'sleeper', type: 'sleep',
      followup: { _id: 'followup' },
    });
    await Lanes.insertAsync({ _id: 'followup', type: 'test' });
    await Harbors.insertAsync({ _id: 'test', lanes: {
      followup: { manifest: {} },
    } });
    load_sleep();
  });
  afterEach(() => {
    while (restores.length) restores.pop()();
  });

  it('completes a normal timer through real core RPCs', async () => {
    const value = await start();
    await tick();
    expect(await start()).to.deep.eq(value);
    expect((await Shipments.findOneAsync('source')).active).to.eq(false);
    expect(followups).to.eq(1);
    expect(work).to.eq(1);
  });

  it('blocks deletion during return capture and retains the timer handoff',
    async () => {
      let attempted = false;
      const upsert = ShipmentReturns.upsertAsync;
      replace(ShipmentReturns, 'upsertAsync', async (...args) => {
        const saved = await upsert.apply(ShipmentReturns, args);
        if (!attempted) {
          attempted = true;
          const lane = await Lanes.findOneAsync('sleeper');
          let error;
          try { await delete_lane(lane); }
          catch (caught) { error = caught; }
          expect(error?.error).to.eq('lane-active');
          expect(error.reason).to.include('Reset it before deleting');
        }
        return saved;
      });
      await start();
      expect(attempted).to.eq(true);
      await tick();
      expect(followups).to.eq(1);
      expect(work).to.eq(1);
      await delete_lane(await Lanes.findOneAsync('sleeper'));
      expect(await Lanes.findOneAsync('sleeper')).to.eq(undefined);
    });

  it('arms a new timer only after the dispatch return is durable', async () => {
    let entered;
    let release;
    const saving = new Promise(resolve => { entered = resolve; });
    const ready = new Promise(resolve => { release = resolve; });
    const upsert = replace(ShipmentReturns, 'upsertAsync', async (...args) => {
      entered();
      await ready;
      return upsert.apply(ShipmentReturns, args);
    });
    const starting = start();
    try {
      await saving;
      expect(queued).to.have.length(0);
      expect(followups).to.eq(0);
      expect((await Shipments.findOneAsync('source')).active).to.eq(true);
    }
    finally {
      release();
      await starting;
    }
    await tick();
    expect(followups).to.eq(1);
  });

  ['handoff', 'publication'].forEach(boundary => {
    it(`repairs failed ${boundary} without repeating work`, async () => {
      const sleep = H.harbors.sleep;
      const resume = sleep.resume_shipment;
      const update = Shipments.updateAsync;
      if (boundary == 'handoff') {
        replace(sleep, 'resume_shipment', () => {
          throw new Error('handoff unavailable');
        });
      }
      else {
        replace(Shipments, 'updateAsync', async (...args) => {
          if (args[1].$set?.dispatch?.has_result !== undefined) {
            throw new Error('publication unavailable');
          }
          return update.apply(Shipments, args);
        });
      }
      let error;
      try { await start(); }
      catch (caught) { error = caught; }
      expect(error?.message).to.eq(`${boundary} unavailable`);
      expect(work).to.eq(1);
      expect(followups).to.eq(0);
      sleep.resume_shipment = resume;
      Shipments.updateAsync = update;
      load_sleep();
      await recover();
      await tick();
      expect(work).to.eq(1);
      expect(followups).to.eq(1);
    });
  });

  it('resumes a legacy active shipment through real core RPCs', async () => {
    await Shipments.insertAsync({ _id: 'source', lane: 'sleeper', active: true,
      actual: new Date(Date.now() - 10000), start: 'legacy',
      stdout: {}, stderr: {},
      manifest: { seconds: 0, exit_code: 0, shipment_id: 'source' },
    });
    await H.harbors.sleep.resume();
    await tick();
    expect((await Shipments.findOneAsync('source')).exit_code).to.eq(0);
    expect(followups).to.eq(1);
    expect(work).to.eq(0);
  });

  it('resumes a settled active dispatch after losing process timers',
    async () => {
      const value = await start();
      const sleep = load_sleep();
      await sleep.resume();
      await tick();
      expect(await start()).to.deep.eq(value);
      expect(followups).to.eq(1);
      expect(work).to.eq(1);
    });

  ['before-start', 'after-start', 'captured'].forEach(boundary => {
    ['timer-first', 'dispatch-first'].forEach(order => {
      it(`recovers an interrupted dispatch at ${boundary}: ${order}`,
        async () => {
          let restore;
          if (boundary == 'captured') {
            const upsert = replace(ShipmentReturns, 'upsertAsync',
              async (...args) => {
                await upsert.apply(ShipmentReturns, args);
                throw new Error('process stopped');
              });
            restore = () => { ShipmentReturns.upsertAsync = upsert; };
          }
          else {
            const update = Shipments.updateAsync;
            replace(Shipments, 'updateAsync', async (...args) => {
              if (args[1].$set?.['dispatch.started']) {
                if (boundary == 'after-start') {
                  await update.apply(Shipments, args);
                }
                throw new Error('process stopped');
              }
              return update.apply(Shipments, args);
            });
            restore = () => { Shipments.updateAsync = update; };
          }
          let error;
          try { await start(); }
          catch (caught) { error = caught; }
          expect(error?.message).to.eq('process stopped');
          restore();
          const interrupted = await Shipments.findOneAsync('source');
          const value = interrupted.manifest;
          const sleep = load_sleep();
          let release;
          if (order == 'timer-first') {
            const ready = new Promise(resolve => { release = resolve; });
            const find = replace(Shipments, 'find', (...args) => {
              const cursor = find.apply(Shipments, args);
              if (args[0]['dispatch.pending'] === true) {
                return { fetchAsync: async () => {
                  await ready;
                  return await cursor.fetchAsync();
                } };
              }
              return cursor;
            });
          }
          const resuming = sleep.resume();
          const repairing = recover();
          try {
            await resuming;
            if (order == 'timer-first') expect(queued).to.have.length(0);
          }
          finally {
            release?.();
            await repairing;
          }
          await tick();
          const saved = await Shipments.findOneAsync('source');
          expect(await start()).to.deep.eq(value);
          expect(followups).to.eq(1);
          expect(saved.active).to.eq(false);
        });
    });
  });

  it('does not complete a reset sleep through the real core', async () => {
    await start();
    await Shipments.updateAsync('source', {
      $set: { active: false, exit_code: 1 },
    });
    await tick();
    expect(followups).to.eq(0);
    expect((await Shipments.findOneAsync('source')).completion)
      .to.eq(undefined);
  });
});
