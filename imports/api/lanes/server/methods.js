import { Lanes } from '../lanes';
import SSH from 'simple-ssh';
import fs from 'fs';

Meteor.methods({
  'lanes:start_shipment': function (lane_id, start_date) {
    var lane = Lanes.findOne(lane_id);
    //TODO: Make this configurable
    var private_key = fs.readFileSync('/home/skyler/.ssh/id_rsa');
    lane.date_history = lane.date_history || [];
    lane.date_history.push({
      start_date: start_date,
      actual: Date.now()
    });

    Lanes.update(lane_id, lane);

    _.each(lane.destinations, function (destination) {
      destination.date_history = destination.date_history || [];
      destination.date_history.push({
        start_date: start_date,
        actual: Date.now()
      });

      Lanes.update(lane_id, lane);

      _.each(destination.addresses, function (address) {
        var ssh = new SSH({
          host: address,
          //TODO: make this an option on the form
          user: 'ubuntu',
          key: private_key
        });

        _.each(destination.stops, function (stop) {
          stop.date_history = stop.date_history || [];
          stop.date_history.push({
            start_date: start_date,
            address: address,
            actual: Date.now()
          });

          Lanes.update(lane_id, lane);

          ssh.exec(stop.command, {
            out: Meteor.bindEnvironment(function (stdout) {
              stop.stdout_history = stop.stdout_history || [];
              stop.stdout_history.push({
                stdout: stdout,
                start_date: start_date,
                command: stop.command,
                address: address,
                actual: Date.now()
              });
              Lanes.update(lane_id, lane);
            }),
            err: Meteor.bindEnvironment(function (stderr) {
              stop.stderr_history = stop.stderr_history || [];
              stop.stderr_history.push({
                stderr: stderr,
                start_date: start_date,
                command: stop.command,
                address: address,
                actual: Date.now()
              });
              Lanes.update(lane_id, lane);
            }),
            exit: Meteor.bindEnvironment(function (code) {
              stop.exit_code_history = stop.exit_code_history || [];
              stop.exit_code_history.push({
                code: code,
                start_date: start_date,
                address: address,
                command: stop.command,
                actual: Date.now()
              });
              Lanes.update(lane_id, lane);
            })
          }).start();
        });
      });
    });

    lane.shipment_active = false;
    lane.date_history[lane.date_history.length - 1].finished = Date.now();
    Lanes.update(lane_id, lane);

    return lane;

  }
});

