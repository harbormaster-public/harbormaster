import { expect } from 'chai';

const patches = () => {
  const restores = [];
  const replace = (target, key, value) => {
    const previous = target[key];
    restores.push(() => { target[key] = previous; });
    target[key] = value;
    return previous;
  };
  const restore_all = () => {
    while (restores.length) restores.pop()();
  };
  return { replace, restore_all };
};

const rejects = async (work, message) => {
  let error;
  try { await work(); }
  catch (caught) { error = caught; }
  expect(error?.message).to.include(message);
  return error;
};

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((succeed, fail) => {
    resolve = succeed;
    reject = fail;
  });
  return { promise, resolve, reject };
};

const gate = () => {
  const entered = deferred();
  const released = deferred();
  return {
    reached: entered.promise,
    wait: () => { entered.resolve(); return released.promise; },
    resume: released.resolve,
  };
};

export { patches, rejects, deferred, gate };
