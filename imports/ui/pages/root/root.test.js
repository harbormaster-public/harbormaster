import { expect } from 'chai';
import {
  shipments_last_24_hours,
  latest_shipment,
  total_captains,
  total_harbormasters,
  is_harbormaster,
  is_captain,
} from './lib';
import { resetDatabase } from 'cleaner';
const call_method = H.call;

describe('Root Page (/)', () => {

  describe('#shipments_last_24_hours', function () {
    it('returns the total_shipments in locale string', () => {
      expect(shipments_last_24_hours()).to.eq('Loading');
    });
  });

  describe('#latest_shipment', function () {
    it('returns a loading object if no shipment is available', () => {
      expect(latest_shipment().locale).to.eq('loading...');
    });
    it('gets the latest shipment date and saves it in Session', () => {
      H.call = (method) => expect(method).to.eq('Shipments#get_latest_date');
      latest_shipment();
      H.call = call_method;
    });
    it('returns the latest shipment date from Session', () => {
      H.call = () => { };
      H.Session.set('latest_shipment', 'test');
      expect(latest_shipment()).to.eq('test');
      H.call = call_method;
    });
  });

  describe('#total_captains', function () {
    it('returns the total number of captains across all lanes', () => {
      resetDatabase(null);
      expect(total_captains()).to.eq('0');
      Factory.create('lane', { captains: ['test@harbormaster.io'] });
      expect(total_captains()).to.eq('1');
    });
  });

  describe('#total_harbormasters', function () {
    it('returns the total number of current harbormasters', () => {
      resetDatabase(null);
      expect(total_harbormasters()).to.eq('0');
      Factory.create('user', { harbormaster: true });
      expect(total_harbormasters()).to.eq('1');
    });
  });

  describe('#is_harbormaster', function () {
    it('returns true if current the user is a harbormaster', () => {
      resetDatabase(null);
      Factory.create('user', {
        _id: H.user().emails[0].address,
        harbormaster: true,
      });
      expect(is_harbormaster()).to.eq(true);
    });
  });

  describe('#is_captain', function () {
    it('returns true if the user is captain of any lanes', () => {
      resetDatabase(null);
      Factory.create('lane', { captains: [H.user().emails[0].address] });
      expect(is_captain()).to.eq(true);
    });
    it('returns false otherwise', () => {
      resetDatabase(null);
      expect(is_captain()).to.eq(false);
    });
  });

});
