import { Lanes } from '../lanes';
import SSH from 'simple-ssh';
import fs from 'fs';

Meteor.methods({
  'lanes:start_shipment': function (lane_id) {
    var lane = Lanes.findOne(lane_id);
    //TODO: Make this configurable
    var private_key = fs.readFileSync('/home/skyler/.ssh/id_rsa');

    lane.date_history = lane.date_history || [];
    //TODO: Might need to make this bindable via a unique ID.
    //Maybe it should be its own document?
    lane.date_history.push(Date.now());
    lane.in_progress = true;

    Lanes.update(lane_id, lane);

    _.each(lane.destinations, function (destination) {
      destination.date_history = destination.date_history || [];
      destination.date_history.push(Date.now());

      Lanes.update(lane_id, lane);

      _.each(destination.addresses, function (address) {
        var ssh = new SSH({
          host: address,
          //TODO: make this an option on the form
          user: 'ubuntu',
          key: private_key
        });

        _.each(destination.stops, function (stop) {
          stop.date_started_history = stop.date_started_history || [];
          stop.date_started_history.push(Date.now());

          Lanes.update(lane_id, lane);

          ssh.exec(stop.command, {
            out: Meteor.bindEnvironment(function (stdout) {
              stop.stdout_history = stop.stdout_history || [];
              stop.stdout_history.push({
                stdout: stdout,
                date: Date.now()
              });
              Lanes.update(lane_id, lane);
            }),
            err: Meteor.bindEnvironment(function (stderr) {
              stop.stderr_history = stop.stderr_history || [];
              stop.stderr_history.push({
                stderr: stderr,
                date: Date.now()
              });
              Lanes.update(lane_id, lane);
            }),
            exit: Meteor.bindEnvironment(function (code) {
              stop.exit_code_history = stop.exit_code_history || [];
              stop.exit_code_history.push({
                code: code,
                date: Date.now()
              });
              Lanes.update(lane_id, lane);
            })
          }).start();
        });
      });
    });
  }
});

