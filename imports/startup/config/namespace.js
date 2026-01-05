import { fetch, Headers } from 'meteor/fetch';
import { Session } from 'meteor/session';
import { ReactiveVar } from 'meteor/reactive-var';
import { $ } from 'meteor/jquery';
import { start_date } from '../../api/dates';
import { Meteor } from 'meteor/meteor';


// This file handles the namespace for the application
/* istanbul ignore next */
(function () {
  globalThis.H = Meteor;
  globalThis.$H = globalThis.H;

  // NOTE:
  // Under Vite/ESM, imported bindings are immutable. So we never reassign the
  // imports themselves; we assign them onto `H.*` and stub `H.*` in tests.
  H.Session = Session;
  H.ReactiveVar = ReactiveVar;
  H.$ = $;

  H.harbors = {};
  H.users = Meteor.users;

  H.fetch = fetch;
  H.fetch.Headers = Headers;
  H.start_date = start_date;
  H.start_shipment = function (lane_id, manifest, date) {
    date = date || start_date();
    return H.call('Lanes#start_shipment', lane_id, manifest, date);
  };
  H.end_shipment = function (lane, exit_code, manifest) {
    return H.call('Lanes#end_shipment', lane, exit_code, manifest);
  };

  H.bind = H.bindEnvironment;

  // E2E/test-specific flags are configured elsewhere (not in this file).
})();

export default H;
