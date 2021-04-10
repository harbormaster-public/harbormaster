<template name="edit_lane">
  <div>
    <h1>Edit Lane:</h1>
    <div v-if="plying">

      <form v-on:submit.prevent="submit_form">
        <label>Lane Name
          <input 
            v-on:change.prevent="change_lane_name" 
            v-on:keypress="prevent_enter_key"
            v-model="lane_name"
            type=text 
            required 
            class="lane-name" >
        </label>
        <label class="url">Slug
          <input type=text disabled :value="slug">
        </label>
        <button 
          v-on:click.prevent="back_to_lanes"
          class="button hollow secondary back-to-lanes">Back to Lanes</button>
        <a
          v-on:click.prevent="new_lane" 
          href="/lanes/new/edit" 
          class="hollow button new-lane" 
          id="new-lane">New Lane</a>
        <div v-if="validate_done()">
          <a 
            :href="'/lanes/'+lane.slug+'/ship'" 
            class="button success ship-lane hollow">Ship to this Lane</a>
        </div>
        <div v-else>
          <button disabled class="button hollow alert lane-done">Not Ready</button>
        </div>
        <fieldset v-on:change.prevent="change_captains" class="fieldset captains">
          <legend>Captain(s)</legend>
          <ul>
            <div v-for="captain in captain_list" :key="captain._id">
              <li>
                <label>
                  <input 
                    type=checkbox 
                    :checked="captain.can_ply" 
                    :disabled="captain.can_set_ply" 
                    :value="captain._id">
                  {{captain._id}}
                </label>
              </li>
            </div>
          </ul>
        </fieldset>

        <h2>Harbor</h2>
        <fieldset class="fieldset harbor">
          <div v-if="!current_lane.type">
            <div v-if="choose_type">
              <legend>Choose your type of Work:</legend>
              <div 
                v-for="harbor in harbors" 
                :key="harbor._id">
                <button 
                  v-on:click="choose_harbor_type"
                  :id="'button-choose-'+harbor._id" 
                  class="button choose-harbor-type" 
                  :data-type="harbor._id">{{harbor._id}}</button>
              </div>
            </div>
            <div v-else>
              <button 
                v-on:click.prevent="add_destination"
                class="button add-harbor">
                <h3><span>+ </span>Add some Work for this Harbor</h3>
              </button>
            </div>
          </div>
          <div v-if="current_lane.type">
            <legend>Work: {{lane_type}}</legend>
            <section id=rendered-input v-html="render_harbor">
            </section>
            <div v-if="validating_fields">
              <button class="button secondary" disabled>Working...</button>
            </div>
            <div v-else>
              <button :class="'button hollow save '+can_save">Save</button>
            </div>
          </div>
        </fieldset>
        <div v-if="!no_followup">
          <button 
            v-on:click.prevent="add_followup_lane"
            class="button tiny add-followup">Add Followup Destination</button>
        </div>
        <div v-if="!no_salvage">
          <button 
            v-on:click.prevent="add_salvage_plan"
            class="button tiny warning add-salvage-plan">
            Add a Salvage Plan
          </button>
        </div>

        <div v-if="choose_followup">
          <fieldset v-on:change.prevent="change_followup_lane" class="fieldset followup">
            <legend>Followup: {{followup_lane}}</legend>
            <div v-for="followup in lanes" :key="followup._id">
              <label>
                <input 
                  :checked="chosen_followup(followup)" 
                  type=radio 
                  name="followup_lanes" 
                  :value="followup._id">
                {{followup.name}}
              </label>
            </div>
            <label>
              <input type=radio name="followup_lanes" value="">
              No Followup
            </label>
          </fieldset>
        </div>

        <div v-if="choose_salvage_plan">
          <fieldset 
            v-on:change.prevent="change_salvage_plan" 
            class="fieldset salvage-plan">
            <legend>Salvage Plan: {{salvage_plan_lane}}</legend>
            <div v-for="salvage_lane in lanes" :key="salvage_lane._id">
              <label>
                <input 
                  :checked="chosen_salvage_plan(salvage_lane)" 
                  type=radio 
                  name="salvage_plan_lanes" 
                  :value="salvage_lane._id">
                {{salvage_lane.name}}
              </label>
            </div>
            <label>
              <input type=radio name="followup_lanes" value="">
              No Salvage Plan
            </label>
          </fieldset>
        </div>
      </form>
    </div>

    <h2>Shipping Log: Last {{shipping_log_amount_shown}} shipments</h2>
    <ul>
      <div v-if="!$subReady.Lanes">
        <li>Loading...</li>
      </div>
      <div v-else>
        <div v-if="count">
          <div v-for="shipments in history" :key="shipments.start">
            <li>
              <a 
                :href="'/lanes/'+lane.slug+'/ship/'+shipments.start" 
                :class="'button tiny hollow'+(shipments.active ?' active':'')+' exit-code code-'+shipments.exit_code">
                Shipped on {{pretty_date(shipments.actual)}}; finished on {{pretty_date(shipments.finished)}}; {{duration(shipments)}} duration
              </a>
            </li>
          </div>
        </div>
        <div v-else>
          <li>None yet.</li>
        </div>
      </div>
    </ul>
  </div>
</template>

<script>
import { ReactiveVar } from 'meteor/reactive-var';
import { Lanes } from '../../../../api/lanes';
import { Session } from 'meteor/session';
import { Users } from '../../../../api/users';
import { Harbors } from '../../../../api/harbors';
import { count, history, get_lane } from '../lib/util';
import { moment } from 'meteor/momentjs:moment';

const options = { sort: { actual: -1 }, limit: H.AMOUNT_SHOWN };
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

let update_harbor = function () {
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
    get_lane(this.$route.params.name)
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

export default {
  meteor: {
    $subscribe: {
      'Lanes': function () { return [get_lane(this.$route.params.name)] },
      'Users': [],
      'Harbors': function () {
        const type = get_lane(this.$route.params.name)?.type;
        return [Harbors.findOne(type)];
      },
    },

    slug,

    followup_lane () {
      let lane = get_lane(this.$route.params.name);
      if (! lane) return false;

      let followup_lane = Lanes.findOne(lane.followup);

      if (followup_lane) return followup_lane.name;

      return '';
    },

    salvage_plan_lane () {
      let lane = get_lane(this.$route.params.name);
      if (! lane) return false;

      let salvage_plan = Lanes.findOne(lane.salvage_plan);

      if (salvage_plan) return salvage_plan.name;

      return '';
    },

    lanes () {
      return Lanes.find({}, { sort: { name: 1 } });
    },

    lane () {
      let lane = get_lane(this.$route.params.name);

      return lane;
    },

    count () {
      return count(get_lane(this.$route.params.name));
    },

    history () {
      return history(get_lane(this.$route.params.name));
    },

    shipping_log_amount_shown () {
      return H.AMOUNT_SHOWN;
    },

    no_followup () {
      let lane = get_lane(this.$route.params.name);

      return Lanes.find().count() < 2 ||
        lane && lane.followup ||
        Session.get('choose_followup') ||
        false;
    },

    no_salvage () {
      let lane = get_lane(this.$route.params.name);

      return Lanes.find().count() < 2 ||
        lane && lane.salvage_plan ||
        Session.get('choose_salvage_plan') ||
        false;
    },

    choose_followup () {
      let lane = get_lane(this.$route.params.name);

      return Session.get('choose_followup') || lane && lane.followup;
    },

    choose_salvage_plan () {
      let lane = get_lane(this.$route.params.name);

      return Session.get('choose_salvage_plan') || lane && lane.salvage_plan;
    },

    captain_list () {
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
    },

    // can_ply () {
      //   let lane = Session.get('lane') || {};
    //   let user = this;

    //   if (user.harbormaster) { return true; }

    //   if (lane.captains && lane.captains.length) {
      //     return _.find(lane.captains, (captain) => user._id == captain);
    //   }

    //   return false;
    // },

    plying () {
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
    },

    // can_set_ply () {
      //   var user = Users.findOne(Meteor.user().emails[0].address);

    //   if (this.harbormaster) { return true; }

    //   if (user) { return ! user.harbormaster; }

    //   return false;
    // },

    harbors () {
      let harbors = Harbors.find().fetch();

      return harbors;
    },

    choose_type () {
      return Session.get('choose_type');
    },

    current_lane () {
      let name = this.$route.params.name;
      let lane = Session.get('lane') || get_lane(name);

      return lane || { type: false };
    },

    lane_type () {
      let name = this.$route.params.name;
      let lane = Session.get('lane') || get_lane(name);

      return lane && lane.type;
    },

    render_harbor () {
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
    },

    validating_fields () {
      return Session.get('validating_fields');
    },

    can_save () {
      return not_found.get() ? 'disabled' : '';
    },
  },

  data () {
    return {
      harbor_refresh: 0,
    };
  },

  methods: {
    refresh_harbor () {
      this.harbor_refresh += 1;
    },

    validate_done () {
      let lane = get_lane(this.$route.params.name);
      
      return lane && lane.minimum_complete;
    },

    chosen_followup (followup) {
      let lane = get_lane(this.$route.params.name);
      
      return followup._id && lane ? followup._id == lane.followup : false;
    },

    chosen_salvage_plan (salvage_lane) {
      let lane = get_lane(this.$route.params.name);

      return salvage_lane._id && lane ? salvage_lane._id == lane.salvage_plan : false;
    },

    duration (shipment) {
      return moment
        .duration(shipment?.finished - shipment?.actual)
        .humanize();
    },
    
    pretty_date (date) {
      return new Date(date).toLocaleString();
    },
    update_harbor,
    submit_form () {
      let lane = get_lane(this.$route.params.name) || Session.get('lane');
      if (!lane) return;

      if (
        lane.name &&
        lane.name != 'New' &&
        lane.type
      ) {
        
        slug.bind(this, lane);
        Session.set('validating_fields', true);
        
        return this.update_harbor();
      }
      
      return lane;
    },

    change_followup_lane (event) {
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
    },

    change_salvage_plan (event) {
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
    },

    change_lane_name,

    prevent_enter_key (event) {
      if (event.key == 'Enter') event.preventDefault();
    },

    change_captains (event) {
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
    },

    add_destination (event) {
      event.preventDefault();

      return Session.set('choose_type', true);
    },

    back_to_lanes (event) {
      event.preventDefault();

      Session.set('lane', null);
      return  this.$router.push('/lanes');
    },

    choose_harbor_type (event) {
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
    },

    add_followup_lane (e) {
      e.preventDefault();
      return Session.set('choose_followup', true);
    },

    add_salvage_plan (e) {
      e.preventDefault();
      return Session.set('choose_salvage_plan', true);
    },

    new_lane () {
      Session.set('lane', {});
    },

    get_lane_name () {
      var name = this.$route.params.name;
      var lane = get_lane(name) || Session.get('lane') || { };
      Session.set('lane', lane);

      return lane.name == 'New' ? '' : lane.name;
    },
  },

  mounted () {
    const name = this.$route.params.name;
    const lane = get_lane(name);
    const harbor = lane && Harbors.findOne(lane.type) || {};

    if (lane) Meteor.subscribe('Shipments', lane, options);
  },

  data () {
    let lane_name = this.get_lane_name();

    return {
      lane_name
    }
  }
}
</script>

<style>
form p {
  margin-bottom: 15px;
}

li {
  list-style-type: circle;
  margin: 5px;
}

.destination[data-destination-index="0"] .remove-destination {
  display: none;
}

.address-field {
  position: relative;
  width: 100%;
  height: 100%;
  display: inline-block;
}

.destination-address {
  padding-right: 15px;
}

.stop {
  position: relative;
}

.stop .close-button,
.address-field .close-button {
  right: 0;
  top: 0;
  background: #eee;
  width: 40px;
  height: 39px;
  border: 1px solid #ccc;
}

.stop .close-button {
  top: 25px;
}

.destination-address[data-address-index="0"] + .remove-address {
  display: none;
}

.stop[data-stop-index="0"] .remove-stop {
  display: none;
}

fieldset.followup {
  background: #0af;
}

fieldset.followup label {
  color: white;
}

fieldset.salvage-plan {
  background: #ffae00;
}

fieldset.captains ul li {
  display: inline-block;
}

.url {
  margin: 15px 0;
}

@media all and (max-width: 1200px) {
  .url {
    margin: 35px 0;
  }
}

</style>