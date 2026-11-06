import { expect } from 'chai';
import H from '../config/namespace';
import {
  resume_harbors, start_shipment_recovery, start_recovery,
} from './recovery';
import { WebApp } from 'meteor/webapp';
import { Shipments } from '../../api/shipments';
import { Lanes } from '../../api/lanes';
import { recover_shipments } from '../../api/lanes/server/methods';
import { resetDatabase } from '../../test-helpers/reset-database';

describe('Startup recovery', () => {
  it('starts after HTTP is listening without waiting for harbor recovery',
    async () => {
      await resetDatabase();
      const listening = WebApp.onListening;
      const harbors = H.harbors;
      const timeout = H.setTimeout;
      let on_listening;
      let release;
      let finish_work;
      let began_work;
      let tasks = [];
      const work_started = new Promise(resolve => { began_work = resolve; });
      let resumed = false;
      let independent = false;
      const pending = [];
      await Lanes.insertAsync({ _id: 'slow', type: 'slow' });
      await Shipments.insertAsync({ _id: 'slow', lane: 'slow', active: true,
        actual: new Date(), manifest: {}, dispatch: { pending: true },
      });
      try {
        WebApp.onListening = callback => { on_listening = callback; };
        H.setTimeout = (callback, delay) => {
          pending.push({ callback, delay });
          return 0;
        };
        H.harbors = {
          slow: {
            resume: () => {
              resumed = true;
              return new Promise(resolve => { release = resolve; });
            },
            work: async (lane, manifest) => {
              began_work();
              await new Promise(resolve => { finish_work = resolve; });
              return manifest;
            },
          },
          independent: { resume: () => { independent = true; } },
        };
        start_recovery();
        expect(resumed).to.eq(false);
        expect(on_listening()).to.eq(undefined);
        expect(resumed).to.eq(true);
        expect(independent).to.eq(true);
        await work_started;
        tasks = await recover_shipments();
        await new Promise(resolve => setImmediate(resolve));
        expect(pending).to.have.length(0);
      }
      finally {
        release?.();
        finish_work?.();
        await Promise.all(tasks);
        WebApp.onListening = listening;
        H.harbors = harbors;
        H.setTimeout = timeout;
      }
    });

  it('retries only the harbor that failed to resume', async () => {
    const harbors = H.harbors;
    const timeout = globalThis.setTimeout;
    const error = console.error;
    const pending = [];
    let successful = 0;
    let attempts = 0;
    try {
      console.error = () => {};
      globalThis.setTimeout = (callback, delay) => {
        if (callback.name != 'run') return timeout(callback, delay);
        pending.push({ callback, delay });
        return 0;
      };
      H.harbors = {
        ordinary: {},
        good: { resume: async () => { successful++; } },
        retry: { resume: async () => {
          attempts++;
          if (attempts == 1) throw new Error('database unavailable');
        } },
      };
      await resume_harbors();
      expect(successful).to.eq(1);
      expect(attempts).to.eq(1);
      expect(pending[0].delay).to.be.within(500, 1000);
      await pending.shift().callback();
      expect(successful).to.eq(1);
      expect(attempts).to.eq(2);
      expect(pending).to.have.length(0);
    }
    finally {
      H.harbors = harbors;
      globalThis.setTimeout = timeout;
      console.error = error;
    }
  });

  it('retries failed startup scans and stops after success', async () => {
    await resetDatabase();
    const timeout = globalThis.setTimeout;
    const find = Shipments.find;
    const error = console.error;
    const pending = [];
    try {
      console.error = () => {};
      globalThis.setTimeout = (callback, delay) => {
        if (callback.name != 'run') return timeout(callback, delay);
        pending.push({ callback, delay });
        return 0;
      };
      Shipments.find = () => { throw new Error('database unavailable'); };
      await start_shipment_recovery();
      expect(pending[0].delay).to.be.within(500, 1000);
      Shipments.find = find;
      await pending.shift().callback();
      expect(pending).to.have.length(0);
    }
    finally {
      Shipments.find = find;
      globalThis.setTimeout = timeout;
      console.error = error;
    }
  });
});
