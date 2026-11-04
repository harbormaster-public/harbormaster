import { expect } from 'chai';
import H from '../config/namespace';
import { resume_harbors, start_shipment_recovery } from './recovery';
import { Shipments } from '../../api/shipments';
import { resetDatabase } from '../../test-helpers/reset-database';

describe('Startup recovery', () => {
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
        pending.push({ callback, delay });
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
      expect(pending[0].delay).to.eq(30000);
      await pending[0].callback();
      expect(successful).to.eq(1);
      expect(attempts).to.eq(2);
    }
    finally {
      H.harbors = harbors;
      globalThis.setTimeout = timeout;
      console.error = error;
    }
  });

  it('keeps the core recovery loop running after a query failure', async () => {
    await resetDatabase();
    const timeout = globalThis.setTimeout;
    const find = Shipments.find;
    const error = console.error;
    const pending = [];
    try {
      console.error = () => {};
      globalThis.setTimeout = (callback, delay) => {
        pending.push({ callback, delay });
      };
      Shipments.find = () => { throw new Error('database unavailable'); };
      await start_shipment_recovery();
      expect(pending[0].delay).to.eq(30000);
      Shipments.find = find;
      await pending[0].callback();
      expect(pending.length).to.be.at.least(2);
      expect(pending[pending.length - 1].delay).to.eq(30000);
    }
    finally {
      Shipments.find = find;
      globalThis.setTimeout = timeout;
      console.error = error;
    }
  });
});
