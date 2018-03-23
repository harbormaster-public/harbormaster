import { Shipments } from '..';
import { Lanes } from '../../lanes';

Shipments.rawCollection().createIndex(
  { _id: 1, active: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { lane: 1, active: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { active: 1, exit_code: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { actual: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { finished: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { start: 1, lane: 1 }, { background: true }
);

Meteor.publish('Shipments', function (lane, options) {
  options = options || {};
  let query = {};

  if (lane) query.lane = lane._id;

  let shipments = Shipments.find(query, options);

  return shipments;
});

Meteor.publish('Shipments#check_state', (lane, options) => {
  options = options || {};
  let query = { active: true };

  if (lane) query.lane = lane._id;

  let active_shipments = Shipments.find(query, options);

  return active_shipments;
});

Meteor.methods({
  'Shipments#get_total': function () {
    let now = Date.now();
    let interval = 86400000; // 24 hours
    var yesterday = new Date(now - interval);
    var total_shipments = Shipments.find({
      actual: {
        $gte: yesterday
      }
    }).count();

    return total_shipments;
  },

  'Shipments#get_latest_date': function (shipment) {
    if (Shipments.findOne(shipment)) return Shipments.findOne(shipment);

    let latest_shipment = Shipments.findOne({}, { sort: { finished: -1 } });
    if (latest_shipment) {
      return {
        lane: latest_shipment.lane,
        date: latest_shipment.start,
        locale: latest_shipment.finished.toLocaleString()
      };
    }

    return {
      lane: '',
      date: '',
      locale: 'never'
    };

  }
});
