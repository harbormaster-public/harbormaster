import { Shipments } from '..';
import { Lanes } from '../../lanes';

Meteor.publish('Shipments', function (lane) {
  if (lane) return Shipments.find({ lane: lane._id });

  return Shipments.find();
});

Meteor.methods({
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

  'Shipments#get_latest_date': function () {
    let latest_shipment = Shipments.find().fetch().reverse()[0];
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
