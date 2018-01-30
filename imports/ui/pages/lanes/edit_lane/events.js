import { Template } from 'meteor/templating';
import { Lanes } from '../../../../api/lanes';

let update_harbor = function (template) {
  let inputs = template.$('.harbor').find('input, textarea');
  let values = {};
  let lane = Session.get('lane');

  _.each(inputs, function (element) {
    let type = element.type;
    let value = element.value;
    let checked = element.checked;
    let name = element.name;

    if (! values[element.name]) {
      values[name] = type == 'checkbox' || type == 'radio' ?
        (checked && (value || checked)) || values[name] :
        element.value
      ;
    }
  });

  values.timestamp = Date.now();

  return Meteor.call(
    'Harbors#update',
    lane,
    values,
    function update_harbor_method (err, res) {
      let validating_fields = Session.get('validating_fields');
      if (err) throw err;

      if (! res.success && validating_fields) alert('Invalid values.');

      return Session.set({
        lane: res.lane,
        validating_fields: false,
      });
    }
  );
};

Template.edit_lane.events({
  'submit form': function submit_form (event, template) {
    event.preventDefault();

    let lane = Session.get('lane');

    if (
      lane.name &&
      lane.name != 'New' &&
      lane.type
    ) {
      Session.set('validating_fields', true);

      return update_harbor(template);
    }

    return lane;
  },

  'change .followup': function change_followup_lane (event) {
    let lane = Session.get('lane');
    let followup_lane = Lanes.findOne(event.target.value);

    if (
      lane.name &&
      lane.name != 'New' &&
      lane.type
    ) {
      lane.followup = followup_lane ? followup_lane._id : null;
      Lanes.update(lane._id, lane);
      Session.set('lane', lane);
    }
  },

  'change .salvage-plan': function change_salvage_plan (event) {
    let lane = Session.get('lane');
    let salvage_plan_lane = Lanes.findOne(event.target.value);

    if (
      lane.name &&
      lane.name != 'New' &&
      lane.type
    ) {
      lane.salvage_plan = salvage_plan_lane ? salvage_plan_lane._id : null;
      Lanes.update(lane._id, lane);
      Session.set('lane', lane);
    }
  },

  'change .lane-name': function change_lane_name (event) {
    let lane = Session.get('lane') || {};
    lane.name = event.target.value;
    Session.set('lane', lane);
    if (Lanes.findOne(lane._id)) { Lanes.update(lane._id, lane); }
    FlowRouter.go('/lanes/' + lane.name + '/edit');
  },

  'keypress .lane-name': function (event) {
    if (event.key == 'Enter') event.preventDefault();
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

  'click .add-harbor': function add_destination (event) {
    event.preventDefault();

    return Session.set('choose_type', true);
  },

  'click .back-to-lanes': function back_to_lanes (event) {
    event.preventDefault();

    Session.set('lane', null);
    return FlowRouter.go('/lanes');
  },

  'click .choose-harbor-type': function choose_harbor_type (event, template) {
    event.preventDefault();

    let type = $(event.target).attr('data-type');
    let lane = Session.get('lane');

    lane.type = type;
    Session.set('lane', lane);
    return Lanes.upsert({ _id: lane._id }, lane, function (err, count) {
      if (err || count < 1) throw (err || new Error('No Lanes modified!'));

      return update_harbor(template);
    });
  },

  'click .add-followup': function add_followup_lane () {
    return Session.set('choose_followup', true);
  },

  'click .add-salvage-plan': function add_salvage_plan () {
    return Session.set('choose_salvage_plan', true);
  },

});
