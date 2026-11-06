const retries = new Map();

const retry = (key, work, at) => {
  if (retries.has(key)) return retries.get(key).cancel;
  const state = { attempt: 0 };
  const current = () => retries.get(key) === state;
  state.cancel = () => {
    clearTimeout(state.timer);
    if (current()) retries.delete(key);
  };
  const schedule = (deadline) => {
    const delay = deadline ? Math.max(0, deadline - Date.now()) :
      Math.min(1000 * 2 ** Math.min(state.attempt++, 6), 60000) *
      (0.5 + Math.random() / 2);
    state.timer = setTimeout(run, delay);
  };
  const run = async () => {
    if (!current()) return;
    try {
      state.running = Promise.resolve().then(work);
      const deadline = await state.running;
      if (!current()) return;
      if (deadline instanceof Date) {
        state.attempt = 0;
        schedule(deadline);
      }
      else retries.delete(key);
    }
    catch (error) {
      if (!current()) return;
      console.error(`Unable to retry ${key}:`, error);
      schedule();
    }
  };
  retries.set(key, state);
  schedule(at);
  return state.cancel;
};

const cancel_retry = key => retries.get(key)?.cancel();
const cancel_retries = async () => {
  const states = [...retries.values()];
  for (const state of states) state.cancel();
  await Promise.allSettled(states.map(state => state.running));
};

export { retry, cancel_retry, cancel_retries };
