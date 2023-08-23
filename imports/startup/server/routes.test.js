import { expect } from 'chai';
import {
  route_lane_ship_rpc,
  set_cors_headers,
} from './routes';
import { resetDatabase } from 'cleaner';

const call = H.call;

describe('RPC routes', () => {
  let req;
  let res;
  let route_params;
  beforeEach(() => {
    resetDatabase(null);
    Factory.create('harbor', {
      _id: 'test',
      lanes: {
        test: { manifest: { test: true } },
      },
    });
    Factory.create('lane', {
      _id: 'test',
      type: 'test',
      slug: 'test',
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
  });

  it('requires a query string in the url params', async () => {
    H.call = () => { };
    const bogus_result = await route_lane_ship_rpc(route_params, req, res);
    expect(bogus_result).to.eq(401);
    route_params.slug = 'test';
    const bogus_result2 = await route_lane_ship_rpc(route_params, req, res);
    expect(bogus_result2).to.eq(401);
    req.url += '?user_id=test@harbormaster.io&token=test_token';
    const expected_result = await route_lane_ship_rpc(route_params, req, res);
    expect(expected_result).to.eq(200);
    H.call = call;
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
    H.call = call;
  });
  it('sets the CORS headers on the response', () => {
    let count = 0;
    res.setHeader = () => count++;
    set_cors_headers(res);
    expect(count).to.eq(3);
  });
  it('requires a lane to have a valid RPC token', async () => {
    H.call = () => { };
    req.url += '?user_id=invalid@harbormaster.io&token=test_token';
    route_params.slug = 'test';
    const bogus_result = await route_lane_ship_rpc(route_params, req, res);
    expect(bogus_result).to.eq(401);
    H.call = call;
  });
  it('assigns a prior manifest if provided', async () => {
    let expected;
    H.call = (method, lane_id, manifest) => expected = manifest.prior_manifest;
    route_params.slug = 'test';
    req.url += '?user_id=test@harbormaster.io&token=test_token';
    req.body = 'foo';
    await route_lane_ship_rpc(route_params, req, res);
    expect(expected).to.eq('foo');
    H.call = call;
  });
  it('redirects for an already active shipment', async () => {
    H.call = () => { };
    Factory.create('shipment', { lane: 'test', active: true });
    route_params.slug = 'test';
    req.url += '?user_id=test@harbormaster.io&token=test_token';
    req.body = 'foo';
    const results = await route_lane_ship_rpc(route_params, req, res);
    expect(results).to.eq(303);
    H.call = call;
  });
  it('returns JSON of the successful results as response', async () => {
    H.call = () => ({});
    res.end = (arg) => arg;
    route_params.slug = 'test';
    req.url += '?user_id=test@harbormaster.io&token=test_token';
    req.body = 'foo';
    const results = await route_lane_ship_rpc(route_params, req, res);
    expect(results).to.eq('{}');
    H.call = call;
  });
});
