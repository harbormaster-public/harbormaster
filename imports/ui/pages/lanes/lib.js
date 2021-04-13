import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';
import { Shipments } from '../../../api/shipments';
import { ShipmentCount } from '../../../api/shipments';
import { SalvageCount } from '../../../api/shipments';
import { LatestShipment } from '../../../api/shipments';

let lane_ids = new ReactiveVar([]);

const empty = function () {
  return (
    Session.get('total_lanes') === 0 && ! Lanes.find().count()
  );
};

const sort_by_shipped_date = function (lane1, lane2) {
  let lane1_shipments = Shipments.find({ lane: lane1._id }).fetch();
  let lane2_shipments = Shipments.find({ lane: lane2._id }).fetch();

  let lane1_date = lane1_shipments.length ?
    lane1_shipments[lane1_shipments.length - 1].actual :
    0
  ;
  let lane2_date = lane2_shipments.length ?
    lane2_shipments[lane2_shipments.length - 1].actual :
    0
  ;
  let sort_order = 0;

  if (lane1_date > lane2_date) { sort_order = -1; }
  else if (lane1_date < lane2_date) { sort_order = 1; }

  if (reverse == -1) { sort_order = -sort_order; }
  return sort_order;
};

const sort_by_total_shipments = function (lane1, lane2) {
  let lane1_shipments = Shipments.find({ lane: lane1._id }).fetch();
  let lane2_shipments = Shipments.find({ lane: lane2._id }).fetch();
  let sort_order = 0;

  if (lane1_shipments.length > lane2_shipments.length) {
    sort_order = -1;
  }
  else if (lane1_shipments.length < lane2_shipments.length) {
  sort_order = 1;
  }

  if (reverse == -1) { sort_order = -sort_order; }
  return sort_order;
};

const sort_by_total_salvage_runs = function (lane1, lane2) {
  let lane1_shipments = Shipments.find({
    lane: lane1._id,
    exit_code: { $ne: 0 },
  }).fetch();
  let lane2_shipments = Shipments.find({
    lane: lane2._id,
    exit_code: { $ne: 0 },
  }).fetch();
  let sort_order = 0;

  if (lane1_shipments.length > lane2_shipments.length) {
    sort_order = -1;
  }
  else if (lane1_shipments.length < lane2_shipments.length) {
  sort_order = 1;
  }

  if (reverse == -1) { sort_order = -sort_order; }
  return sort_order;
};

const lanes = function () {
  let lane_list;
  let sort_by = Session.get('lanes_table_sort_by');
  let reverse = Session.get('lanes_table_sort_reverse') ? -1 : 1;

  switch (sort_by) {
    case 'name':
      lane_list = Lanes.find({}, { sort: { name: reverse } });
      break;
    case 'captains':
      lane_list = Lanes.find({}, { sort: { captains: -reverse } });
      break;
    case 'type':
      lane_list = Lanes.find({}, { sort: { type: reverse } });
      break;
    case 'shipped':
      lane_list = Lanes.find({}, { sort: sort_by_shipped_date });
      break;
    case 'shipments':
      lane_list = Lanes.find({}, { sort: sort_by_total_shipments });
      break;
    case 'salvage-runs':
      lane_list = Lanes.find({}, { sort: sort_by_total_salvage_runs });
      break;
    default:
      lane_list = Lanes.find();
      break;
  }
  
  return lane_list;
};

const loading_lanes = function () {
  let total = Session.get('total_lanes');
  let current = Lanes.find().count();

  if (total !== 0 && ! total || current < total) return true;

  return false;
};

const sort_lane_table_reverse = function (sort) {
  return (
    sort_value == Session.get('lanes_table_sort_by') &&
    !Session.get('lanes_table_sort_reverse')
  );
};

const reverse_sort = function (event) {
  Session.set('lanes_table_sort_reverse', true);
  $(event.target).addClass('reverse');

  return event;
};

const default_sort = function (event) {
  Session.set('lanes_table_sort_reverse', false);
  $(event.target).removeClass('reverse');

  return event;
};

const sort_by_header = function (event) {
  let sort_value = $(event.target).attr('data-value');

  $(event.target).siblings('.active')
    .removeClass('active')
    .removeClass('reverse')
  ;
  $(event.target).addClass('active');

  if (sort_lane_table_reverse(sort_value)) { reverse_sort(event) }
  else if (Session.get('lanes_table_sort_reverse')) { default_sort(event) }

  Session.set('lanes_table_sort_by', sort_value);
};

const delete_lane = function (event, lane) {
  let confirm_message = `Delete lane?\n${lane.name}`;
  let $row = $(event.target).parents('tr');

  if (window.confirm(confirm_message)) {
    $row.addClass('deleting');
    H.call('Lanes#delete', lane, (err, res) => {
      if (err) throw err;
      Session.set('total_lanes', res);
    });
  }
};

const ready = function () {
  if (
    this.$subReady.ShipmentCount && 
    this.$subReady.LatestShipment &&
    this.$subReady.SalvageCount &&
    this.$subReady.Shipments
  ) return true;
  return false;
};

const active = function (header) {
  let active_string = '';

  if (header == Session.get('lanes_table_sort_by')) {
    active_string += 'active';
  }

  if (Session.get('lanes_table_sort_reverse')) {
    active_string += ' reverse';
  }

  return active_string;
};

const can_ply = function (lane) {
  var user = Users.findOne(Meteor.user().emails[0].address);
  if (user && user.harbormaster) {
    return true;
  }

  if (lane?.captains && lane?.captains.length) {
    let captain = _.find(lane.captains, function (email) {
      return email == Meteor.user().emails[0].address;
    });

    return captain ? true : false;
  }

  return false;
};

const current_state = function (lane) {
  const text_na = 'N/A';
  const text_error = 'error';
  const text_ready = 'ready';
  let latest = LatestShipment.findOne(lane?._id);
  let active_shipments = Shipments.find({
    lane: lane?._id,
    active: true,
  }).count();

  if (active_shipments) return 'active';

  if (latest && latest.shipment.exit_code) return text_error;
  if (latest && latest.shipment.exit_code == 0) return text_ready;

  return text_na;
};

const followup_name = function (lane) {
  let followup = Lanes.findOne(lane?.followup);

  return followup ? followup.name : '';
};

const last_shipped = function (lane) {
  const latest = LatestShipment.findOne(lane._id);
  const actual = latest ? latest.shipment.actual : 'Loading...';

  return actual.toLocaleString();
};

const latest_shipment = function (lane) {
  const latest = LatestShipment.findOne(lane._id);
  const start = latest ? latest.shipment.start : '';
  
  return start;
};

const salvage_plan_name = function (lane) {
  let salvage_plan = Lanes.findOne(lane.salvage_plan);

  return salvage_plan ? salvage_plan.name : '';
};

const total_captains = function (lane) {
  if (! lane.captains) {
    return 0;
  }

  return lane.captains.length;
};

const total_shipments = function (lane) {
  const count = ShipmentCount.findOne(lane._id);
  const total = count ? count.count : 'Loading...';
  return total.toLocaleString();
};

const total_salvage_runs = function (lane) {
  const count = SalvageCount.findOne(lane._id);
  const total = count ? count.count : 'Loading...';

  return total.toLocaleString();
};

const total_stops = function (lane) {
  var stops = 0;

  _.each(lane.destinations, function (destination) {
    stops += destination.stops.length;
  });

  return stops;
};

export {
  loading_lanes,
  sort_by_header,
  delete_lane,
  ready,
  active,
  can_ply,
  current_state,
  followup_name,
  last_shipped,
  latest_shipment,
  salvage_plan_name,
  total_captains,
  total_shipments,
  total_salvage_runs,
  total_stops,
  lane_ids,
  empty,
  lanes,
}