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
  not_found,
  not_found_text,
} from './lib';
import { expect } from 'chai';
import { HTTP } from 'meteor/http';
import { Shipments } from '../../../../api/shipments';
import { Harbors } from '../../../../api/harbors';
import { Lanes } from '../../../../api/lanes';
import { resetDatabase } from '../../../../test-helpers/reset-database';
import {
  setupInMemoryCollection,
} from '../../../../test-helpers/setup-collection-stubs';
import '../../../../startup/config/constants';

const http_post = HTTP.post;

describe('Ship Lane View', () => {
  const call_method = H.call;
  let shipmentsStub;
  let lanesStub;
  let harborsStub;

  beforeEach(async () => {
    await resetDatabase();
    shipmentsStub = setupInMemoryCollection(Shipments);
    lanesStub = setupInMemoryCollection(Lanes);
    harborsStub = setupInMemoryCollection(Harbors);
  });

  afterEach(() => {
    H.call = call_method;
    if (shipmentsStub) shipmentsStub.restore();
    if (lanesStub) lanesStub.restore();
    if (harborsStub) harborsStub.restore();
  });

  describe('#lane', () => {
    it('returns the current lane by slug, or false', async () => {
      this.$route = { params: { slug: 'test' } };
      H.Session.set('lane', { _id: 'test', name: 'test', slug: 'test' });
      expect(typeof await lane.call(this)).to.eq('object');
      this.$route = undefined;
      H.Session.set('lane', { _id: 'slug', name: 'slug', slug: 'slug' });
      expect(typeof await lane.call(this, 'slug')).to.eq('object');
      H.Session.set('lane', undefined);
      expect(await lane.call(this)).to.eq(false);
    });
  });

  describe('#active', () => {
    it(
      'returns true if the current shipment is active, otherwise false',
      async () => {
        const test_start_date = '2023-1-1-12-12-12';
        this.$route = { params: { slug: 'test', date: test_start_date } };
        H.Session.set('lane', { _id: 'test', slug: 'test' });
        shipmentsStub.insert({
          _id: 'test',
          lane: 'test',
          start: test_start_date,
          active: true,
        });
        expect(await active.call(this)).to.eq(true);
        shipmentsStub.clear();
        shipmentsStub.insert({
          _id: 'test',
          lane: 'test',
          start: test_start_date,
          active: false,
        });
        expect(await active.call(this)).to.eq(false);
      });
    it('returns true if the lane last_shipment is active', async () => {
      this.$route = { params: { slug: 'test', date: 'irrelevant' } };
      H.Session.set('lane', {
        _id: 'test',
        slug: 'test',
        last_shipment: { active: true },
      });
      shipmentsStub.clear();
      expect(await active.call(this)).to.eq(true);
    });
  });

  describe('#created', () => {
    it('tracks a historical view when date and $data exist', function () {
      this.$data = { historical: false };
      this.$route = {
        params: { date: 'test' },
        query: {},
      };
      created.call(this);
      expect(this.$data.historical).to.eq(true);
    });
    it(
      'does not set historical when date exists but $data is missing',
      function () {
        this.$data = undefined;
        this.$route = {
          params: { date: 'test' },
          query: {},
        };
        created.call(this);
        expect(this.$data).to.eq(undefined);
      },
    );
    it('does not set historical when date is missing', function () {
      this.$data = { historical: false };
      this.$route = {
        params: {},
        query: {},
      };
      created.call(this);
      expect(this.$data.historical).to.eq(false);
    });
    it('does not set historical when params is missing', function () {
      this.$data = { historical: false };
      this.$route = {
        query: {},
      };
      created.call(this);
      expect(this.$data.historical).to.eq(false);
    });
    it('starts a shipment if user_id and token are given', function () {
      this.$data = {};
      this.$route = {
        params: {},
        query: { user_id: 'test', token: 'test' },
        fullPath: 'test',
      };
      const self = this;
      HTTP.post = (path) => {
        expect(path).to.eq(self.$route.fullPath);
      };
      created.call(this);
      HTTP.post = http_post;
    });
    it('logs shipment started when POST succeeds (non-test mode)', function () {
      const originalIsTest = H.isTest;
      const originalLog = console.log;
      let logged = '';
      try {
        H.isTest = false;
        console.log = (msg) => { logged = String(msg); };
        this.$data = {};
        this.$route = {
          params: {},
          query: { user_id: 'test', token: 'test' },
          fullPath: 'test',
        };
        HTTP.post = (path, cb) => {
          expect(path).to.eq(this.$route.fullPath);
          cb(null, { ok: true });
        };
        created.call(this);
        expect(logged).to.include('Shipment started.');
      }
      finally {
        H.isTest = originalIsTest;
        console.log = originalLog;
        HTTP.post = http_post;
      }
    });
    it(
      'handles missing query property by using empty object fallback',
      function () {
        this.$data = {};
        this.$route = {
          params: {},
        };
        let httpPostCalled = false;
        HTTP.post = () => {
          httpPostCalled = true;
        };
        created.call(this);
        expect(httpPostCalled).to.eq(false);
        HTTP.post = http_post;
      },
    );
  });

  describe('#exit_code', () => {
    let ctx = {};
    beforeEach(() => {
      lanesStub.insert({
        _id: 'test',
        name: 'test',
        slug: 'test',
      });
      ctx.$route = { params: { slug: 'test', date: 'test' } };
      H.Session.set('lane', { _id: 'test', slug: 'test' });
    });
    it(
      'returns an empty string for a non-existant shipment',
      async function () {
        expect(await exit_code.call(ctx)).to.eq('');
      });
    it(
      'returns an empty string for an active shipment',
      async function () {
        shipmentsStub.insert({
          lane: 'test',
          start: 'test',
          active: true,
        });
        expect(await exit_code.call(ctx)).to.eq('');
      });
    it('returns the exit code for a shipment by date', async function () {
      shipmentsStub.insert({
        lane: 'test',
        start: 'test',
        exit_code: 0,
      });
      expect(await exit_code.call(ctx)).to.eq(0);
    });
    it(
      "returns the lane's last shipment exit code if no shipment is found",
      async function () {
        lanesStub.clear();
        lanesStub.insert({
          _id: 'test',
          name: 'test',
          slug: 'test',
          last_shipment: { exit_code: 1 },
        });
        H.Session.set('lane', {
          _id: 'test',
          name: 'test',
          slug: 'test',
          last_shipment: { exit_code: 1 },
        });
        expect(await exit_code.call(ctx)).to.eq(1);
      },
    );
    it('returns empty string when lane has no _id', async function () {
      lanesStub.clear();
      H.Session.set('lane', undefined);
      ctx.$route = { params: { slug: 'nonexistent', date: 'test' } };
      expect(await exit_code.call(ctx)).to.eq('');
    });
  });

  describe('#work_preview', () => {
    afterEach(() => {
      H.call = call_method;
    });

    it('returns not found text if no work is configured', async function () {
      not_found.set(true);
      this.$route = { params: { slug: 'test' } };
      H.Session.set('lane', { _id: 'test', slug: 'test' });
      expect(await work_preview.call(this)).to.eq(not_found_text);
    });
    it(
      'returns the rendered work preview for a historical shipment',
      async function () {
        not_found.set(false);
        this.$route = { params: { slug: 'test', date: 'test' } };
        H.Session.set('lane', { _id: 'test', slug: 'test' });
        shipmentsStub.insert({
          lane: 'test',
          start: 'test',
          rendered_work_preview: '<p>test</p>',
        });
        expect(await work_preview.call(this)).to.eq('<p>test</p>');
      });
    it('renders a work preview if none exist', async function () {
      lanesStub.insert({
        _id: 'test',
        name: 'test',
        slug: 'test',
        rendered_work_preview: undefined,
      });
      H.Session.set('lane', {
        _id: 'test',
        name: 'test',
        slug: 'test',
        rendered_work_preview: undefined,
      });
      this.$route = { params: { slug: 'test', manifest: {} } };
      H.call = (method, $lane, manifest) => {
        expect(method).to.eq('Harbors#render_work_preview');
        expect($lane._id).to.eq('test');
        expect(manifest).to.eq(false);
      };
      await work_preview.call(this);
    });
    it('uses shipment manifest when available', async function () {
      lanesStub.insert({
        _id: 'test',
        name: 'test',
        slug: 'test',
        type: 'test',
        rendered_work_preview: undefined,
      });
      H.Session.set('lane', {
        _id: 'test',
        name: 'test',
        slug: 'test',
        type: 'test',
        rendered_work_preview: undefined,
      });
      harborsStub.insert({
        _id: 'test',
        type: 'test',
        lanes: {
          test: { manifest: {} },
        },
      });
      shipmentsStub.insert({
        lane: 'test',
        start: 'test_date',
        manifest: { test: 'manifest' },
      });
      not_found.set(false);
      this.$route = { params: { slug: 'test', date: 'test_date' } };
      H.call = (method, $lane, manifest) => {
        expect(method).to.eq('Harbors#render_work_preview');
        expect($lane._id).to.eq('test');
        expect(manifest).to.deep.eq({ test: 'manifest' });
      };
      await work_preview.call(this);
    });
    it(
      'uses harbor lane manifest when shipment manifest is not available',
      async function () {
        lanesStub.insert({
          _id: 'test',
          name: 'test',
          slug: 'test',
          type: 'test',
          rendered_work_preview: undefined,
        });
        H.Session.set('lane', {
          _id: 'test',
          name: 'test',
          slug: 'test',
          type: 'test',
          rendered_work_preview: undefined,
        });
        harborsStub.insert({
          _id: 'test',
          type: 'test',
          lanes: {
            test: { manifest: { harbor: 'manifest' } },
          },
        });
        shipmentsStub.insert({
          lane: 'test',
          start: 'test_date',
        });
        not_found.set(false);
        this.$route = { params: { slug: 'test', date: 'test_date' } };
        H.call = (method, $lane, manifest) => {
          expect(method).to.eq('Harbors#render_work_preview');
          expect($lane._id).to.eq('test');
          expect(manifest).to.deep.eq({ harbor: 'manifest' });
        };
        await work_preview.call(this);
      },
    );
    it(
      'sets manifest to false when no manifest is available',
      async function () {
        lanesStub.insert({
          _id: 'test',
          name: 'test',
          slug: 'test',
          type: 'test',
          rendered_work_preview: undefined,
        });
        H.Session.set('lane', {
          _id: 'test',
          name: 'test',
          slug: 'test',
          type: 'test',
          rendered_work_preview: undefined,
        });
        harborsStub.insert({
          _id: 'test',
          type: 'test',
          lanes: {
            test: {},
          },
        });
        shipmentsStub.insert({
          lane: 'test',
          start: 'test_date',
        });
        not_found.set(false);
        this.$route = { params: { slug: 'test', date: 'test_date' } };
        H.call = (method, $lane, manifest) => {
          expect(method).to.eq('Harbors#render_work_preview');
          expect($lane._id).to.eq('test');
          expect(manifest).to.eq(false);
        };
        await work_preview.call(this);
      },
    );
    it(
      'sets not_found when render_work_preview returns 404',
      async function () {
        lanesStub.insert({
          _id: 'test',
          name: 'test',
          slug: 'test',
          type: 'test',
          rendered_work_preview: undefined,
        });
        H.Session.set('lane', {
          _id: 'test',
          name: 'test',
          slug: 'test',
          type: 'test',
          rendered_work_preview: undefined,
        });
        harborsStub.insert({
          _id: 'test',
          type: 'test',
          lanes: { test: { manifest: {} } },
        });
        not_found.set(false);
        this.$route = { params: { slug: 'test' } };
        H.call = (method, $lane, manifest, cb) => {
          expect(method).to.eq('Harbors#render_work_preview');
          cb(null, 404);
        };
        await work_preview.call(this);
        expect(not_found.get()).to.eq(true);
        expect(await work_preview.call(this)).to.eq(not_found_text);
      });
    it(
      'stores rendered lane when render_work_preview returns a lane',
      async function () {
        const originalLog = console.log;
        let logged = '';
        try {
          console.log = (msg) => { logged = String(msg); };
          lanesStub.insert({
            _id: 'test',
            name: 'test',
            slug: 'test',
            type: 'test',
            rendered_work_preview: undefined,
          });
          H.Session.set('lane', {
            _id: 'test',
            name: 'test',
            slug: 'test',
            type: 'test',
            rendered_work_preview: undefined,
          });
          harborsStub.insert({
            _id: 'test',
            type: 'test',
            lanes: { test: { manifest: {} } },
          });
          not_found.set(false);
          this.$route = { params: { slug: 'test' } };
          const resLane = { _id: 'test', rendered_work_preview: '<p>ok</p>' };
          H.call = (method, $lane, manifest, cb) => {
            expect(method).to.eq('Harbors#render_work_preview');
            cb(null, resLane);
          };
          await work_preview.call(this);
          expect(H.Session.get('lane')).to.eq(resLane);
          // `lane.name` inside lib.js refers to the lane() function name
          // ("lane")
          expect(logged).to.include('Lane "lane" updated');
        }
        finally {
          console.log = originalLog;
        }
      });
    it(
      'upserts the lane and sets the Session on successful render',
      async function () {
        H.Session.set('lane', { _id: 'test', slug: 'test' });
        this.$route = { params: { slug: 'test', manifest: {} } };
        H.call = (method, $lane, callback) => {
          if (method == 'Lanes#upsert') {
            callback();
            expect(H.Session.get('lane')._id).to.eq('test');
          }
        };
        await work_preview.call(this);
      });
    it(
      'returns the currently configured work preview for a lane',
      async function () {
        H.Session.set('lane', {
          _id: 'test',
          name: 'test',
          slug: 'test',
          type: 'test',
          rendered_work_preview: '<p>test</p>',
        });
        this.$route = { params: { slug: 'test', manifest: {} } };
        harborsStub.insert({
          _id: 'test',
          type: 'test',
          lanes: {
            test: { manifest: {} },
          },
        });
        not_found.set(false);
        expect(await work_preview.call(this)).to.eq('<p>test</p>');
      });
    it(
      'returns not ready text if the lane requires configuration',
      async function () {
        H.Session.set('lane', { _id: 'test', name: 'test', slug: 'test' });
        this.$route = { params: { slug: 'test', manifest: {} } };
        not_found.set(false);
        const expected_link = '<a href="/lanes/test/edit">Edit this lane</a>';
        let expected_result = `<h4>This Harbor is not ready`;
        expected_result += `, or otherwise not fully configured.</h4>\n`;
        expected_result += `<p>Please ${expected_link}`;
        expected_result += ` and complete its configuration.</p >`;
        expect(await work_preview.call(this)).to.eq(expected_result);
      });

    it(
      'marks not_found when render_work_preview returns 404',
      async function () {
        not_found.set(false);
        this.$route = { params: { slug: 'test' } };
        lanesStub.clear();
        harborsStub.clear();
        shipmentsStub.clear();

        lanesStub.insert({ _id: 'test', slug: 'test', type: 'harbor' });
        H.Session.set('lane', { _id: 'test', slug: 'test', type: 'harbor' });
        harborsStub.insert({
          _id: 'harbor',
          lanes: {
            test: { manifest: { ok: true } },
          },
        });

        H.call = (method, laneArg, manifestArg, cb) => {
          expect(method).to.eq('Harbors#render_work_preview');
          expect(laneArg._id).to.eq('test');
          expect(manifestArg).to.deep.eq({ ok: true });
          cb(null, 404);
        };

        // First call triggers the callback and marks not_found.
        work_preview.call(this);
        expect(not_found.get()).to.eq(true);
        // Second call returns the not-found text.
        expect(work_preview.call(this)).to.eq(not_found_text);
      });
  });

  describe('#has_work_output', () => {
    beforeEach(() => {
      shipmentsStub.insert({
        _id: 'test',
        lane: 'test',
        start: 'test',
      });
      H.Session.set('lane', {
        _id: 'test',
        slug: 'test',
        last_shipment: { _id: 'test' },
      });
    });
    afterEach(() => {
      H.Session.set('lane', undefined);
    });

    it(
      'returns true if the given shipment date has output or errors',
      async () => {
        this.$route = { params: { slug: 'test', date: 'test' } };
        shipmentsStub.clear();
        shipmentsStub.insert({
          _id: 'test',
          lane: 'test',
          start: 'test',
          stdout: { 'test': 'test' },
        });
        expect(await has_work_output.call(this)).to.eq(true);
        shipmentsStub.clear();
        shipmentsStub.insert({
          _id: 'test',
          lane: 'test',
          start: 'test',
          stderr: { 'test': 'test' },
        });
        expect(await has_work_output.call(this)).to.eq(true);
        shipmentsStub.clear();
        shipmentsStub.insert({
          _id: 'test',
          lane: 'test',
          start: 'test',
        });
        expect(await has_work_output.call(this)).to.eq(true);
      });
    it(
      'returns true if there are any shipments even without stdout/err',
      async () => {
        this.$route = { params: { slug: 'test', date: 'test' } };
        expect(await has_work_output.call(this)).to.eq(true);
      });
    it('returns false otherwise', async () => {
      this.$route = { params: { slug: 'test', date: 'test' } };
      shipmentsStub.clear();
      expect(await has_work_output.call(this)).to.eq(false);
    });
  });

  describe('#work_output', () => {
    it('returns the shipment found by date when it exists', async function () {
      const test_lane = {
        _id: 'test', slug: 'test', last_shipment: { _id: 'fallback' },
      };
      H.Session.set('lane', test_lane);
      shipmentsStub.insert({
        _id: 'found_shipment',
        lane: 'test',
        start: 'test_date',
      });
      this.$route = { params: { slug: 'test', date: 'test_date' } };
      const result = await work_output.call(this);
      expect(result._id).to.eq('found_shipment');
      expect(result._id).to.not.eq('fallback');
    });
    it('returns the latest shipment for a lane', async function () {
      const test_lane = {
        _id: 'test', slug: 'test', last_shipment: { _id: 'foo' },
      };
      H.Session.set('lane', test_lane);
      this.$route = { params: { slug: 'test', date: 'test' } };
      expect((await work_output.call(this))._id).to.eq('foo');
      H.Session.set('lane', undefined);
      lanesStub.insert({
        _id: 'test', slug: 'test', last_shipment: { _id: 'foo' },
      });
      expect((await work_output.call(this))._id).to.eq('foo');
    });
  });

  describe('#reset_shipment / #reset_all_active', () => {
    it('logs reset responses when route params exist', () => {
      const logOrig = console.log;
      let logs = [];
      try {
        console.log = (...args) => { logs.push(args.join(' ')); };
        this.$route = { params: { slug: 'test', date: 'd' } };

        H.call = (method, slug, dateOrCb, maybeCb) => {
          if (method === 'Lanes#reset_shipment') {
            const cb = maybeCb;
            expect(slug).to.eq('test');
            expect(dateOrCb).to.eq('d');
            cb(null, { ok: true });
          }
          else if (method === 'Lanes#reset_all_active_shipments') {
            const cb = dateOrCb;
            expect(slug).to.eq('test');
            cb(null, { ok: true });
          }
        };

        reset_shipment.call(this);
        reset_all_active.call(this);

        const joined = logs.join('\n');
        expect(joined).to.include('Reset shipment response:');
        expect(joined).to.include('Reset all active shipments response:');
      }
      finally {
        console.log = logOrig;
        H.call = call_method;
      }
    });
  });

  describe('#shipment_history', () => {
    beforeEach(() => {
      for (let i = 0; i < H.AMOUNT_SHOWN + 1; i++) {
        shipmentsStub.insert({
          lane: 'test',
          active: false,
        });
      }
    });

    it(
      'returns the list of shipments capped by H.AMOUNT_SHOWN',
      async function () {
        H.Session.set('lane', { _id: 'test', slug: 'test' });
        this.$route = { params: { slug: 'test' } };
        const result = await shipment_history.call(this);
        expect((await result.fetchAsync()).length).to.eq(H.AMOUNT_SHOWN);
        this.$data = { skip: 20 };
        const result2 = await shipment_history.call(this);
        expect((await result2.fetchAsync()).length)
          .to.eq(H.AMOUNT_SHOWN - this.$data.skip + 1);
        H.Session.set('lane', undefined);
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
    beforeEach(() => {
      shipmentsStub.insert({
        lane: 'test',
        active: true,
      });
    });

    afterEach(() => {
      H.Session.set('lane', undefined);
      H.Router = undefined;
    });

    it(
      'returns true if any shipments are active for a lane, otherwise false',
      async function () {
        this.$route = { params: { slug: 'test' } };
        H.Session.set('lane', { _id: 'test', slug: 'test' });
        expect(await any_active.call(this)).to.eq(true);
        shipmentsStub.clear();
        shipmentsStub.insert({
          lane: 'test',
          active: false,
        });
        expect(await any_active.call(this)).to.eq(false);
      });
    it(
      'uses H.Router.currentRoute when this.$route is not available',
      async function () {
        this.$route = undefined;
        H.Router = { currentRoute: { params: { slug: 'test' } } };
        H.Session.set('lane', { _id: 'test', slug: 'test' });
        expect(await any_active.call(this)).to.eq(true);
      },
    );
    it('returns false when route params are not available', async function () {
      this.$route = {};
      expect(await any_active.call(this)).to.eq(false);
    });
    it(
      'returns false when no active shipments and last_shipment inactive',
      async function () {
        shipmentsStub.clear();
        this.$route = { params: { slug: 'test' } };
        H.Session.set('lane', {
          _id: 'test',
          slug: 'test',
          last_shipment: { active: false },
        });
        expect(await any_active.call(this)).to.eq(false);
      },
    );
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
    it('logs the reset shipment response in the callback', () => {
      const originalLog = console.log;
      let logged = '';
      try {
        console.log = (...args) => { logged = args.join(' '); };
        const ctx = { $route: { params: { date: 'test', slug: 'test' } } };
        H.call = (method, slug, date, cb) => {
          expect(method).to.eq('Lanes#reset_shipment');
          cb(null, { ok: true });
        };
        reset_shipment.call(ctx);
        expect(logged).to.include('Reset shipment response:');
      }
      finally {
        console.log = originalLog;
        H.call = call_method;
      }
    });
    it('uses H.Router.currentRoute when this.$route is not available', () => {
      this.$route = undefined;
      H.Router = { currentRoute: { params: { date: 'test', slug: 'test' } } };
      H.call = (method, slug, date) => {
        expect(method).to.eq('Lanes#reset_shipment');
        expect(slug).to.eq('test');
        expect(date).to.eq('test');
      };
      reset_shipment();
      H.call = call_method;
      H.Router = undefined;
    });
    it('returns early when route params are not available', () => {
      this.$route = {};
      let callCount = 0;
      H.call = () => {
        callCount++;
      };
      reset_shipment();
      expect(callCount).to.eq(0);
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
    it('logs the reset all active response in the callback', () => {
      const originalLog = console.log;
      let logged = '';
      try {
        console.log = (...args) => { logged = args.join(' '); };
        const ctx = { $route: { params: { slug: 'test' } } };
        H.call = (method, slug, cb) => {
          expect(method).to.eq('Lanes#reset_all_active_shipments');
          cb(null, { ok: true });
        };
        reset_all_active.call(ctx);
        expect(logged).to.include('Reset all active shipments response:');
      }
      finally {
        console.log = originalLog;
        H.call = call_method;
      }
    });
    it('uses H.Router.currentRoute when this.$route is not available', () => {
      this.$route = undefined;
      H.Router = { currentRoute: { params: { slug: 'test' } } };
      H.call = (method, slug) => {
        expect(method).to.eq('Lanes#reset_all_active_shipments');
        expect(slug).to.eq('test');
      };
      reset_all_active();
      H.call = call_method;
      H.Router = undefined;
    });
    it('returns early when route params are not available', () => {
      this.$route = {};
      let callCount = 0;
      H.call = () => {
        callCount++;
      };
      reset_all_active();
      expect(callCount).to.eq(0);
      H.call = call_method;
    });
  });

  describe('#start_shipment', () => {
    beforeEach(function () {
      this.$router = [];
      this.$data = { rerenders: 0 };
      this.$route = { params: { slug: 'test' } };
      H.Session.set('lane', { _id: 'test', slug: 'test', type: 'test' });
      harborsStub.insert({
        _id: 'test',
        lanes: {
          test: { manifest: {} },
        },
      });
    });

    it('saves the working lane reference in the Session', async function () {
      expect(H.Session.get('working_lanes')).to.eq(undefined);
      await start_shipment.call(this);
      expect(H.Session.get('working_lanes').test).to.eq(true);
    });
    it('starts a shipment for the lane', async function () {
      H.call = (method, id, manifest, date_string) => {
        expect(method).to.eq('Lanes#start_shipment');
        expect(typeof id).to.eq('string');
        expect(typeof manifest).to.eq('object');
        expect(typeof date_string).to.eq('string');
      };
      await start_shipment.call(this);
      H.call = call_method;
    });
    it('throws if it receives an error', async function () {
      H.call = (method, id, manifest, date_string, callback) => {
        expect(() => callback(true)).to.throw();
      };
      await start_shipment.call(this);
      H.call = call_method;
    });
    it(
      'sets the working lane to false in the Session when complete',
      async function () {
        const test_id = 'test';
        H.Session.set('working_lanes', { test: true });
        H.call = (method, id, manifest, date_string, callback) => callback();
        await start_shipment.call(this);
        expect(H.Session.get('working_lanes')[test_id]).to.eq(false);
        H.call = call_method;
      });
    it('navigates to the active shipment', async function () {
      H.call = (method, id, manifest, date_string, callback) => callback();
      this.$router = [];
      await start_shipment.call(this);
      expect(this.$router.length).to.eq(1);
      H.call = call_method;
    });
    it('starts a shipment when no shipment exists', async function () {
      shipmentsStub.clear();
      H.call = (method, id, manifest, date_string, callback) => {
        expect(method).to.eq('Lanes#start_shipment');
        callback();
      };
      await start_shipment.call(this);
      H.call = call_method;
    });
    it(
      'starts a shipment when existing shipment is not active',
      async function () {
        const shipment_start_date = H.start_date();
        shipmentsStub.insert({
          lane: 'test',
          start: shipment_start_date,
          active: false,
        });
        H.call = (method, id, manifest, date_string, callback) => {
          expect(method).to.eq('Lanes#start_shipment');
          callback();
        };
        await start_shipment.call(this);
        H.call = call_method;
      },
    );
    it('invokes the Lanes#start_shipment callback path', async function () {
      // Ensure branch enters and callback executes (covers H.call line path).
      shipmentsStub.clear();
      this.$router = [];
      this.$data = { rerenders: 0 };
      H.call = (method, id, manifest, date_string, callback) => {
        expect(method).to.eq('Lanes#start_shipment');
        expect(typeof callback).to.eq('function');
        callback(null, { ok: true });
      };
      await start_shipment.call(this);
      expect(this.$router.length).to.eq(1);
      expect(this.$data.rerenders).to.eq(1);
      H.call = call_method;
    });
  });

});
