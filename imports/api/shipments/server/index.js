import { Shipments } from '..';
import { LatestShipment } from '..';
import { ShipmentCount } from '..';
import { SalvageCount } from '..';
import { Lanes } from '../../lanes';

Shipments.rawCollection().createIndex(
  { _id: 1, active: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { lane: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { lane: 1, active: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { lane: 1, exit_code: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { exit_code: 1 }, { background: true }
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

Meteor.setTimeout(function () {
  Meteor.publish('ShipmentCount', function () {
    Lanes.find().forEach((lane) => {
      const shipments = Shipments.find({ lane: lane._id });
      let count = shipments.count() || 0;
      shipments.observe({
        added: () => {
          count += 1;
          ShipmentCount.upsert(lane._id, { count });
        },
      });

      ShipmentCount.upsert(lane._id, { count });
    });
    return ShipmentCount.find({});
  });

  Meteor.publish('SalvageCount', function () {
    Lanes.find().forEach((lane) => {
      const shipments = Shipments.find({
        lane: lane._id,
        exit_code: { $exists: true, $nin: [0, null] },
      });
      let count = shipments.count() || 0;
      shipments.observe({
        added: () => {
          count += 1;
          SalvageCount.upsert(lane._id, { count });
        },
      });

      SalvageCount.upsert(lane._id, { count });
    });
    return SalvageCount.find();
  });
});

Meteor.methods({
  'Shipments#get_total': function () {
    this.unblock();
    let now = Date.now();
    let interval = 86400000; // 24 hours
    let yesterday = new Date(now - interval);
    let total_shipments = Shipments.find({
      actual: {
        $gte: yesterday,
      },
    }).count();

    return total_shipments;
  },

  'Shipments#total_shipments': function (lane = { _id: null }) {
    this.unblock();
    return Shipments.find({ lane: lane._id }).count();
  },

  'Shipments#last_shipped': function (lane = { _id: null }) {
    this.unblock();
    const latest = LatestShipment.findOne(lane._id);
    return latest ? latest.shipment : Shipments.findOne({ lane: lane._id }, {
      sort: { actual: -1 },
      limit: 1,
    });
  },

  'Shipments#total_completed_shipments': function (lane = { _id: null }) {
    this.unblock();
    return Shipments.find({
      lane: lane._id,
      exit_code: 0,
    }).count();
  },

  'Shipments#total_salvage_runs': function (lane = { _id: null }) {
    this.unblock();
    return Shipments.find({
      lane: lane._id,
      exit_code: { $ne: 0 },
    }).count();
  },

  'Shipments#get_latest_date': function () {
    this.unblock();

    let latest_shipment = Shipments.findOne({}, { sort: { finished: -1 } });
    if (latest_shipment) {
      let lane = Lanes.findOne(latest_shipment.lane);
      return {
        lane: lane.slug || lane.name,
        date: latest_shipment.start,
        locale: latest_shipment.finished.toLocaleString(),
      };
    }

    return {
      lane: '',
      date: '',
      locale: 'never',
    };

  },
});
