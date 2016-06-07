import { Template } from 'meteor/templating';
import { Lanes } from '../../../../api/lanes/lanes.js';

Template.edit_lane.events({
  'change form': function (event) {
    var lane = Session.get('lane');
    var saved_lane = Lanes.findOne(lane._id);

    if (
      lane.name &&
      lane.name != 'New' &&
      lane.destinations &&
      lane.destinations.length > 0
    ) {

      lane.minimum_complete = _.every(
        lane.destinations,
        function (destination) {

        return destination.complete;
      });
      Session.set('lane', lane);
      if (saved_lane) {
        Lanes.update({ _id: saved_lane._id }, lane);
      }
    }
  },

  'change .lane-name': function (event) {
    var lane = Session.get('lane');
    lane.name = event.target.value;
    Session.set('lane', lane);
    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
    FlowRouter.go('/lanes/' + lane.name + '/edit');
  },

  'change .destination': function validate_destination (event) {
    var $destination = $(event.target).parents('.destination');
    var destination_name = $destination.find('.destination-name').val();
    var addresses = [];
    var stops = [];
    var lane = Session.get('lane');
    var index = parseInt(
      $destination.attr('data-destination-index'),
      10
    );
    var destinations = lane.destinations || [];
    var destination_incomplete;

    if (destination_name == '') {
      destination_incomplete = true;
    }

    _.each(
      $destination.find('.destination-address'),
      function (address) {

        addresses.push(address.value);
        if (address.value == '') {
          destination_incomplete = true;
        }
    });
    _.each(
      $destination.find('.stop'),
      function (stop) {

      var $stop = $(stop);
      var name = $stop.find('.stop-name').val();
      var command = $stop.find('.stop-command').val();

      stops.push({ name: name, command: command });
      if (name == '' || command == '') {
        destination_incomplete = true;
      }
    });

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
        complete: destination_incomplete ? false : true
      }

      lane.destinations = destinations;
      Session.set('lane', lane);
      if (Lanes.findOne(lane._id)){ Lanes.update(lane._id, lane); }
    }
  },

  'change .destination-name': function (event) {
    var $destination = $(event.target).parents('.destination');
    var index = parseInt(
      $destination.attr('data-destination-index'),
      10
    );
    var lane = Session.get('lane');
    var destinations = lane.destinations || [];

    destinations[index] = destinations[index] || {};
    destinations[index].name = event.target.value;
    lane.destinations = destinations;

    Session.set('lane', lane);
    if (Lanes.findOne(lane._id)){ Lanes.update(lane._id, lane); }

  },

  'change .captains': function (event) {
    var lane = Session.get('lane');
    var captains = lane.captains || [];
    var user = event.target.value;

    if (event.target.checked) {
      captains.push(user);
    } else {
      captains = _.reject(captains, function (captain) {
        return captain == user;
      });
    }
    lane.captains = captains;

    Session.set('lane', lane);
    if (Lanes.findOne(lane._id)){ Lanes.update(lane._id, lane); }
  },

  'change .destination-address': function (event) {
    var address_index = parseInt(
      $(event.target).attr('data-address-index'),
      10
    );
    var destination_index = parseInt(
      $(event.target).parents('fieldset').attr('data-destination-index'),
      10
    );
    var lane = Session.get('lane');
    var destination = lane.destinations[destination_index] || {};
    var addresses = destination.addresses || [];

    addresses[address_index] = event.target.value;
    destination.addresses = addresses;
    lane.destinations[destination_index] = destination;
    Session.set('lane', lane);
  },

  'click .add-address': function (event) {
    event.preventDefault();

    var destination_index = parseInt(
      $(event.target)
        .parents('fieldset')
        .attr('data-destination-index'),
      10
    );
    var lane = Session.get('lane');
    var addresses = lane.destinations[destination_index].addresses;

    addresses.push('');
    lane.destinations[destination_index].addresses = addresses;
    lane.destinations[destination_index].complete = false;
    lane.minimum_complete = false;

    Session.set('lane', lane);

    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
  },

  'change .stop': function (event) {
    var $stop = $(event.target).parents('.stop');
    var stop_index = parseInt($stop.attr('data-stop-index'), 10);
    var destination_index = parseInt(
      $stop.parents('.destination').attr('data-destination-index'),
      10
    );
    var name = $stop.find('.stop-name').val();
    var command = $stop.find('.stop-command').val();
    var lane = Session.get('lane');
    var destination = lane.destinations[destination_index];

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

  'click .add-stop': function (event) {
    event.preventDefault();
    var lane = Session.get('lane');
    var destination_index = parseInt(
      $(event.target)
        .parents('.destination')
        .attr('data-destination-index'),
      10
    );
    var destintation = lane.destinations[destination_index];

    destination.stops.push({ name: '', command: '' });
    destination.complete = false;
    lane.destinations[destination_index] = destination;
    lane.minimum_complete = false;
    Session.set('lane', lane);

    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
  },

  'click .add-destination': function (event) {
    event.preventDefault();

    var lane = Session.get('lane');
    lane.destinations.push({ name: '(New)' });
    lane.minimum_complete = false;

    Session.set('lane', lane);

    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
  },

  'click .lane-done': function (event) {
    event.preventDefault();
    var new_lane = Session.get('lane');
    var saved_lane = Lanes.findOne(new_lane._id);

    if (! saved_lane) {
      new_lane._id = Lanes.insert(new_lane);
      Session.set('lane', new_lane);
    } else {
      Lanes.update({ _id: saved_lane._id }, new_lane);
    }

  },

  'click .back-to-lanes': function (event) {
    event.preventDefault();

    Session.set('lane', null);
    FlowRouter.go('/lanes');
  },

  'click .remove-address': function (event) {
    var address_index = parseInt(
      $(event.currentTarget)
        .siblings('.destination-address')
        .attr('data-address-index'),
      10
    );
    var destination_index = parseInt(
      $(event.target).parents('fieldset').attr('data-destination-index'),
      10
    );
    var lane = Session.get('lane');
    var destination = lane.destinations[destination_index];
    destination.addresses.splice(address_index, 1);

    lane.destinations[destination_index] = destination;

    Session.set('lane', lane);

    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
  },

  'click .remove-stop': function (event) {
    var stop_index = parseInt(
      $(event.target)
        .parents('.stop')
        .attr('data-stop-index'),
      10
    );
    var destination_index = parseInt(
      $(event.target).parents('fieldset').attr('data-destination-index'),
      10
    );
    var lane = Session.get('lane');
    var destination = lane.destinations[destination_index];

    destination.stops.splice(stop_index, 1);

    lane.destinations[destination_index] = destination;

    Session.set('lane', lane);

    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
  },

  'click .remove-destination': function (event) {
    event.preventDefault();
    var destination_index = parseInt(
      $(event.target).parents('fieldset').attr('data-destination-index'),
      10
    );
    var lane = Session.get('lane');
    lane.destinations.splice(destination_index, 1);

    Session.set('lane', lane);

    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
  }
});
