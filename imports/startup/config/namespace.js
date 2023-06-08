import { HTTP } from 'meteor/http';
import { Email } from 'meteor/email';
import { Session } from 'meteor/session';
import { ReactiveVar } from "meteor/reactive-var";
import { $ } from 'meteor/jquery';
import { start_date } from '../../api/dates';

// Global namespace
H = $H = Meteor;

H.harbors = {};

H.HTTP = HTTP;
H.Email = Email;
H.start_date = start_date;
H.start_shipment = function (lane_id, manifest, date) {
  date = date || start_date();
  return H.call('Lanes#start_shipment', lane_id, manifest, date);
};
H.end_shipment = function (lane, exit_code, manifest) {
  return H.call('Lanes#end_shipment', lane, exit_code, manifest);
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

  // eslint-disable-next-line no-native-reassign
  if (!$) $ = function () {
    return {
      find (selector) {
        switch (selector) {
          case 'input, textarea':
            return [
              { type: 'text', value: 'foo', name: 'foo' },
              { type: 'checkbox', value: 'bar', name: 'bar', checked: true },
              { type: 'radio', value: 'baz', name: 'baz', checked: false },
              { type: 'textarea', value: 'qux', name: 'qux' },
            ];
          default:
            return [];
        }
      },
      attr (selector) {
        switch (selector) {
          default:
          case 'data-type':
            return 'test_type';
        }
       },
    };
  };
}

H.Session = Session;
H.ReactiveVar = ReactiveVar;
H.$ = $;
H.alert = H.isClient ? alert : console.warn;
H.window = H.isClient ? window : { location: { host: 'localhost:4040' } };

export default H;
