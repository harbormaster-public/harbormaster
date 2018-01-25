import { Lanes } from '../../api/lanes';
import { Harbors } from '../../api/harbors';
import { Shipments } from '../../api/shipments';

import bodyParser from 'body-parser';
import url from 'url';

Picker.middleware(bodyParser.json());
Picker.middleware(bodyParser.urlencoded({ extended: false }));

let post_hooks = Picker.filter(function (req) {
  return req.method == 'POST';
});

function respondNotAllowed (res) {
  console.log('Request not allowed.  Responding with 401.');
  res.statusCode = 401;
  return res.end();
}

function setCorsHeaders (res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  return res;
}

WebApp.rawConnectHandlers.use(function(req, res, next) {
  setCorsHeaders(res);

  return next();
});

post_hooks.route('/lanes/:name/ship', function (params, req, res) {

  let results;
  let query = require('url').parse(req.url, true).query;
  let lane_name = decodeURI(params.name);
  let auth = url.parse(req.url).auth;
  let user_id = query ? query.user_id : false;
  let token = query ? query.token : false;

  let lane = Lanes.findOne({ name: lane_name });
  if (! lane) return respondNotAllowed(res);

  let harbor = Harbors.findOne(lane.type);
  let manifest = harbor.lanes[lane._id].manifest;
  let shipment_start_date = $H.start_date();
  let shipment = Shipments.findOne({
    start: shipment_start_date,
    lane: lane._id
  });
  let prior_manifest = req.body;

  setCorsHeaders(res);

  if (
    ! user_id ||
    ! token ||
    ! lane.tokens ||
    lane.tokens[token] != user_id
  ) {
    return respondNotAllowed(res);
  }

  console.log('Shipping via RPC to lane:', lane.name, 'with user:', user_id);

  if (prior_manifest) {
    console.log(
      'Prior manifest detected:\n',
      prior_manifest,
      '\n adding to recorded manifest.'
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
        shipment.start
    );

  }

  results = Meteor.call(
    'Lanes#start_shipment',
    lane._id,
    manifest,
    shipment_start_date
  );

  res.statusCode = 200;
  return res.end(JSON.stringify(results));

});
