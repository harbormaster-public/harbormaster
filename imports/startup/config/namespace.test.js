import { expect } from 'chai';
import { Accounts } from 'meteor/accounts-base';
import H from './namespace';
import {
  applyServerTestStubs,
  computeAlert,
  computeConfirm,
  computeClientE2E,
  computeWindow,
  reactiveVarShim,
  serverConfirm,
  serverReload,
} from '../../test-helpers/namespace-stubs';

describe('startup/config/namespace', () => {
  describe('H.start_shipment', () => {
    const originalCall = H.call;

    afterEach(() => {
      H.call = originalCall;
    });

    it('calls Lanes#start_shipment with provided date', () => {
      let args;
      H.call = (...a) => { args = a; };
      const res = H.start_shipment('lane-id', { foo: 'bar' }, 'DATE');
      expect(res).to.eq(undefined);
      expect(args[0]).to.eq('Lanes#start_shipment');
      expect(args[1]).to.eq('lane-id');
      expect(args[2]).to.deep.eq({ foo: 'bar' });
      expect(args[3]).to.eq('DATE');
    });

    it('defaults date when not provided', () => {
      let args;
      H.call = (...a) => { args = a; };
      H.start_shipment('lane-id', {});
      expect(args[0]).to.eq('Lanes#start_shipment');
      expect(args[3]).to.be.ok;
    });
  });

  describe('H.end_shipment', () => {
    const originalCall = H.call;

    afterEach(() => {
      H.call = originalCall;
    });

    it('calls Lanes#end_shipment', () => {
      let args;
      H.call = (...a) => { args = a; };
      H.end_shipment({ _id: 'lane' }, 0, { ok: true });
      expect(args[0]).to.eq('Lanes#end_shipment');
      expect(args[1]).to.deep.eq({ _id: 'lane' });
      expect(args[2]).to.eq(0);
      expect(args[3]).to.deep.eq({ ok: true });
    });
  });

  describe('H.ReactiveVar', () => {
    it('supports get/set', () => {
      const rv = H.ReactiveVar(1);
      expect(rv.get()).to.eq(1);
      rv.set(2);
      expect(rv.get()).to.eq(2);
    });
    it('exposes a reactiveVarShim that supports get/set', () => {
      const rv = reactiveVarShim(1);
      expect(rv.get()).to.eq(1);
      rv.set(2);
      expect(rv.get()).to.eq(2);
    });
  });

  describe('H.$ stubs', () => {
    it('provides form inputs and default empty selector list', () => {
      const el = H.$({ });
      expect(el.find('input, textarea').length).to.be.greaterThan(0);
      expect(el.find('something-else')).to.deep.eq([]);
    });

    it('supports attr switch cases', () => {
      const el = H.$({ });
      expect(el.attr('data-type')).to.eq('test_type');
      expect(el.attr('data-value')).to.eq('test_value');
      expect(el.attr('data-lane-id')).to.eq('test');
    });

    it('covers default attr branch', () => {
      const el = H.$({ });
      expect(el.attr('some-other-key')).to.eq('test_type');
    });

    it('records html() calls', () => {
      const key = {};
      H.$(key).html('<p>hello</p>');
      expect(H.html_calls[key]).to.eq('<p>hello</p>');
    });
  });

  describe('Accounts stubs', () => {
    it('has reset-password hooks in test mode', () => {
      applyServerTestStubs(H);
      // In test mode we ensure these exist so other tests can safely call them.
      expect(Accounts.onResetPasswordLink).to.be.a('function');
      expect(Accounts.resetPassword).to.be.a('function');
      Accounts.onResetPasswordLink(() => {});
      Accounts.resetPassword('token', 'newpass', () => {});
    });
  });

  describe('serverConfirm', () => {
    it('is exposed for direct invocation', () => {
      expect(serverConfirm).to.be.a('function');
      expect(() => serverConfirm('x')).to.not.throw();
    });
  });

  describe('computeAlert', () => {
    it('covers client/server branches', () => {
      const originalWindow = global.window;
      try {
        let calls = 0;
        global.window = {
          alert: () => { calls += 1; },
        };
        const clientAlert = computeAlert(true);
        expect(clientAlert).to.be.a('function');
        expect(() => clientAlert('x')).to.not.throw();
        expect(calls).to.eq(1);
        expect(computeAlert(false)).to.be.a('function');
      }
      finally {
        global.window = originalWindow;
      }
    });
  });

  describe('H.window', () => {
    it('supports location.reload() stub', () => {
      applyServerTestStubs(H);
      expect(() => H.window.location.reload()).to.not.throw();
    });
    it('exposes serverReload for direct invocation', () => {
      expect(serverReload).to.be.a('function');
      expect(() => serverReload()).to.not.throw();
    });

    it('exposes computeWindow and covers client/server branches', () => {
      const originalWindow = global.window;
      try {
        global.window = {
          confirm: () => true,
          document: { createElement: () => ({}), body: {}, head: {} },
        };

        expect(computeWindow(true)).to.eq(global.window);
        const serverWin = computeWindow(false);
        expect(serverWin).to.be.an('object');
        expect(serverWin.location.host).to.eq('localhost:4040');
      }
      finally {
        global.window = originalWindow;
      }
    });
  });

  describe('server test stubs', () => {
    it('applyServerTestStubs populates missing stubs (ReactiveVar)', () => {
      const originalReactiveVar = H.ReactiveVar;
      try {
        H.ReactiveVar = undefined;
        applyServerTestStubs(H);
        expect(H.ReactiveVar).to.be.a('function');
        const rv = H.ReactiveVar(3);
        expect(rv.get()).to.eq(3);
      }
      finally {
        H.ReactiveVar = originalReactiveVar;
      }
    });
  });

  describe('computeConfirm', () => {
    it('covers client/server branches', () => {
      const originalWindow = global.window;
      try {
        global.window = { confirm: () => true };
        expect(computeConfirm(true)).to.be.a('function');
        expect(computeConfirm(false)).to.eq(serverConfirm);
      }
      finally {
        global.window = originalWindow;
      }
    });
  });

  describe('computeClientE2E', () => {
    it('covers window.Cypress evaluation', () => {
      const originalWindow = global.window;
      try {
        global.window = { Cypress: true };
        expect(computeClientE2E(true, global.window)).to.eq(true);
        expect(computeClientE2E(false, global.window)).to.eq(false);
      }
      finally {
        global.window = originalWindow;
      }
    });
  });
});


