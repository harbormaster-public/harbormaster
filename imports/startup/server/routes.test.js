import { expect } from 'chai';
import {
  api_middleware,
  cors_middleware,
  get_lanes_with_webhooks,
  route_api_lanes_json,
  route_api_openapi_json,
  route_lane_ship_rpc,
  set_cors_headers,
  ship_rpc_get_middleware,
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

  it(
    'ship_rpc_get_middleware routes GET /lanes/:slug/ship with token to RPC',
    async () => {
      H.call = () => ({ ok: true });
      req.method = 'GET';
      req.url = '/lanes/test/ship?' +
          'user_id=test@harbormaster.io&token=test_token';
      req.headers.accept = 'application/json';
      const result = await ship_rpc_get_middleware(req, res, () => 418);
      expect(result).to.eq(200);
    },
  );

  it('ship_rpc_get_middleware ignores browser HTML navigations', async () => {
    H.call = () => ({ ok: true });
    req.method = 'GET';
    req.headers.accept = 'text/html';
    req.url = '/lanes/test/ship?' +
        'user_id=test@harbormaster.io&token=test_token';
    const result = await ship_rpc_get_middleware(req, res, () => 418);
    expect(result).to.eq(418);
  });

  it('ship_rpc_get_middleware works without an Accept header', async () => {
    H.call = () => ({ ok: true });
    req.method = 'GET';
    req.headers = {};
    req.url = '/lanes/test/ship?' +
        'user_id=test@harbormaster.io&token=test_token';
    const result = await ship_rpc_get_middleware(req, res, () => 418);
    expect(result).to.eq(200);
  });
});

describe('API routes', () => {
  let req;
  let res;
  let lanesStub;

  beforeEach(async () => {
    await resetDatabase();
    lanesStub = setupInMemoryCollection(Lanes);

    req = { url: '/api/openapi.json', headers: {} };
    res = {
      end (arg) { return arg; },
      setHeader () { },
    };
  });

  afterEach(async () => {
    await resetDatabase();
    if (lanesStub) lanesStub.restore();
  });

  it('reports no exposed endpoints when no lanes have tokens', async () => {
    const spec = JSON.parse(await route_api_openapi_json(req, res));
    expect(spec.paths).to.deep.eq({});
    expect(spec.info.description).to.include(
      'No API endpoints have been exposed',
    );
  });

  it('lists lanes with webhook tokens (without token values)', async () => {
    lanesStub.insert({ _id: 'a', name: 'A', slug: 'a', tokens: { t1: 'u1' } });
    lanesStub.insert({ _id: 'b', name: 'B', slug: 'b' });
    lanesStub.insert({ _id: 'c', name: 'C', slug: 'c', tokens: {} });

    const lanes = JSON.parse(await route_api_lanes_json(req, res));
    expect(lanes).to.have.length(1);
    expect(lanes[0]).to.deep.eq({ name: 'A', slug: 'a', token_count: 1 });

    const with_webhooks = await get_lanes_with_webhooks();
    expect(with_webhooks.map((l) => l.slug)).to.deep.eq(['a']);

    const spec = JSON.parse(await route_api_openapi_json(req, res));
    expect(Object.keys(spec.paths)).to.deep.eq(['/lanes/a/ship']);
  });

  it('api_middleware serves HTML for /api in browsers', async () => {
    req.method = 'GET';
    req.url = '/api';
    req.headers.accept = 'text/html';
    const html = await api_middleware(req, res, () => 418);
    expect(String(html)).to.include('SwaggerUIBundle');
  });

  it('api_middleware serves OpenAPI JSON for /api', async () => {
    req.method = 'GET';
    req.url = '/api';
    req.headers.accept = 'application/json';
    const json = await api_middleware(req, res, () => 418);
    const spec = JSON.parse(json);
    expect(spec.openapi).to.eq('3.0.3');
  });

  it('api_middleware routes /api/openapi.json', async () => {
    req.method = 'GET';
    req.url = '/api/openapi.json';
    req.headers.accept = 'application/json';
    const json = await api_middleware(req, res, () => 418);
    const spec = JSON.parse(json);
    expect(spec.openapi).to.eq('3.0.3');
  });

  it('api_middleware routes /api/lanes.json', async () => {
    lanesStub.insert({ _id: 'a', name: 'A', slug: 'a', tokens: { t: 'u' } });
    req.method = 'GET';
    req.url = '/api/lanes.json';
    req.headers.accept = 'application/json';
    const json = await api_middleware(req, res, () => 418);
    const lanes = JSON.parse(json);
    expect(lanes).to.have.length(1);
    expect(lanes[0].slug).to.eq('a');
  });

  it('api_middleware ignores non-GET/HEAD requests', async () => {
    req.method = 'POST';
    req.url = '/api';
    req.headers.accept = 'application/json';
    const result = await api_middleware(req, res, () => 418);
    expect(result).to.eq(418);
  });

  it('api_middleware accepts HEAD requests', async () => {
    req.method = 'HEAD';
    req.url = '/api';
    req.headers.accept = 'application/json';
    const json = await api_middleware(req, res, () => 418);
    const spec = JSON.parse(json);
    expect(spec.openapi).to.eq('3.0.3');
  });

  it('api_middleware ignores non-/api paths', async () => {
    req.method = 'GET';
    req.url = '/not-api';
    req.headers.accept = 'application/json';
    const result = await api_middleware(req, res, () => 418);
    expect(result).to.eq(418);
  });

  it('api_middleware handles a URL without a pathname', async () => {
    req.method = 'GET';
    req.url = '?format=json';
    req.headers.accept = 'application/json';
    const result = await api_middleware(req, res, () => 418);
    expect(result).to.eq(418);
  });
});
