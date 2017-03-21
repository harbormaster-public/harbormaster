import { Lanes } from '../../api/lanes/lanes';

let get_hooks = Picker.filter(function (req) {
  return req.method = 'GET';
});

let post_hooks = Picker.filter(function (req) {
  return req.method == 'POST';
});

get_hooks.route('/lanes/:name/ship', function (params, req, res, next) {

  let lane_name = decodeURI(params.name);
  let token = req.headers.token;
  let user_id = req.headers.user_id;
  let lane = Lanes.findOne({ name: lane_name }) || false;

  if (
    lane.shipment_active &&
    token &&
    user_id &&
    lane.tokens &&
    lane.tokens[token] == user_id
  ) {
    res.statusCode = 303;
    return res.end(
      req.headers.host +
        '/lanes/' +
        encodeURI(lane_name) +
        '/ship/' +
        lane.latest_shipment
    );
  } else if (
    token &&
    user_id &&
    lane.tokens &&
    lane.tokens[token] == user_id &&
    ! lane.shipment_active
  ) {
    return res.ok();
    //TODO: Add response for error on last run
  }

  return next();
});

post_hooks.route('/lanes/:name/ship/:date/reset', function (params, req, res) {

  let lane_name = decodeURI(params.name);
  let token = req.headers.token;
  let user_id = req.headers.user_id;
  let lane = Lanes.findOne({ name: lane_name });

  if (
    lane.tokens &&
    lane.tokens[token] == user_id &&
    lane.shipment_active
  ) {

    let reset_shipment = Meteor.call('Lanes#reset_shipment', lane_name);

    res.statusCode = 200;
    return res.end(reset_shipment);

  }

  res.statusCode = 401;
  return res.end();
});

post_hooks.route('/lanes/:name/ship', function (params, req, res) {

  let lane_name = decodeURI(params.name);
  let token = req.headers.token;
  let user_id = req.headers.user_id;
  let lane = Lanes.findOne({ name: lane_name });
  let results;

  if (! lane.tokens || lane.tokens[token] != user_id) {
    res.statusCode = 401;
    return res.end();
  }

  if (lane.shipment_active) {
    res.statusCode = 303;

  } else {
    console.log('Shipping via RPC to lane:', lane_name, 'with user:', user_id);
    results = Meteor.call('Lanes#start_shipment', lane._id);
    res.statusCode = 200;
  }

  if (! lane.queue) {
    return res.end(results);
  }

  return res.end(
    req.headers.host +
      '/lanes/' +
      encodeURI(lane_name) +
      '/ship/' +
      results.latest_shipment
  );

});
