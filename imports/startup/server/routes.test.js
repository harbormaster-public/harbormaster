import { expect } from 'chai';
import {
  cors_middleware,
  route_lane_ship_rpc,
  set_cors_headers,
  ship_rpc_middleware,
} from './routes';
import { resetDatabase } from '../../test-helpers/reset-database';
import {
  setupInMemoryCollection,
} from '../../test-helpers/setup-collection-stubs';
import { Harbors } from '../../api/harbors';
import { Lanes } from '../../api/lanes';
import { Shipments } from '../../api/shipments';

const call = H.call;

describe('RPC routes', () => {
  let req;
  let res;
  let route_params;
  let lanesStub;
  let harborsStub;
  let shipmentsStub;

  beforeEach(async () => {
    await resetDatabase();
    lanesStub = setupInMemoryCollection(Lanes);
    harborsStub = setupInMemoryCollection(Harbors);
    shipmentsStub = setupInMemoryCollection(Shipments);

    harborsStub.insert({
      _id: 'test',
      lanes: {
        test: { manifest: { test: true } },
      },
    });
    lanesStub.insert({
      _id: 'test',
      type: 'test',
      slug: 'test',
      name: 'test',
      tokens: {
        test_token: 'test@harbormaster.io',
      },
    });

    req = {
      url: '/foo/bar/baz',
      headers: {},
    };
    res = {
      end () { return this.statusCode; },
      setHeader () { },
    };
    route_params = {};
    H.Session.set('lane', undefined);
  });

  afterEach(async () => {
    await resetDatabase();
    H.call = call;
    if (lanesStub) lanesStub.restore();
    if (harborsStub) harborsStub.restore();
    if (shipmentsStub) shipmentsStub.restore();
  });

  it('requires a query string in the url params', async () => {
    H.call = async () => { };
    const bogus_result = await route_lane_ship_rpc(route_params, req, res);
    expect(bogus_result).to.eq(401);
    route_params.slug = 'test';
    const bogus_result2 = await route_lane_ship_rpc(route_params, req, res);
    expect(bogus_result2).to.eq(401);
    req.url += '?user_id=test@harbormaster.io&token=test_token';
    const expected_result = await route_lane_ship_rpc(route_params, req, res);
    expect(expected_result).to.eq(200);
  });

  it('only works for existing lanes', async () => {
    H.call = () => { };
    route_params.slug = 'foo';
    req.url += '?user_id=test@harbormaster.io&token=test_token';
    const bogus_result = await route_lane_ship_rpc(route_params, req, res);
    expect(bogus_result).to.eq(401);
    route_params.slug = 'test';
    const expected_result = await route_lane_ship_rpc(route_params, req, res);
    expect(expected_result).to.eq(200);
  });
  it('sets the CORS headers on the response', () => {
    let count = 0;
    res.setHeader = () => count++;
    set_cors_headers(res);
    expect(count).to.eq(3);
  });

  it('cors_middleware sets CORS headers and calls next()', () => {
    let called = 0;
    res.setHeader = () => { called++; };
    let nextCalled = false;
    cors_middleware(req, res, () => { nextCalled = true; });
    expect(called).to.eq(3);
    expect(nextCalled).to.eq(true);
  });
  it('requires a lane to have a valid RPC token', async () => {
    H.call = () => { };
    req.url += '?user_id=invalid@harbormaster.io&token=test_token';
    route_params.slug = 'test';
    const bogus_result = await route_lane_ship_rpc(route_params, req, res);
    expect(bogus_result).to.eq(401);
  });
  it('assigns a prior manifest if provided', async () => {
    let expected;
    H.call = (method, lane_id, manifest) => expected = manifest.prior_manifest;
    route_params.slug = 'test';
    req.url += '?user_id=test@harbormaster.io&token=test_token';
    req.body = 'foo';
    await route_lane_ship_rpc(route_params, req, res);
    expect(expected).to.eq('foo');
  });

  it('logs the prior manifest details in non-test mode', async () => {
    const originalIsTest = H.isTest;
    const originalLog = console.log;
    let logged = '';
    try {
      H.isTest = false;
      console.log = (...args) => { logged += args.join(' '); };

      H.call = () => ({ ok: true });
      route_params.slug = 'test';
      req.url += '?user_id=test@harbormaster.io&token=test_token';
      req.body = 'foo';
      await route_lane_ship_rpc(route_params, req, res);
      expect(logged).to.include('Prior manifest detected');
    }
    finally {
      H.isTest = originalIsTest;
      console.log = originalLog;
    }
  });
  it('redirects for an already active shipment', async () => {
    H.call = () => { };
    shipmentsStub.insert({ lane: 'test', active: true });
    route_params.slug = 'test';
    req.url += '?user_id=test@harbormaster.io&token=test_token';
    req.body = 'foo';
    const results = await route_lane_ship_rpc(route_params, req, res);
    expect(results).to.eq(303);
  });
  it('returns JSON of the successful results as response', async () => {
    H.call = () => ({});
    res.end = (arg) => arg;
    route_params.slug = 'test';
    req.url += '?user_id=test@harbormaster.io&token=test_token';
    req.body = 'foo';
    const results = await route_lane_ship_rpc(route_params, req, res);
    expect(results).to.eq('{}');
  });

  it(
    'ship_rpc_middleware routes POST /lanes/:slug/ship to route_lane_ship_rpc',
    async () => {
      H.call = () => ({ ok: true });
      req.method = 'POST';
      req.url = '/lanes/test/ship?' +
          'user_id=test@harbormaster.io&token=test_token';
      const result = await ship_rpc_middleware(req, res, () => 418);
      expect(result).to.eq(200);
    },
  );
});
