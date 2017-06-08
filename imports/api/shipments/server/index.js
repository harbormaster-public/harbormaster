import { Shipments } from '..';

Meteor.publish('Shipments', function () {
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

    console.log(shipments.length);
    return shipments.length;
  }
});
