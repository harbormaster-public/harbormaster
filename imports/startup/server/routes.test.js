// import {
//   route_lane_ship_rpc,
//   set_cors_headers,
//   respond_not_allowed,
// } from './routes';

describe('RPC routes', () => {
  it('requires a query string in the url params');
  it('only works for existing lanes');
  it('sets the CORS headers on the response');
  it('requires a lane to have a valid RPC token');
  it('assigns a prior manifest if provided');
  it('redirects for an already active shipment');
  it('returns JSON of the successful results as response');
});
