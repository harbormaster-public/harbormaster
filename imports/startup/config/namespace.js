import { HTTP } from 'meteor/http';
import { Email } from 'meteor/email';
import { Session } from 'meteor/session';
import { ReactiveVar } from "meteor/reactive-var";
import { start_date } from '../../api/dates';

// Global namespace
H = $H = Meteor;

H.harbors = {};

H.HTTP = HTTP;
H.Email = Email;
H.start_date = start_date;
H.start_shipment = function (lane_id, manifest, date) {
  date = date || start_date();
  return Meteor.call('Lanes#start_shipment', lane_id, manifest, date);
};
H.end_shipment = function (lane, exit_code, manifest) {
  return Meteor.call('Lanes#end_shipment', lane, exit_code, manifest);
};

H.bind = H.bindEnvironment;

// Test fixtures
if (H.isServer && H.isTest) {
  // eslint-disable-next-line no-native-reassign
  if (!Session) Session = {
    store: {},
    get (key) {
      return key && this.store[key] ? this.store[key] : false;
    },
    set (key, data) {
      this.store[key] = data;
    },
  };

  // eslint-disable-next-line no-native-reassign
  if (!ReactiveVar) ReactiveVar = function (val) {
    let store = val;
    return {
      get: () => store,
      set: (new_val) => store = new_val,
    };
  };
}

H.Session = Session;
H.ReactiveVar = ReactiveVar;

export default H;
