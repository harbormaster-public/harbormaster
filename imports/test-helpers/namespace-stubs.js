import { Accounts } from 'meteor/accounts-base';

// Test-only shims/stubs for the global `H` namespace.
// These are intentionally kept out of production code
// (`startup/config/namespace.js`).

export const reactiveVarShim = (val) => {
  let store = val;
  return {
    get: () => store,
    set: (new_val) => store = new_val,
  };
};

export const serverAlert = function () {
  // eslint-disable-next-line no-console
  if (!globalThis.H?.isTest) console.warn.apply(null, arguments);
};

export const serverConfirm = function () {
  // eslint-disable-next-line no-console
  if (!globalThis.H?.isTest) console.warn.apply(null, arguments);
};

export const serverReload = () => { };

export const computeAlert = (isClient) => (
  isClient ? window.alert.bind(window) : serverAlert
);

export const computeConfirm = (isClient) => (
  isClient ? window.confirm.bind(window) : serverConfirm
);

export const computeClientE2E = (isClient, win) => (
  !!(isClient && win && !!win.Cypress)
);

export const computeWindow = (isClient) => (
  isClient ? window : {
    location: {
      host: 'localhost:4040',
      reload: serverReload,
    },
    document: {
      createElement: () => ({}),
      body: { appendChild: () => { } },
      head: { appendChild: () => { } },
    },
    innerHeight: 2000,
    render_null: false,
  }
);

export const applyServerTestStubs = (namespace = globalThis.H) => {
  if (!namespace) return;

  // Provide a minimal Session shim for server-side unit tests.
  if (!namespace.Session) namespace.Session = {
    store: {},
    get (key) {
      if (this.store[key] || this.store[key] == 0) return this.store[key];
      return undefined;
    },
    set (key, data) {
      this.store[key] = data;
    },
  };

  if (!namespace.ReactiveVar) namespace.ReactiveVar = reactiveVarShim;

  // Minimal jQuery shim used by UI unit tests.
  namespace.html_calls = {};
  if (!namespace.$) namespace.$ = function (target) {
    return {
      find (selector) {
        switch (selector) {
          case 'input, textarea':
            return [
              { type: 'text', value: 'foo', name: 'foo' },
              { type: 'checkbox', value: 'bar', name: 'bar', checked: true },
              { type: 'radio', value: 'baz', name: 'baz', checked: false },
              { type: 'textarea', value: 'qux', name: 'qux' },
            ];
          default:
            return [];
        }
      },
      attr (selector) {
        switch (selector) {
          default:
          case 'data-type':
            return 'test_type';
          case 'data-value':
            return 'test_value';
          case 'data-lane-id':
            return 'test';
        }
      },
      addClass (className) {
        target[className] = true;
        return this;
      },
      removeClass (className) {
        target[className] = false;
        return this;
      },
      siblings () { return namespace.$(target.siblings); },
      parents () { return namespace.$(target.parents); },
      width () { return namespace.window?.render_null ? false : 1024; },
      height () { return namespace.window?.render_null ? false : 768; },
      html (str) { namespace.html_calls[target] = str; },
      length: 1,
    };
  };

  // Some tests call these APIs; make them safe to invoke.
  if (!Accounts.onResetPasswordLink) Accounts.onResetPasswordLink = () => { };
  if (!Accounts.resetPassword) Accounts.resetPassword = () => { };

  // In tests, allow shared UI logic to call these without a real browser.
  if (!namespace.alert) namespace.alert = computeAlert(false);
  if (!namespace.confirm) namespace.confirm = computeConfirm(false);
  if (!namespace.window) namespace.window = computeWindow(false);

  // Override enables tests that rely on accessing the current user.
  namespace.user = () => ({ emails: [{ address: 'test@harbormaster.io' }] });
};


