import view from './shipping_log.vue';
import { expect } from 'chai';

describe('Shipping Log component', () => {
  describe('#is_ready', () => {
    it('returns true when the subscriptions are ready', () => {
      this.$subReady = { Shipments: false, Lanes: false };
      expect(view.methods.is_ready.bind(this)()).to.eq(false);
      this.$subReady.Shipments = this.$subReady.Lanes = true;
      expect(view.methods.is_ready.bind(this)()).to.eq(true);
    });
  });
});
