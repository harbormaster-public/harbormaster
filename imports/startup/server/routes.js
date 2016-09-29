import { Lanes } from '../../api/lanes/lanes';
import { Users } from '../../api/users/users';

let post_hooks = Picker.filter(function (req, res) {
  return req.method == 'POST';
});

// Can be triggered via RPC, e.g.:
// curl \
//  -f \
//  -H "token: [the token for this user]" \
//  -H "user_id: [the user id]" \
//  -X POST [url]/lanes/[lane name]/ship
post_hooks.route('/lanes/:name/ship', function (params, req, res) {

  let lane_name = decodeURI(params.name);
  let token = req.headers.token;
  let user_id = req.headers.user_id;
  let lane = Lanes.findOne({ name: lane_name });

  if (lane.tokens[token] == user_id && ! lane.shipment_active) {
    let date = new Date();
    let shipment_start_date = date.getFullYear() + '-' +
      date.getMonth() + '-' +
      date.getDate() + '-' +
      date.getHours() + '-' +
      date.getMinutes() + '-' +
      date.getSeconds()
    ;

    lane.shipment_active = true;
    lane.latest_shipment = shipment_start_date;
    Lanes.update(lane._id, lane);

    Meteor.call('Lanes#start_shipment', lane._id, shipment_start_date);

    res.statusCode = 200;
    res.end(
      req.headers.host +
        '/lanes/' +
        encodeURI(lane_name) +
        '/ship/' +
        shipment_start_date
    );
  } else if (lane.shipment_active) {
    res.statusCode = 303;
    res.end(
      req.headers.host +
        '/lanes/' +
        encodeURI(lane_name) +
        '/ship/' +
        lane.latest_shipment
    );
  } else {
    res.statusCode = 401;
    res.end();
  }

});
