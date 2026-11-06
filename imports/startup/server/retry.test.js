import { expect } from 'chai';
import { retry, cancel_retry, cancel_retries } from './retry';
import '../config/namespace.server';

afterEach(async () => { await cancel_retries(); });

describe('Failure backoff', () => {
  let timeout;
  let clear;
  let random;
  let now;
  let error;
  let pending;
  let clock;
  const next = async () => {
    const timer = pending.shift();
    expect(timer).to.exist;
    clock += timer.delay;
    await timer.callback();
    return timer.delay;
  };

  beforeEach(() => {
    timeout = globalThis.setTimeout;
    clear = globalThis.clearTimeout;
    random = Math.random;
    now = Date.now;
    error = console.error;
    pending = [];
    clock = Date.now();
    Date.now = () => clock;
    Math.random = () => 0.5;
    console.error = () => {};
    globalThis.setTimeout = (callback, delay) => {
      const timer = { callback, delay };
      pending.push(timer);
      return timer;
    };
    globalThis.clearTimeout = timer => {
      const index = pending.indexOf(timer);
      if (index != -1) pending.splice(index, 1);
    };
  });
  afterEach(async () => {
    await cancel_retries();
    globalThis.setTimeout = timeout;
    globalThis.clearTimeout = clear;
    Math.random = random;
    Date.now = now;
    console.error = error;
  });

  it('coalesces failures and stops after a successful retry', async () => {
    let calls = 0;
    const work = () => {
      if (++calls == 1) throw new Error('unavailable');
    };
    const cancel = retry('work', work);
    expect(retry('work', work)).to.eq(cancel);
    expect(calls).to.eq(0);
    const first = await next();
    const second = await next();
    expect(second).to.be.greaterThan(first);
    expect(calls).to.eq(2);
    expect(pending).to.have.length(0);
    cancel_retry('work');
  });

  it('bounds backoff and applies jitter on each failure', async () => {
    retry('outage', () => { throw new Error('unavailable'); });
    for (let i = 0; i < 10; i++) {
      const delay = await next();
      expect(delay).to.be.within(500, 60000);
    }
    const capped = pending[0].delay;
    Math.random = () => 0;
    await next();
    expect(pending[0].delay).to.be.lessThan(capped);
  });

  it('wakes at a recorded deadline and stops when the task is finished',
    async () => {
      let calls = 0;
      retry('lease', () => ++calls == 1 ? new Date(clock + 4000) : undefined,
        new Date(clock + 2000));
      expect(await next()).to.eq(2000);
      expect(await next()).to.eq(4000);
      expect(calls).to.eq(2);
      expect(pending).to.have.length(0);
    });

  it('handles an already expired deadline without a polling interval',
    async () => {
      let called = false;
      retry('expired', () => { called = true; }, new Date(clock - 1));
      expect(await next()).to.eq(0);
      expect(called).to.eq(true);
      expect(pending).to.have.length(0);
    });

  it('ignores a timer which fired after cancellation', async () => {
    let calls = 0;
    const cancel = retry('cancelled', () => { calls++; });
    const timer = pending[0];
    cancel();
    await timer.callback();
    expect(calls).to.eq(0);
  });

  [false, true].forEach(fails => {
    it(`keeps a replacement after cancelling running work: ${fails}`,
      async () => {
        let release;
        retry('replaced', () => new Promise((resolve, reject) => {
          release = fails ? () => reject(new Error('old failure')) : resolve;
        }));
        const timer = pending.shift();
        const running = timer.callback();
        await Promise.resolve();
        cancel_retry('replaced');
        let replacement = 0;
        retry('replaced', () => { replacement++; });
        release();
        await running;
        expect(pending).to.have.length(1);
        await next();
        expect(replacement).to.eq(1);
      });
  });
});
