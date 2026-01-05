import { expect } from 'chai';
import {
  add_new_harbor,
  currently_registered,
  found_in_depot,
  get_space_avail,
  registration_button_title,
  register,
  remove,
} from './lib';

describe('Harbors Page', () => {
  const call_method = H.call;
  const ctx = { space_avail: 'Loading' };

  describe('#add_new_harbor', () => {
    it('only accepts git urls', () => {
      const originalAlert = H.alert;
      const originalConfirm = H.confirm;
      const originalCall = H.call;
      let alerted = '';
      let confirmCalled = false;
      let callCalled = false;
      try {
        H.alert = (msg) => { alerted = String(msg); };
        H.confirm = () => { confirmCalled = true; return true; };
        H.call = () => { callCalled = true; };
        add_new_harbor(); // evt missing -> url undefined -> not a git URL
        expect(alerted).to.include("Doesn't appear to be a proper git url.");
        expect(confirmCalled).to.eq(false);
        expect(callCalled).to.eq(false);
      }
      finally {
        H.alert = originalAlert;
        H.confirm = originalConfirm;
        H.call = originalCall;
      }
    });

    it('returns early when user cancels confirmation', () => {
      const originalConfirm = H.confirm;
      const originalCall = H.call;
      let called = false;
      try {
        H.confirm = () => false;
        H.call = () => { called = true; };
        const evt = {
          target: {
            elements: {
              harbor_url: {
                value: 'git@github.com:test/test.git',
              },
            },
          },
        };
        add_new_harbor(evt);
        expect(called).to.eq(false);
      }
      finally {
        H.confirm = originalConfirm;
        H.call = originalCall;
      }
    });

    it('adds the harbor to the depot (and handles callback branches)', () => {
      const originalConfirm = H.confirm;
      const originalAlert = H.alert;
      const originalReload = H.window.location.reload;
      const originalCall = H.call;

      let alerted = [];
      let reloaded = 0;
      try {
        H.confirm = () => true;
        H.alert = (msg) => { alerted.push(String(msg)); };
        H.window.location.reload = () => { reloaded++; };

        const evt = {
          target: {
            elements: {
              harbor_url: {
                value: 'git@github.com:test/test.git',
              },
            },
          },
        };

        // err -> alert(err)
        H.call = (method, url, cb) => {
          expect(method).to.eq('Harbors#add_harbor_to_depot');
          expect(url).to.eq('git@github.com:test/test.git');
          cb(new Error('boom'));
        };
        add_new_harbor(evt);
        expect(alerted.join('\n')).to.include('Error: boom');

        // res.stderr -> alert(stderr)
        H.call = (method, url, cb) => cb(null, { stderr: 'bad news' });
        add_new_harbor(evt);
        expect(alerted.join('\n')).to.include('bad news');

        // success -> reload
        H.call = (method, url, cb) => cb(null, { stderr: '' });
        add_new_harbor(evt);
        expect(reloaded).to.eq(1);
      }
      finally {
        H.confirm = originalConfirm;
        H.alert = originalAlert;
        H.window.location.reload = originalReload;
        H.call = originalCall;
      }
    });
  });

  describe('#currently_registered', () => {
    it('returns a cursor of registered harbors', () => {
      const cursor = currently_registered();
      expect(cursor._cursorDescription.collectionName).to.eq('Harbors');
      expect(cursor._cursorDescription.selector.registered).to.eq(true);
    });
  });
  describe('#found_in_depot', () => {
    it('returns a cursor of harbors found in the depot', () => {
      const cursor = found_in_depot();
      expect(cursor._cursorDescription.collectionName).to.eq('Harbors');
      expect(cursor._cursorDescription.selector.in_depot).to.eq(true);
    });
  });
  describe('#get_space_avail', () => {
    it('sets the space_avail data for the view', () => {
      const originalLog = console.log;
      let logged = '';
      try {
        console.log = (msg) => { logged += String(msg); };
        H.call = (method, cb) => {
          expect(method).to.eq('Harbors#space_avail');
          cb(null, '123 GB');
        };
        get_space_avail.bind(ctx)();
        expect(ctx.space_avail).to.eq('123 GB');
        expect(logged).to.include('Detected 123 GB space available.');
      }
      finally {
        console.log = originalLog;
        H.call = call_method;
      }
    });
  });
  describe('#registration_button_title', () => {
    it('returns a harbor de/registration string', () => {
      expect(registration_button_title({ _id: 'test', registered: true }))
        .to.eq('Deregister "test"');
      expect(registration_button_title({ _id: 'test', registered: false }))
        .to.eq('Register "test"');
    });
  });

  describe('#register', () => {

    it('warns about the registration change and subsequent reload', () => {
      const originalConfirm = H.confirm;
      const originalCall = H.call;
      let callCalled = false;
      try {
        H.confirm = () => true;
        H.call = () => { callCalled = true; };
        register({ _id: 'test', registered: false });
        expect(callCalled).to.eq(true);
      }
      finally {
        H.confirm = originalConfirm;
        H.call = originalCall;
      }
    });

    it('returns early when user cancels confirmation', () => {
      const originalConfirm = H.confirm;
      const originalCall = H.call;
      let callCalled = false;
      try {
        H.confirm = () => false;
        H.call = () => { callCalled = true; };
        register({ _id: 'test', registered: true });
        expect(callCalled).to.eq(false);
      }
      finally {
        H.confirm = originalConfirm;
        H.call = originalCall;
      }
    });
    it('throws if an error occurs', () => {
      const originalConfirm = H.confirm;
      H.confirm = () => true;
      H.call = (method, harbor, callback) => {
        expect(method).to.eq('Harbors#register');
        expect(() => callback(true)).to.throw();
      };
      register({ _id: 'test', registered: false });
      H.call = call_method;
      H.confirm = originalConfirm;
    });
    it('alerts if it receives a not found (404)', () => {
      const originalConfirm = H.confirm;
      const originalAlert = H.alert;
      H.confirm = () => true;
      let called = false;
      H.alert = () => { called = true; };
      H.call = (method, harbor, callback) => {
        callback(null, 404);
        expect(called).to.eq(true);
      };
      register({ _id: 'test', registered: true });
      H.call = call_method;
      H.alert = originalAlert;
      H.confirm = originalConfirm;
    });

    it('reloads via setTimeout in non-test mode', () => {
      const originalIsTest = H.isTest;
      const originalConfirm = H.confirm;
      const originalSetTimeout = global.setTimeout;
      const originalReload = H.window.location.reload;
      const originalLog = console.log;

      let timeoutMs;
      let reloaded = false;
      let logged = false;
      try {
        H.isTest = false;
        H.confirm = () => true;
        console.log = () => { logged = true; };
        H.window.location.reload = () => { reloaded = true; };
        global.setTimeout = (fn, ms) => {
          timeoutMs = ms;
          fn();
          return 0;
        };

        H.call = () => { };
        register({ _id: 'test', registered: false });
        expect(timeoutMs).to.eq(10000);
        expect(logged).to.eq(true);
        expect(reloaded).to.eq(true);
      }
      finally {
        H.isTest = originalIsTest;
        H.confirm = originalConfirm;
        global.setTimeout = originalSetTimeout;
        H.window.location.reload = originalReload;
        console.log = originalLog;
        H.call = call_method;
      }
    });
  });

  describe('#remove', () => {

    it('warns about deleting the harbor and subsequent reload', () => {
      const originalConfirm = H.confirm;
      const originalCall = H.call;
      let callCalled = false;
      try {
        H.confirm = () => true;
        H.call = () => { callCalled = true; };
        remove({ _id: 'test' });
        expect(callCalled).to.eq(true);
      }
      finally {
        H.confirm = originalConfirm;
        H.call = originalCall;
      }
    });

    it('returns early when user cancels confirmation', () => {
      const originalConfirm = H.confirm;
      const originalCall = H.call;
      let callCalled = false;
      try {
        H.confirm = () => false;
        H.call = () => { callCalled = true; };
        remove({ _id: 'test' });
        expect(callCalled).to.eq(false);
      }
      finally {
        H.confirm = originalConfirm;
        H.call = originalCall;
      }
    });
    it('removes the harbor and reloads the page', () => {
      let called = false;
      const originalConfirm = H.confirm;
      H.confirm = () => true;
      H.window.location.reload = () => { called = true; };
      H.call = (method, harbor, callback) => {
        expect(method).to.eq('Harbors#remove');
        callback(null, true);
        expect(called).to.eq(true);
      };
      remove({ _id: 'test' });
      H.call = call_method;
      H.confirm = originalConfirm;
    });

    it('alerts when remove returns an error', () => {
      const originalConfirm = H.confirm;
      const originalAlert = H.alert;
      H.confirm = () => true;
      let alerted = false;
      H.alert = () => { alerted = true; };
      H.call = (method, harbor, cb) => cb(new Error('boom'));
      remove({ _id: 'test' });
      expect(alerted).to.eq(true);
      H.call = call_method;
      H.alert = originalAlert;
      H.confirm = originalConfirm;
    });

    it('does nothing when remove returns a falsy result', () => {
      const originalConfirm = H.confirm;
      const originalReload = H.window.location.reload;
      H.confirm = () => true;
      let reloaded = false;
      H.window.location.reload = () => { reloaded = true; };
      H.call = (method, harbor, cb) => cb(null, false);
      remove({ _id: 'test' });
      expect(reloaded).to.eq(false);
      H.call = call_method;
      H.window.location.reload = originalReload;
      H.confirm = originalConfirm;
    });
  });
});
