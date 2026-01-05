import { expect } from 'chai';
import { is_ready } from './lib';

describe('Shipping Log component', () => {
  describe('#is_ready', () => {
    it('returns true when the subscriptions are ready', () => {
      this.$subReady = { Shipments: false, Lanes: false };
      expect(is_ready.bind(this)()).to.eq(false);
      this.$subReady.Shipments = this.$subReady.Lanes = true;
      expect(is_ready.bind(this)()).to.eq(true);
    });

    it('logs readiness when not in test mode', () => {
      const originalIsTest = H.isTest;
      const originalLog = console.log;
      let logs = [];
      try {
        H.isTest = false;
        console.log = (msg) => { logs.push(String(msg)); };
        this.$subReady = { Shipments: true, Lanes: false };
        expect(is_ready.bind(this)()).to.eq(false);
        expect(logs.join('\n')).to.include('Shipments sub ready? true');
        expect(logs.join('\n')).to.include('Lanes sub ready? false');
      }
      finally {
        H.isTest = originalIsTest;
        console.log = originalLog;
      }
    });
  });
});
