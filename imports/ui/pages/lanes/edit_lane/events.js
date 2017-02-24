import { Template } from 'meteor/templating';
import { Lanes } from '../../../../api/lanes/lanes.js';

Template.edit_lane.events({
  'change form': function change_form (event) {
    let lane = Session.get('lane');
    let saved_lane = Lanes.findOne(lane._id);

    if (
      lane.name &&
      lane.name != 'New' &&
      lane.destinations &&
      lane.destinations.length > 0
    ) {

      lane.minimum_complete = _.every(
        lane.destinations,
        function check_minimum_complete (destination) {

          return destination.complete;
        }
      );
      Session.set('lane', lane);
      if (saved_lane) {
        Lanes.update({ _id: saved_lane._id }, lane);
      }
    }
  },

  'change .lane-name': function change_lane_name (event) {
    let lane = Session.get('lane');
    lane.name = event.target.value;
    Session.set('lane', lane);
    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
    FlowRouter.go('/lanes/' + lane.name + '/edit');
  },

  'change .destination': function validate_destination (event) {
    let $destination = $(event.target).parents('.destination');
    let destination_name = $destination.find('.destination-name').val();
    let destination_user = $destination.find('.destination-user').val();
    let use_private_key = $destination.find('.use-private-key').prop('checked');
    let private_key_location = $destination.find('.private-key-location').val();
    let password = $destination.find('.destination-password').val();
    let addresses = [];
    let stops = [];
    let lane = Session.get('lane');
    let index = parseInt(
      $destination.attr('data-destination-index'),
      10
    );
    let destinations = lane.destinations || [];
    let destination_incomplete;

    if (destination_name == '') {
      destination_incomplete = true;
    }

    _.each(
      $destination.find('.destination-address'),
      function validate_destination_addresses (address) {

        addresses.push(address.value);
        if (address.value == '') {
          destination_incomplete = true;
        }
      }
    );
    _.each(
      $destination.find('.stop'),
      function validate_destination_stops (stop) {

        let $stop = $(stop);
        let name = $stop.find('.stop-name').val();
        let command = $stop.find('.stop-command').val();

        stops.push({ name: name, command: command });
        if (name == '' || command == '') {
          destination_incomplete = true;
        }
      }
    );

    if (
      destination_name &&
      addresses &&
      addresses.length &&
      stops &&
      stops.length
    ) {
      destinations[index] = {
        name: destination_name,
        addresses: addresses,
        stops: stops,
        user: destination_user,
        password: password,
        use_private_key: use_private_key,
        private_key_location: private_key_location,
        complete: destination_incomplete ? false : true
      };

      lane.destinations = destinations;
      Session.set('lane', lane);
      if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
    }
  },

  'change .destination-name': function change_destination_name (event) {
    let $destination = $(event.target).parents('.destination');
    let index = parseInt(
      $destination.attr('data-destination-index'),
      10
    );
    let lane = Session.get('lane');
    let destinations = lane.destinations || [];

    destinations[index] = destinations[index] || {};
    destinations[index].name = event.target.value;
    lane.destinations = destinations;

    Session.set('lane', lane);
    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }

  },

  'change .captains': function change_captains (event) {
    let lane = Session.get('lane');
    let captains = lane.captains || [];
    let user = event.target.value;

    if (event.target.checked) {
      captains.push(user);
    } else {
      captains = _.reject(captains, function remove_captain (captain) {
        return captain == user;
      });
    }
    lane.captains = captains;

    Session.set('lane', lane);
    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
  },

  'change .destination-address': function change_destination_address (event) {
    let address_index = parseInt(
      $(event.target).attr('data-address-index'),
      10
    );
    let destination_index = parseInt(
      $(event.target).parents('fieldset').attr('data-destination-index'),
      10
    );
    let lane = Session.get('lane');
    let destination = lane.destinations[destination_index] || {};
    let addresses = destination.addresses || [];

    addresses[address_index] = event.target.value;
    destination.addresses = addresses;
    lane.destinations[destination_index] = destination;
    Session.set('lane', lane);
  },

  'click .add-address': function add_address (event) {
    event.preventDefault();

    let destination_index = parseInt(
      $(event.target)
        .parents('fieldset')
        .attr('data-destination-index'),
      10
    );
    let lane = Session.get('lane');
    let addresses = lane.destinations[destination_index].addresses;

    addresses.push('');
    lane.destinations[destination_index].addresses = addresses;
    lane.destinations[destination_index].complete = false;
    lane.minimum_complete = false;

    Session.set('lane', lane);

    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
  },

  'change .stop': function change_stop (event) {
    let $stop = $(event.target).parents('.stop');
    let stop_index = parseInt($stop.attr('data-stop-index'), 10);
    let destination_index = parseInt(
      $stop.parents('.destination').attr('data-destination-index'),
      10
    );
    let name = $stop.find('.stop-name').val();
    let command = $stop.find('.stop-command').val();
    let lane = Session.get('lane');
    let destination = lane.destinations[destination_index];

    if (name != '' && command != '') {
      destination.stops = destination.stops || [];
      destination.stops[stop_index] = {
        name: name,
        command: command
      };
      lane.destinations[destination_index] = destination;
      Session.set('lane', lane);
    }
  },

  'click .add-stop': function add_stop (event) {
    event.preventDefault();
    let lane = Session.get('lane');
    let destination_index = parseInt(
      $(event.target)
        .parents('.destination')
        .attr('data-destination-index'),
      10
    );
    let destination = lane.destinations[destination_index];

    destination.stops.push({ name: '', command: '' });
    destination.complete = false;
    lane.destinations[destination_index] = destination;
    lane.minimum_complete = false;
    Session.set('lane', lane);

    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
  },

  'click .add-destination': function add_destination (event) {
    event.preventDefault();

    let lane = Session.get('lane');
    lane.destinations.push({ name: '(New)' });
    lane.minimum_complete = false;

    Session.set('lane', lane);

    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
  },

  'click .lane-done': function lane_done (event) {
    event.preventDefault();
    let new_lane = Session.get('lane');
    let saved_lane = Lanes.findOne(new_lane._id);

    if (! saved_lane) {
      new_lane._id = Lanes.insert(new_lane);
      Session.set('lane', new_lane);
    } else {
      Lanes.update({ _id: saved_lane._id }, new_lane);
    }

  },

  'click .back-to-lanes': function back_to_lanes (event) {
    event.preventDefault();

    Session.set('lane', null);
    FlowRouter.go('/lanes');
  },

  'click .remove-address': function remove_address (event) {
    let address_index = parseInt(
      $(event.currentTarget)
        .siblings('.destination-address')
        .attr('data-address-index'),
      10
    );
    let destination_index = parseInt(
      $(event.target).parents('fieldset').attr('data-destination-index'),
      10
    );
    let lane = Session.get('lane');
    let destination = lane.destinations[destination_index];
    destination.addresses.splice(address_index, 1);

    lane.destinations[destination_index] = destination;

    Session.set('lane', lane);

    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
  },

  'click .remove-stop': function remove_stop (event) {
    let stop_index = parseInt(
      $(event.target)
        .parents('.stop')
        .attr('data-stop-index'),
      10
    );
    let destination_index = parseInt(
      $(event.target).parents('fieldset').attr('data-destination-index'),
      10
    );
    let lane = Session.get('lane');
    let destination = lane.destinations[destination_index];

    destination.stops.splice(stop_index, 1);

    lane.destinations[destination_index] = destination;

    Session.set('lane', lane);

    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
  },

  'click .remove-destination': function remove_destination (event) {
    event.preventDefault();
    let destination_index = parseInt(
      $(event.target).parents('fieldset').attr('data-destination-index'),
      10
    );
    let lane = Session.get('lane');
    lane.destinations.splice(destination_index, 1);

    Session.set('lane', lane);

    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
  },

  'change .use-private-key': function use_private_key (event) {
    let $destination = $(event.target).parents('.destination');
    let $private_key_location = $destination.find('.private-key-location');

    if ($(event.target).prop('checked')) {
      $private_key_location.prop('disabled', false);
    }

    $private_key_location.prop('disabled', true);
  }
});
