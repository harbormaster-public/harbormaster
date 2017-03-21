import { Shipments } from '../shipments';

Meteor.publish('Shipments', function () {
  return Shipments.find();
});
