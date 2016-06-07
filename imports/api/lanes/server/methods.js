import { Lanes } from '../lanes';
import SSH from 'simple-ssh';
import fs from 'fs';

Meteor.methods({
  'lanes:start_shipment': function (lane_id, start_date) {
    var lane = Lanes.findOne(lane_id);
    //TODO: Make this configurable
    var private_key = fs.readFileSync('/home/skyler/.ssh/id_rsa');
    var current_destination_index = 0;
    lane.date_history = lane.date_history || [];
    lane.date_history.push({
      start_date: start_date,
      actual: Date.now()
    });

    Lanes.update(lane_id, lane);

    // TODO: Probably worth revisiting this execution chain.  For example,
    // multiple `sleep` statements don't seem to play nicely with one another
    // when executed on the same boxes.  Need to dig in to find if that's due
    // to this, or on the box itself; or to find a better way to verify the
    // execution order is happening as expected.
    function visit_destinations () {

      var destination = lane.destinations[current_destination_index];
      var addresses_complete = 0;

      if (current_destination_index >= lane.destinations.length) { return; }

      destination.date_history = destination.date_history || [];
      destination.date_history.push({
        start_date: start_date,
        actual: Date.now()
      });

      Lanes.update(lane_id, lane);

      _.each(destination.addresses, function (address, index) {
        var stops_complete = 0;
        var ssh = new SSH({
          host: address,
          //TODO: make this an option on the form
          user: 'ubuntu',
          key: private_key
        });

        _.each(destination.stops, function (stop, index) {
          stop.date_history = stop.date_history || [];
          stop.stdout_history = stop.stdout_history || [];
          stop.stderr_history = stop.stderr_history || [];
          stop.exit_code_history = stop.exit_code_history || [];
          stop.date_history.push({
            start_date: start_date,
            address: address,
            actual: Date.now()
          });

          Lanes.update(lane_id, lane);

          ssh.exec(stop.command, {
            out: Meteor.bindEnvironment(function (stdout) {
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
              stop.exit_code_history.push({
                code: code,
                start_date: start_date,
                address: address,
                command: stop.command,
                actual: Date.now()
              });
              Lanes.update(lane_id, lane);

              stops_complete++;
              if (stops_complete == destination.stops.length) {
                addresses_complete++;
              }
              if (addresses_complete == destination.addresses.length) {
                current_destination_index++;
                visit_destinations();
              }
            })
          });
        });
        ssh.start();
      });
    }

    visit_destinations();

    lane.shipment_active = false;
    lane.date_history[lane.date_history.length - 1].finished = Date.now();
    Lanes.update(lane_id, lane);

    return lane;

  }
});

