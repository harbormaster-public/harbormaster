import { Harbors } from '../../api/harbors';
import { Lanes } from '../../api/lanes';
import { Shipments } from '../../api/shipments';

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

export const get_lane_async = async (string) => {
  const found = await Lanes.findOneAsync({
    $or: [
      { name: string },
      { slug: string },
      { _id: string },
    ],
  });
  return found || {};
};

// Handle GET /api (OpenAPI + minimal UI)
export const api_middleware = (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const parsed = require('url').parse(req.url, true);
  const pathname = parsed?.pathname || '';

  switch (pathname) {
    case '/api/openapi.json':
      return route_api_openapi_json(req, res);
    case '/api/lanes.json':
      return route_api_lanes_json(req, res);
    case '/api':
      break;
    default:
      return next();
  }

  const accept = String(req?.headers?.accept || '');
  const format = String(parsed?.query?.format || '');
  const wants_html = format === 'html' || (
    format !== 'json' && accept.includes('text/html')
  );

  if (wants_html) return route_api_index_html(req, res);
  return route_api_openapi_json(req, res);
};

/* istanbul ignore next */
WebApp.connectHandlers.use(api_middleware);

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

// Some clients (e.g. email link handlers) can only do GET.
// Re-enable GET /lanes/:slug/ship?user_id=...&token=... to start shipping.
export const ship_rpc_get_middleware = (req, res, next) => {
  if (req.method !== 'GET') return next();

  const match = req.url.match(/^\/lanes\/([^\/]+)\/ship(?:\/?|\?.*)$/);
  if (!match) return next();

  // Browsers should load the ship-lane page (HTML), not receive JSON.
  const accept = String(req?.headers?.accept || '');
  if (accept.includes('text/html')) return next();

  const query = require('url').parse(req.url, true).query;
  if (!query?.user_id || !query?.token) return next();

  const slug = match[1];
  return route_lane_ship_rpc({ slug }, req, res);
};

/* istanbul ignore next */
WebApp.connectHandlers.use(ship_rpc_get_middleware);

export const get_lanes_with_webhooks = async () => {
  const fields = { name: 1, slug: 1, tokens: 1 };
  const lanes = await Lanes.find({}, { fields }).fetchAsync();
  return (lanes || []).filter((lane) => {
    if (!lane.tokens) return false;
    return Object.keys(lane.tokens).length > 0;
  });
};

export const route_api_lanes_json = async function (req, res) {
  set_cors_headers(res);
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  const lanes = await get_lanes_with_webhooks();
  const results = lanes.map((lane) => ({
    name: lane.name,
    slug: lane.slug,
    token_count: Object.keys(lane.tokens).length,
  }));

  return res.end(JSON.stringify(results));
};

export const route_api_openapi_json = async function (req, res) {
  set_cors_headers(res);
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  const lanes = await get_lanes_with_webhooks();
  const has_webhooks = lanes.length > 0;
  const description = has_webhooks
    ? 'Webhook/RPC endpoints exposed by Harbormaster.'
    : 'No API endpoints have been exposed (no webhook tokens configured).';

  const responses = {
    200: {
      description: 'Shipment started successfully.',
      content: {
        'application/json': {
          schema: {},
        },
      },
    },
    303: { description: 'Shipment already active (redirect).' },
    401: { description: 'Request not allowed.' },
  };

  const requestBody = {
    required: false,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          additionalProperties: true,
        },
        example: {},
      },
    },
  };

  const paths = {};
  if (has_webhooks) {
    for (const lane of lanes) {
      const slug = lane.slug;
      const operationId = `ship_lane_${lane.slug}`;
      paths[`/lanes/${slug}/ship`] = {
        post: {
          operationId,
          summary: `Ship lane: ${lane.name}`,
          tags: ['Lanes'],
          parameters: [
            {
              name: 'user_id',
              in: 'query',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'token',
              in: 'query',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody,
          responses,
        },
      };
    }
  }

  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'Harbormaster API',
      version: H.VERSION,
      description,
    },
    tags: [
      { name: 'Lanes', description: 'Webhook/RPC lane endpoints.' },
    ],
    paths,
  };

  return res.end(JSON.stringify(spec));
};

export const route_api_index_html = async function (req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  // Served from /private/api/index.html
  const html = await Assets.getTextAsync('api/index.html');
  return res.end(html);
};

export const route_lane_ship_rpc = async function (route_params, req, res) {

  let results;
  let query = require('url').parse(req.url, true).query;
  const raw_slug = route_params?.slug || '';
  let lane_name = decodeURI(String(raw_slug));
  let user_id = query?.user_id ? query.user_id : false;
  let token = query?.token ? query.token : false;

  let lane = await get_lane_async(lane_name);
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
