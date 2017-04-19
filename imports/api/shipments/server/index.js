import { Shipments } from '..';

Meteor.publish('Shipments', function () {
  return Shipments.find();
});
