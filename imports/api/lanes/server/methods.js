import { Lanes } from '../lanes';
import Client from 'ssh2';
import fs from 'fs';
import expandTilde from 'expand-tilde';

Meteor.methods({
  'Lanes#start_shipment': function (lane_id, start_date) {
    var lane = Lanes.findOne(lane_id);
    var current_destination_index = 0;
    lane.date_history = lane.date_history || [];
    lane.date_history.push({
      start_date: start_date,
      actual: new Date()
    });

    Lanes.update(lane_id, lane);

    function visit_destinations () {

      var destination = lane.destinations[current_destination_index];
      var user = destination && destination.user ? destination.user : 'ubuntu';
      var password = destination && destination.password ?
        destination.password :
        ''
      ;
      var private_key;

      if (current_destination_index >= lane.destinations.length) {
        lane.shipment_active = false;
        Lanes.update(lane_id, lane);
        return;
      }

      if (destination.use_private_key && destination.private_key_location) {
        private_key = fs.readFileSync(
          expandTilde(destination.private_key_location),
          'utf8'
        );

      } else if (destination.use_private_key) {
        try {
          private_key = fs.readFileSync(expandTilde('~/.ssh/id_rsa'), 'utf8');
        } catch (err) {
          throw err;
          //TODO: Bubble this error up to the client
        }
      }

      destination.date_history = destination.date_history || [];
      destination.date_history.push({
        start_date: start_date,
        actual: Date.now()
      });

      Lanes.update(lane_id, lane);

      _.each(destination.addresses, function (address, index) {
        var stops_complete = 0;
        var addresses_complete = 0;
        var connection = new Client();
        var connection_options = {
          host: address,
          username: user,
          tryKeyboard: true
        };

        if (private_key && ! password) {
          connection_options.privateKey = private_key;

        } else if (password && ! private_key) {
          connection_options.password = password;

        } else if (password && private_key) {
          connection_options.privateKey = private_key;
          connection_options.password = password;
        }

        connection.on('ready', Meteor.bindEnvironment((err, stream) => {

          function execute_stop (stop) {
            stop.date_history = stop.date_history || [];
            stop.stdout_history = stop.stdout_history || [];
            stop.stderr_history = stop.stderr_history || [];
            stop.exit_code_history = stop.exit_code_history || [];
            stop.date_history.push({
              start_date: start_date,
              address: address,
              actual: new Date()
            });
            Lanes.update(lane_id, lane);

            connection.exec(
              stop.command,
              { pty: true },
              Meteor.bindEnvironment((err, stream) => {

              if (err) {
                lane.active_shipment = false;
                throw err;
              }

              stream.on('close', Meteor.bindEnvironment((code, signal) => {
                stop.exit_code_history.push({
                  code: code,
                  start_date: start_date,
                  address: address,
                  command: stop.command,
                  actual: new Date()
                });
                Lanes.update(lane_id, lane);

                stops_complete++;
                if (stops_complete >= destination.stops.length) {
                  addresses_complete++;
                } else {
                  execute_stop(destination.stops[stops_complete]);
                }
                if (addresses_complete == destination.addresses.length) {
                  current_destination_index++;
                  visit_destinations();
                }
              }))
              .on('data', Meteor.bindEnvironment((buffer) => {
                stop.stdout_history.push({
                  stdout: buffer.toString('utf8'),
                  start_date: start_date,
                  command: stop.command,
                  address: address,
                  actual: new Date()
                });
                Lanes.update(lane_id, lane);
              }))
              .stderr.on('data', Meteor.bindEnvironment((buffer) => {
                stop.stderr_history.push({
                  stderr: buffer.toString('utf8'),
                  start_date: start_date,
                  command: stop.command,
                  address: address,
                  actual: new Date()
                });
                Lanes.update(lane_id, lane);
              }))
              ;

            }));
          }

          execute_stop(destination.stops[stops_complete]);
        }))
        .on('error', Meteor.bindEnvironment((err) => {
          lane.shipment_active = false;
          Lanes.update(lane_id, lane);
          throw err;
        }))
        .connect(connection_options);
      });

    }

    visit_destinations();

    lane.date_history[lane.date_history.length - 1].finished = new Date();
    Lanes.update(lane_id, lane);

    return lane;

  }
});

