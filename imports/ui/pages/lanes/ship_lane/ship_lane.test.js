import {
  lane,
  work_preview,
  active,
  created,
  exit_code,
  shipment_history,
  any_active,
  reset_all_active,
  reset_shipment,
  has_work_output,
  work_output,
  duration,
  pretty_date,
  start_shipment,
  handle_shipment_started,
  not_found,
  not_found_text,
} from './lib';
import { expect } from 'chai';
import { HTTP } from 'meteor/http';
import { Shipments } from '../../../../api/shipments';
import { Harbors } from '../../../../api/harbors';
import { Lanes } from '../../../../api/lanes';
import { resetDatabase } from 'cleaner';

const shipments_find = Shipments.find;
const shipments_find_one = Shipments.findOne;
const harbors_find_one = Harbors.findOne;
const lanes_find_one = Lanes.findOne;
const http_post = HTTP.post;
const call_method = H.call;

describe('Ship Lane View', () => {
  before(() => resetDatabase(null));

  describe('#lane', () => {
    it('returns the current lane by slug, or false', () => {
      this.$route = { params: { slug: 'test' } };
      expect(typeof lane()).to.eq('object');
      this.$route = undefined;
      expect(lane()).to.eq(false);
    });
  });

  describe('#active', () => {
    it(
      'returns true if the current shipment is active, otherwise false',
      () => {
        const test_start_date = '2023-1-1-12-12-12';
        this.$route = { params: { slug: 'test', date: test_start_date } };
        Shipments.find = () => ({ fetch: () => [{ start: test_start_date }] });
        expect(active()).to.eq(true);
        Shipments.find = () => ({ fetch: () => [] });
        expect(active()).to.eq(false);
        Shipments.find = shipments_find;
      });
  });

  describe('#created', () => {
    it('tracks a historical view', () => {
      this.$data = { historical: false };
      this.$route = {
        params: { date: 'test' },
        query: {},
      };
      created();
      expect(this.$data.historical).to.eq(true);
    });
    it('starts a shipment if user_id and token are given', () => {
      this.$data = {};
      this.$route = {
        params: {},
        query: { user_id: 'test', token: 'test' },
        fullPath: 'test',
      };
      HTTP.post = (path) => {
        expect(path).to.eq(this.$route.fullPath);
      };
      created();
      HTTP.post = http_post;
    });
  });

  describe('#exit_code', () => {
    it('returns an empty string for a non-existant or active shipment', () => {
      this.$route = { params: { slug: 'test', date: 'test' } };
      Shipments.findOne = () => { };
      expect(exit_code()).to.eq('');
      Shipments.findOne = () => ({ active: true });
      H.Session.set('lane', { _id: 'test' });
      expect(exit_code()).to.eq('');
      Shipments.findOne = shipments_find_one;
    });
    it('returns the exit code for a shipment by date', () => {
      this.$route = { params: { slug: 'test', date: 'test' } };
      Shipments.findOne = () => ({ exit_code: 0 });
      H.Session.set('lane', { _id: 'test' });
      expect(exit_code()).to.eq(0);
      Shipments.findOne = shipments_find_one;
    });
  });

  describe('#work_preview', () => {

    after(() => {
      Harbors.findOne = harbors_find_one;
      Shipments.findOne = shipments_find_one;
      Lanes.findOne = lanes_find_one;
      H.call = call_method;
    });

    it('returns not found text if no work is configured', () => {
      not_found.set(true);
      this.$route = { params: { slug: 'test' } };
      expect(work_preview()).to.eq(not_found_text);
    });
    it('returns the rendered work preview for a historical shipment', () => {
      not_found.set(false);
      this.$route = { params: { slug: 'test', date: 'test' } };
      Shipments.findOne = () => ({ rendered_work_preview: '<p>test</p>' });
      expect(work_preview()).to.eq('<p>test</p>');
      Shipments.findOne = shipments_find_one;
    });
    it('renders a work preview if none exist', () => {
      Harbors.findOne = () => ({ lanes: { test: { _id: 'test' } } });
      this.$route = { params: { slug: 'test', manifest: {} } };
      H.call = (method) => expect(method).to.eq('Harbors#render_work_preview');
      work_preview();
    });
    it('upserts the lane and sets the Session on successful render', () => {
      Harbors.findOne = () => ({ lanes: { test: { _id: 'test' } } });
      this.$route = { params: { slug: 'test', manifest: {} } };
      H.call = (method, lane, callback) => {
        if (method == 'Lanes#upsert') {
          callback();
          expect(H.Session.get('lane')._id).to.eq('test');
        }
      };
      work_preview();
    });
    it('returns the currently configured work preview for a lane', () => {
      H.Session.set('lane', {
        _id: 'test',
        name: 'test',
        rendered_work_preview: '<p>test</p>',
      });
      Harbors.findOne = () => { };
      Lanes.findOne = () => { };
      this.$route = { params: { slug: 'test', manifest: {} } };
      not_found.set(false);
      expect(work_preview()).to.eq('<p>test</p>');
    });
    it('returns not ready text if the lane requires configuration', () => {
      H.Session.set('lane', { _id: 'test', name: 'test' });
      this.$route = { params: { slug: 'test', manifest: {} } };
      not_found.set(false);
      const expected_link = '<a href="/lanes/test/edit">Edit this lane</a>';
      let expected_result = `<h4>This Harbor is not ready`;
      expected_result += `, or otherwise not fully configured.</h4>\n`;
      expected_result += `<p>Please ${expected_link}`;
      expected_result += ` and complete its configuration.</p >`;
      expect(work_preview()).to.eq(expected_result);
    });
  });

  describe('#has_work_output', () => {

    after(() => Shipments.findOne = shipments_find_one);

    it('returns true if the given shipment date has output or errors', () => {
      this.$route = { params: { slug: 'test', date: 'test' } };
      Shipments.findOne = () => ({ stdout: { test_date: ['test'] } });
      expect(has_work_output()).to.eq(true);
      Shipments.findOne = () => ({ stderr: { test_date: ['test'] } });
      expect(has_work_output()).to.eq(true);
      Shipments.findOne = () => ({ exit_code: 0 });
      expect(has_work_output()).to.eq(true);
    });
    it(
      'returns true if there are any shipments even without stdout/err',
      () => {
        this.$route = { params: { slug: 'test', date: 'test' } };
        Shipments.findOne = () => ({});
        expect(has_work_output()).to.eq(true);
      });
    it('returns false otherwise', () => {
      this.$route = { params: { slug: 'test', date: 'test' } };
      Shipments.findOne = () => { };
      expect(has_work_output()).to.eq(false);
    });
  });

  describe('#work_output', () => {
    it('returns the latest shipment for a lane', () => {
      const test_lane = { slug: 'test', latest_shipment: { _id: 'foo' } };
      H.Session.set('lane', test_lane);
      this.$route = { params: { slug: 'test', date: 'test' } };
      expect(work_output()._id).to.eq('foo');
      H.Session.set('lane', undefined);
      Shipments.findOne = () => test_lane.latest_shipment;
      expect(work_output()._id).to.eq('foo');
      Shipments.findOne = shipments_find_one;
    });
  });

  describe('#shipment_history', () => {

    after(() => Shipments.find = shipments_find);

    it('returns the list of shipments capped by H.AMOUNT_SHOWN', () => {
      Shipments.find = () => {
        let shipments_found = [];
        for (let i = 0; i <= H.AMOUNT_SHOWN; i++) {
          shipments_found.push({ _id: `test_shipment_${i}` });
        }
        return shipments_found;
      };
      expect(shipment_history().length).to.eq(H.AMOUNT_SHOWN);
    });
  });

  describe('#pretty_date', () => {
    it('returns a locale string for a date passed', () => {
      const test_date = Date.now();
      expect(pretty_date(test_date))
        .to
        .eq(new Date(test_date).toLocaleString())
        ;
    });
    it('returns the never string for no date passed', () => {
      expect(pretty_date()).to.eq('never');
    });
  });

  describe('#duration', () => {
    it('returns a human readable duration of how long a shipment took', () => {
      const finished = new Date();
      const yesterday = new Date(new Date().setDate(finished.getDate() - 1));
      expect(duration({ finished, actual: yesterday })).to.eq('a day');
    });
  });

  describe('#any_active', () => {
    it('returns true if any shipments are active for a lane', () => {
      this.$route = { params: { slug: 'test' } };
      Shipments.find = () => ({ count: () => true });
      expect(any_active()).to.eq(true);
    });
  });

  describe('#reset_shipment', () => {
    it('resets an active shipment given a date and lane slug', () => {
      this.$route = { params: { date: 'test', slug: 'test' } };
      H.call = (method, slug, date) => {
        expect(method).to.eq('Lanes#reset_shipment');
        expect(slug).to.eq(date).to.eq('test');
      };
      reset_shipment();
      H.call = call_method;
    });
  });

  describe('#reset_all_active', () => {
    it('resets all active shipments for a lane', () => {
      this.$route = { params: { slug: 'test' } };
      H.call = (method, slug) => {
        expect(method).to.eq('Lanes#reset_all_active_shipments');
        expect(slug).to.eq('test');
      };
      reset_all_active();
      H.call = call_method;
    });
  });

  describe('#start_shipment', () => {
    before(() => {
      this.$router = [];
      this.$data = { rerenders: 0 };
      this.$route = { params: { slug: 'test' } };
      Shipments.findOne = () => { };
      H.Session.set('lane', { _id: 'test' });
    });
    after(() => {
      Shipments.findOne = shipments_find_one;
      Harbors.findOne = harbors_find_one;
    });

    it('saves the working lane reference in the Session', () => {
      H.call = () => { };
      Harbors.findOne = () => ({ lanes: { test: { manifest: {} } } });
      expect(H.Session.get('working_lanes')).to.eq(undefined);
      start_shipment();
      expect(H.Session.get('working_lanes').test).to.eq(true);
      H.call = call_method;
    });
    it('starts a shipment for the lane', () => {
      H.call = (method, id, manifest, date_string) => {
        expect(method).to.eq('Lanes#start_shipment');
        expect(typeof id).to.eq('string');
        expect(typeof manifest).to.eq('object');
        expect(typeof date_string).to.eq('string');
      };
      start_shipment();
      H.call = call_method;
    });
    it('throws if it receives an error', () => {
      H.call = (method, id, manifest, date_string, callback) => {
        expect(() => callback(true)).to.throw();
      };
      start_shipment();
      H.call = call_method;
    });
    it('sets the working lane to false in the Session when complete', () => {
      const test_id = 'test';
      H.Session.set('working_lanes', { test: true });
      H.call = (method, id, manifest, date_string, callback) => callback();
      start_shipment();
      expect(H.Session.get('working_lanes')[test_id]).to.eq(false);
      H.call = call_method;
    });
    it('navigates to the active shipment', () => {
      H.call = (method, id, manifest, date_string, callback) => callback();
      this.$router = [];
      start_shipment();
      expect(this.$router.length).to.eq(1);
      H.call = call_method;
    });
  });

});
