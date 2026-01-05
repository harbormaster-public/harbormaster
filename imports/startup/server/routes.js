import { Harbors } from '../../api/harbors';
import { Shipments } from '../../api/shipments';
import { get_lane } from '../../ui/pages/lanes/lib/util';

import bodyParser from 'body-parser';

// Parse JSON and urlencoded bodies for incoming requests
WebApp.connectHandlers.use(bodyParser.json());
WebApp.connectHandlers.use(bodyParser.urlencoded({ extended: false }));

export const respond_not_allowed = (res) => {
  /* istanbul ignore next */
  if (!H.isTest) console.log('Request not allowed.  Responding with 401.');
  res.statusCode = 401;
  return res.end();
};

export const set_cors_headers = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization',
  );

  return res;
};

export const cors_middleware = function (req, res, next) {
  set_cors_headers(res);

  return next();
};

/* istanbul ignore next */
WebApp.rawConnectHandlers.use(cors_middleware);

// Handle POST /lanes/:slug/ship using Connect handlers instead of Picker
export const ship_rpc_middleware = (req, res, next) => {
  if (req.method !== 'POST') return next();

  const match = req.url.match(/^\/lanes\/([^\/]+)\/ship(?:\/?|\?.*)$/);
  if (!match) return next();

  const slug = match[1];
  return route_lane_ship_rpc({ slug }, req, res);
};

/* istanbul ignore next */
WebApp.connectHandlers.use(ship_rpc_middleware);

export const route_lane_ship_rpc = async function (route_params, req, res) {

  let results;
  let query = require('url').parse(req.url, true).query;
  const raw_slug = route_params?.slug || '';
  let lane_name = decodeURI(String(raw_slug));
  let user_id = query?.user_id ? query.user_id : false;
  let token = query?.token ? query.token : false;

  let lane = await get_lane(lane_name);
  if (!lane._id) return respond_not_allowed(res);

  let harbor = await Harbors.findOneAsync(lane.type);
  let manifest = harbor.lanes[lane._id].manifest;
  let shipment_start_date = H.start_date();
  let shipment = await Shipments.findOneAsync({
    $or: [
      { lane: lane._id, start: shipment_start_date },
      { lane: lane._id, active: true },
    ],
  });
  let prior_manifest = req.body;

  set_cors_headers(res);

  if (
    !user_id ||
    !token ||
    !lane.tokens ||
    lane.tokens[token] != user_id
  ) {
    return respond_not_allowed(res);
  }

  /* istanbul ignore next */
  if (!H.isTest) console.log(
    'Shipping via RPC to lane:', lane.name, 'with user:', user_id,
  );

  if (prior_manifest) {
    /* istanbul ignore next */
    if (!H.isTest) console.log(
      'Prior manifest detected:\n',
      prior_manifest,
      '\n adding to recorded manifest.',
    );
    manifest.prior_manifest = prior_manifest;
  }

  if (shipment && shipment.active) {
    res.statusCode = 303;
    return res.end(
      req.headers.host +
      '/lanes/' +
      encodeURI(lane_name) +
      '/ship/' +
      shipment.start,
    );

  }

  results = await H.call(
    'Lanes#start_shipment',
    lane._id,
    manifest,
    shipment_start_date,
  );

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify(results));

};
