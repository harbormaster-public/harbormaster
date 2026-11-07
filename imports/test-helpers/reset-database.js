import { Users } from '../api/users';
import { Harbors } from '../api/harbors';
import { Lanes } from '../api/lanes';
import { Shipments, LatestShipment } from '../api/shipments';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import H from '../startup/config/namespace';
import { applyServerTestStubs } from './namespace-stubs';

// Ensure server-side unit tests have required namespace shims.
if (Meteor.isServer && Meteor.isTest) {
  applyServerTestStubs(H);
}

/* istanbul ignore next */
export const resetDatabase = async () => {
  await Users.removeAsync({});
  await H.users.removeAsync({});
  await Harbors.removeAsync({});
  await Lanes.removeAsync({});
  await Shipments.removeAsync({});
  await LatestShipment.removeAsync({});
  const returns = Mongo.getCollection('ShipmentReturns');
  if (returns) await returns.removeAsync({});
};

export default resetDatabase;

