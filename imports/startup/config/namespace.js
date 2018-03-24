import { HTTP } from 'meteor/http';
import { Email } from 'meteor/email';
import { start_date } from '../../api/dates';

// Global namespace
$H = Meteor;

$H.harbors = {};

$H.HTTP = HTTP;
$H.Email = Email;
$H.start_date = start_date;
$H.start_shipment = function (lane_id, manifest, date) {
  date = date || start_date();
  return Meteor.call('Lanes#start_shipment', lane_id, manifest, date);
};
$H.end_shipment = function (lane, exit_code, manifest) {
  return Meteor.call('Lanes#end_shipment', lane, exit_code, manifest);
};
