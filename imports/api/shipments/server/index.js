import { Shipments } from '..';
import { Lanes } from '../../lanes';

Shipments.rawCollection().createIndex({ lane: 1 });
Shipments.rawCollection().createIndex({ lane: 1, active: 1 });
Shipments.rawCollection().createIndex({ active: 1 });
Shipments.rawCollection().createIndex({ active: 1, exit_code: 1 });
Shipments.rawCollection().createIndex({ actual: -1 });
Shipments.rawCollection().createIndex({ finished: -1 });
Shipments.rawCollection().createIndex({ start: -1 });
Shipments.rawCollection().createIndex({ start: -1, lane: 1 });

Meteor.publish('Shipments', function (lane, options) {
  options = options || {};
  let query = {};

  if (lane) query.lane = lane._id;

  let shipments = Shipments.find(query, options);

  return shipments;
});

Meteor.methods({
  'Shipments#check_state': function (lane) {
    let active_shipments = Shipments.find({
      _id: { $in: lane.shipments || [] },
      active: true
    }).fetch();

    let latest_shipment = lane.shipments && lane.shipments.length ?
      lane.shipments[lane.shipments.length - 1] :
      false
    ;

    let latest_exit_code;
    latest_shipment = Shipments.findOne(latest_shipment) || false;

    if (
      latest_shipment &&
      typeof latest_shipment.exit_code == 'string' ||
      typeof latest_shipment.exit_code == 'number'
    ) {
      latest_exit_code = latest_shipment.exit_code;
    }

    if (active_shipments.length) return active_shipments.length + ' active';
    if (latest_exit_code == 0) return 'ready';
    if (latest_exit_code) return 'error';
    return 'new';
  },
  'Shipments#get_total': function () {
    let now = Date.now();
    let interval = 86400000; // 24 hours
    var yesterday = new Date(now - interval);
    var shipments = Shipments.find({
      actual: {
        $gte: yesterday
      }
    }).fetch();

    return shipments.length;
  },

  'Shipments#get_latest_date': function (shipment) {
    if (Shipments.findOne(shipment)) return Shipments.findOne(shipment);

    let latest_shipment = Shipments.find(
      {}, { sort: { finished: -1 }, limit: 1 }
    ) .fetch()[0];
    let latest_lane = latest_shipment ?
      Lanes.findOne(latest_shipment.lane) :
      false
    ;
    if (latest_shipment && latest_lane) {
      return {
        name: latest_lane.name,
        date: latest_shipment.start,
        locale: latest_shipment.finished.toLocaleString()
      };
    }

    return {
      name: latest_lane ? latest_lane.name : '',
      date: '',
      locale: 'never'
    };

  }
});
