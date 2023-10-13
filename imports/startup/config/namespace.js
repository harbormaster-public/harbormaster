
import { HTTP } from 'meteor/http';
import { Email } from 'meteor/email';
import { Session } from 'meteor/session';
import { ReactiveVar } from "meteor/reactive-var";
import { $ } from 'meteor/jquery';
import { start_date } from '../../api/dates';
import { Accounts } from 'meteor/accounts-base';
import { Lanes } from '../../api/lanes';
import { Users } from '../../api/users';
import { LatestShipment, Shipments } from '../../api/shipments';
import { Harbors } from '../../api/harbors';

/* istanbul ignore next */
(function () {

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
    const test_email = require("faker").internet.email();
    // eslint-disable-next-line no-native-reassign
    if (!Session) Session = {
      store: {},
      get (key) {
        if (this.store[key] || this.store[key] == 0) return this.store[key];
        return undefined;
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
    if (!$) $ = function (target) {
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
          case 'data-value':
            return 'test_value';
          case 'data-lane-id':
            return 'test';
          }
        },
        addClass (className) {
          target[className] = true;
          return this;
        },
        removeClass (className) {
          target[className] = false;
          return this;
        },
        siblings () { return H.$(target.siblings); },
        parents () { return H.$(target.parents); },
      };
    };

    if (!Accounts.onResetPasswordLink) Accounts.onResetPasswordLink = () => { };
    if (!Accounts.resetPassword) Accounts.resetPassword = () => { };

    Factory.define('lane', Lanes, {
      _id: '',
      name: '',
      captains: [],
      type: '',
      actual: new Date(),
      last_shipment: { exit_code: 1 },
      followup: { name: '' },
      salvage_plan: {
        name: '',
        _id: '',
      },
    });

    Factory.define("user", Users, {
      _id: test_email,
    });

    Factory.define('shipment', Shipments, {
      _id: '',
      lane: '',
      actual: new Date(),
      finished: new Date(),
    });

    Factory.define('latest_shipment', LatestShipment, {
      _id: '',
      shipment: {},
    });

    Factory.define('harbor', Harbors, {
      _id: '',
      lanes: {},
    });

    H.user = () => ({ emails: [{ address: 'test@harbormaster.io' }] });
  }

  H.Session = Session;
  H.ReactiveVar = ReactiveVar;
  H.$ = $;
  H.alert = H.isClient ? alert : console.warn;
  H.confirm = H.isClient ? args => window.confirm(args) : console.warn;
  H.window = H.isClient ? window : {
    location: {
      host: 'localhost:4040',
      reload: () => { },
    },
    document: {
      createElement: () => ({}),
      body: { appendChild: () => { } },
      head: { appendChild: () => { } },
    },
  };

})();

export default H;
