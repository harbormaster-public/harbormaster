import { expect } from 'chai';
import H from '../../../startup/config/namespace';
import { delete_lane } from './lib';

describe('Lane deletion warnings', () => {
  [true, false].forEach(typed => {
    it(`shows a deletion warning and restores the row: ${typed}`, () => {
      const confirm = H.confirm;
      const call = H.call;
      const dollar = H.$;
      const alert = H.alert;
      const message = 'Reset the active shipment before deleting the lane.';
      const error = typed ? { reason: message } : new Error(message);
      const row = {
        deleting: false,
        addClass () { this.deleting = true; },
        removeClass () { this.deleting = false; },
      };
      let warning;
      try {
        H.confirm = () => true;
        H.$ = () => ({ parents: () => row });
        H.alert = value => { warning = value; };
        H.call = (method, lane, callback) => callback(error);
        H.Session.set('total_lanes', 3);
        delete_lane({ target: {} }, { _id: 'busy' });
        expect(warning).to.eq(message);
        expect(row.deleting).to.eq(false);
        expect(H.Session.get('total_lanes')).to.eq(3);
      }
      finally {
        H.confirm = confirm;
        H.$ = dollar;
        H.alert = alert;
        H.call = call;
      }
    });
  });
});
