import { Lanes } from '../lanes';
import Client from 'ssh2';
import fs from 'fs';
import expandTilde from 'expand-tilde';

Meteor.publish('Lanes', function () {
  return Lanes.find();
});

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
      var addresses_complete = 0;

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
        var connection = new Client();
        var connection_options = {
          host: address,
          username: user,
          tryKeyboard: true
        };

        if (private_key && ! password) {
          connection_options.privateKey = private_key;
          console.log(
            'Logging into',
            address,
            'as',
            user,
            'with key',
            destination.private_key_location ?
              destination.private_key_location :
              '~/.ssh/id_rsa'
          );

        } else if (password && ! private_key) {
          connection_options.password = password;
          console.log('Logging into', address, 'as', user, 'with a password');

        } else if (password && private_key) {
          connection_options.privateKey = private_key;
          connection_options.password = password;
          console.log(
            'Logging into',
            address,
            'as',
            user,
            'with a password and key',
            destination.private_key_location ?
              destination.private_key_location :
              '~/.ssh/id_rsa'
          );
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

            console.log(
              'Executing command "' + stop.command + '" on machine:', address
            );
            connection.exec(
              stop.command,
              { pty: true },
              Meteor.bindEnvironment((err, stream) => {

              if (err) {
                lane.active_shipment = false;
                throw err;
              }

              stream.on('close', Meteor.bindEnvironment((code, signal) => {
                console.log(
                  'Command "' + stop.command + '" exited with code', code
                );
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
                console.log(
                  'Command "' + stop.command + '" logged data:\n',
                  buffer.toString('utf8')
                );
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
                console.log(
                  'Command "' + stop.command + '" errored with error:\n',
                  buffer.toString('utf8')
                );
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

          console.log('Connection ready.');

          execute_stop(destination.stops[stops_complete]);
        }))
        .on('error', Meteor.bindEnvironment((err) => {
          console.log('Error with connection!');
          lane.shipment_active = false;
          Lanes.update(lane_id, lane);
          throw err;
        }))
        .connect(connection_options);
      });

    }

    console.log('Starting shipment for lane:', lane.name);

    visit_destinations();

    //if (! lane.shipment_active) {
      //_.each(connections, function (ssh) { ssh.end(); });
    //}

    lane.date_history[lane.date_history.length - 1].finished = new Date();
    Lanes.update(lane_id, lane);

    return lane;
  },

  'Lanes#abort_shipment': function (name) {
    let lane = Lanes.findOne({ name: name });

    lane.shipment_active = false;

    return Lanes.update(lane._id, lane);
  }
});

