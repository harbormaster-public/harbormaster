import { ReactiveVar } from 'meteor/reactive-var';

import { Lanes } from '../../../../api/lanes';
import { Users } from '../../../../api/users';
import { Session } from 'meteor/session';
import { Harbors } from '../../../../api/harbors';
import { count, history, get_lane } from '../lib/util';

const not_found = new ReactiveVar(false);
//TODO: move to a template?
const not_found_text = `
  <p><strong>The harbor you're viewing hasn't been installed for this
    Harbormaster instance.</strong></p>
  <p>Editing it has been disabled.  To enable it, the harbor will need to
    be installed in the Harbormaster harbor directory
    (<code>~/.harbormaster/harbors</code> by default).</p>
`;
const loading_text = 'Loading...';

const update_harbor = function () {
  // Capture the user form values from component-agnostic rendering
  let inputs = $('.harbor').find('input, textarea');
  let values = {};
  let lane = Session.get('lane');
  const {refresh_harbor} = this;
  
  _.each(inputs, function (element) {
    let type = element.type;
    let value = element.value;
    let checked = element.checked;
    let name = element.name;

    if (! values[name]) {
      values[name] = type == 'checkbox' || type == 'radio' ?
        (checked && (value || checked)) || values[name] :
        value
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
      refresh_harbor();

      return Session.set({
        lane: res.lane,
        validating_fields: false,
      });
    }
  );
};

const update_lane = (lane) => {
  return H.call('Lanes#upsert', lane, (err, res) => {
    if (err) throw err;
    console.log(`Lane "${lane.name}" updated: ${res}`);
    
    Session.set('lane', lane);
    return res;
  });
};

const change_lane_name = function (event) {
  let lane = Session.get('lane') || {};
  lane.name = event.target.value;
  
  if (Lanes.findOne(lane._id)) update_lane(lane);
  else Session.set('lane', lane);
  const new_path = '/lanes/' + lane.name + '/edit';

  if (new_path != this.$route.path) this.$router.push(
    '/lanes/' + lane.name + '/edit'
  );
};

const slug = function (lane) {
  const a = 'àáäâãåèéëêìíïîòóöôùúüûñçßÿœæŕśńṕẃǵǹḿǘẍźḧ·/_,:;';
  const b = 'aaaaaaeeeeiiiioooouuuuncsyoarsnpwgnmuxzh------';
  const p = new RegExp(a.split('').join('|'), 'g');
  
  lane = lane && lane.name && lane.name != 'new' ? 
    lane : 
    get_lane(lane)
  ;
  
  if (lane) {
    const slug = lane.name.toLowerCase()
    // https://gist.github.com/matthagemann/382adfc57adbd5af078dc93feef01fe1
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
      .replace(/&/g, '-and-') // Replace & with 'and'
      .replace(/[^\w\-]+/g, '') // Remove all non-word characters
      .replace(/\-\-+/g, '-') // Replace multiple - with single -
      .replace(/^-+/, '') // Trim - from start of text
      .replace(/-+$/, '') // Trim - from end of text
    ;

    lane.slug = slug;
    H.call('Lanes#update_slug', lane, (err, res) => {
      if (err) throw err;
      console.log(`Lane slug ${lane.slug} updated: ${res}`);
    });

    return `${window.location.host}/lanes/${slug}/ship`;
  }

  return '';
};

const followup_lane = function () {
  let lane = get_lane(this.$route.params.name);
  if (! lane) return false;

  let followup_lane = Lanes.findOne(lane.followup);

  if (followup_lane) return followup_lane.name;

  return '';
}

const salvage_plan_lane = function () {
  let lane = get_lane(this.$route.params.name);
  if (! lane) return false;

  let salvage_plan = Lanes.findOne(lane.salvage_plan);

  if (salvage_plan) return salvage_plan.name;

  return '';
};

const lanes = function () {
  return Lanes.find({}, { sort: { name: 1 } });
};

const lane = function () {
  let lane = get_lane(this.$route.params.name);

  return lane;
};

const lane_count = function () {
  return count(get_lane(this.$route.params.name));
};

const shipment_history = function () {
  return history(get_lane(this.$route.params.name));
};

const no_followup = function () {
  let lane = get_lane(this.$route.params.name);

  return Lanes.find().count() < 2 ||
    lane && lane.followup ||
    Session.get('choose_followup') ||
    false;
};

const no_salvage = function () {
  let lane = get_lane(this.$route.params.name);

  return Lanes.find().count() < 2 ||
    lane && lane.salvage_plan ||
    Session.get('choose_salvage_plan') ||
    false;
};

const choose_followup = function () {
  let lane = get_lane(this.$route.params.name);

  return Session.get('choose_followup') || lane && lane.followup;
};

const choose_salvage_plan = function () {
  let lane = get_lane(this.$route.params.name);

  return Session.get('choose_salvage_plan') || lane && lane.salvage_plan;
};

const captain_list = function () {
  const lane = Session.get('lane');
  const users = Users.find().fetch();
  const captains = users.map(user => ({
    ...user,
    can_ply: () => {
      if (user.harbormaster) return true;
      if (lane.captains instanceof 'Array') {
        return lane.captains.find(captain => user._id = captain);
      }
      return false;
    },
    can_set_ply: user.harbormaster
  }));
  return captains;
};

const plying = function () {
  var lane = Session.get('lane');
  var user = Users.findOne(Meteor.user().emails[0].address);

  if (user && user.harbormaster) { return true; }

  if (lane.captains && lane.captains.length) {
    let captain = _.find(lane.captains, function (email) {
      return email == Meteor.user().emails[0].address;
    });

    return captain ? true : false;
  }

  return false;
};

const harbors = function () {
  let harbors = Harbors.find().fetch();

  return harbors;
};

const current_lane = function () {
  let name = this.$route.params.name;
  let lane = Session.get('lane') || get_lane(name);

  return lane || { type: false };
};

const lane_type = function () {
  let name = this.$route.params.name;
  let lane = Session.get('lane') || get_lane(name);

  return lane && lane.type;
};

const render_harbor = function () {
  let name = this.$route.params.name;
  let lane = Session.get('lane') || get_lane(name);
  if (!lane) return;
  let harbor = lane.type ? Harbors.findOne(lane.type) : {};
  let harbor_lane_reference = harbor?.lanes ? 
    harbor.lanes[lane._id] : 
    false
  ;
  let manifest = harbor_lane_reference ?
    harbor_lane_reference.manifest :
    false
  ;

  Meteor.call(
    'Harbors#render_input',
    lane,
    manifest,
    function (err, active_lane) {
      if (err) throw err;
      if (active_lane == 404) return not_found.set(true);

      if (active_lane) Session.set('lane', active_lane);
  });

  if (not_found.get()) return not_found_text;
  if (lane.rendered_input) return lane.rendered_input;
  else if (harbor.rendered_input) return harbor.rendered_input;
  else loading_text;
};

const validate_done = function () {
  let lane = get_lane(this.$route.params.name);
  
  return lane && lane.minimum_complete;
};

const chosen_followup = function (followup) {
  let lane = get_lane(this.$route.params.name);
  
  return followup._id && lane ? followup._id == lane.followup : false;
};

const chosen_salvage_plan = function (salvage_lane) {
  let lane = get_lane(this.$route.params.name);

  return salvage_lane._id && lane ? salvage_lane._id == lane.salvage_plan : false;
};

const submit_form = function () {
  let lane = get_lane(this.$route.params.name) || Session.get('lane');
  if (!lane) return;

  if (
    lane.name &&
    lane.name != 'New' &&
    lane.type
  ) {
    
    slug(lane, this.$route.params.name);
    Session.set('validating_fields', true);
    
    return this.update_harbor();
  }
  
  return lane;
};

const change_followup_lane = function (event) {
  let lane = get_lane(this.$route.params.name);
  let followup_lane = Lanes.findOne(event.target.value);

  if (
    lane.name &&
    lane.name != 'New' &&
    lane.type
  ) {
    lane.followup = followup_lane ? followup_lane._id : null;
    return update_lane(lane);
  }
  return lane;
};

const change_salvage_plan = function (event) {
  let lane = get_lane(this.$route.params.name);
  let salvage_plan_lane = Lanes.findOne(event.target.value);
  
  if (
    lane.name &&
    lane.name != 'New' &&
    lane.type
  ) {
    lane.salvage_plan = salvage_plan_lane ? salvage_plan_lane._id : null;
    return update_lane(lane);
  }
};

const change_captains = function (event) {
  let lane = get_lane(this.$route.params.name);
  let captains = lane && lane.captains ? lane.captains : [];
  let user = event.target.value;

  if (event.target.checked) {
    captains.push(user);
  }
  else {
    captains = _.reject(captains, function remove_captain (captain) {
      return captain == user;
    });
  }

  if (lane && Lanes.findOne(lane._id)) {
    lane.captains = captains;
    update_lane(lane);
  }
};

const back_to_lanes = function () {
  Session.set('lane', null);
  return  this.$router.push('/lanes');
};

const choose_harbor_type = function (event) {
  let type = $(event.target).attr('data-type');
  let lane = Session.get('lane');
  if (!lane) return;

  lane.type = type;
  slug.bind(this, lane);

  return H.call('Lanes#upsert', lane, (err, res) => {
    if (err) throw err;
    console.log(`Lane ${lane.name} added: ${res}`);
    Session.set('lane', lane);
    return res;
  });
};

const get_lane_name = function () {
  var name = this.$route.params.name;
  var lane = get_lane(name) || Session.get('lane') || { };
  Session.set('lane', lane);

  return lane.name == 'New' ? '' : lane.name;
};

// can_ply () {
      //   let lane = Session.get('lane') || {};
    //   let user = this;

    //   if (user.harbormaster) { return true; }

    //   if (lane.captains && lane.captains.length) {
      //     return _.find(lane.captains, (captain) => user._id == captain);
    //   }

    //   return false;
    // },

// can_set_ply () {
      //   var user = Users.findOne(Meteor.user().emails[0].address);

    //   if (this.harbormaster) { return true; }

    //   if (user) { return ! user.harbormaster; }

    //   return false;
    // },

export {
  update_harbor,
  update_lane,
  change_lane_name,
  slug,
  followup_lane,
  salvage_plan_lane,
  lanes,
  lane,
  lane_count,
  shipment_history,
  no_followup,
  no_salvage,
  choose_followup,
  choose_salvage_plan,
  captain_list,
  plying,
  harbors,
  current_lane,
  lane_type,
  render_harbor,
  validate_done,
  chosen_followup,
  chosen_salvage_plan,
  submit_form,
  change_followup_lane,
  change_salvage_plan,
  change_captains,
  back_to_lanes,
  choose_harbor_type,
  get_lane_name,
  not_found,
};