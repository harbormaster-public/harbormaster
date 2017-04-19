import { Lanes } from '../../api/lanes';
import { Harbors } from '../../api/harbors';
import { Shipments } from '../../api/shipments';

let post_hooks = Picker.filter(function (req) {
  return req.method == 'POST';
});

post_hooks.route('/lanes/:name/ship', function (params, req, res) {

  let lane_name = decodeURI(params.name);
  let token = req.headers.token;
  let user_id = req.headers.user_id;
  let lane = Lanes.findOne({ name: lane_name });
  let results;
  let harbor = Harbors.findOne(lane.type);
  let manifest = harbor.lanes[lane._id].manifest;
  let prior_manifest = require('url').parse(req.url, true).query;
  let date = new Date();
  //TODO: share w/ other code
  let shipment_start_date = date.getFullYear() + '-' +
    date.getMonth() + '-' +
    date.getDate() + '-' +
    date.getHours() + '-' +
    date.getMinutes() + '-' +
    date.getSeconds()
  ;
  let shipment = Shipments.findOne({
    start: shipment_start_date,
    lane: lane._id
  });

  if (prior_manifest) {
    console.log(
      'Prior manifest detected:\n',
      prior_manifest,
      '\n adding to recorded manifest.'
    );
    manifest.prior_manifest = prior_manifest;
  }

  if (! lane.tokens || lane.tokens[token] != user_id) {
    res.statusCode = 401;
    return res.end();
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

  console.log('Shipping via RPC to lane:', lane.name, 'with user:', user_id);
  results = Meteor.call(
    'Lanes#start_shipment',
    lane._id,
    manifest,
    shipment_start_date
  );

  res.statusCode = 200;
  return res.end(JSON.stringify(results));

});
