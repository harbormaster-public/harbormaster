<template>
  <div id=edit-lane-page>
    <h1 class="text-5xl my-2">Edit Lane:</h1>
    <div v-if="plying">

      <form v-on:submit.prevent="submit_form" :key="harbor_refresh">
        <pre>
          <label>Name:&nbsp;
            <input 
              v-on:change.prevent="change_lane_name" 
              v-on:keypress="prevent_enter_key"
              v-model="lane_name"
              type=text 
              required 
              class="lane-name"
            >
          </label>
          <br>
          <label class="url">Slug:&nbsp;
            <input 
              type=text 
              disabled 
              :value="slug(this.$route.params.name)"
              class="slug"
            >
          </label>
        </pre>
        <hr>
        <button 
          v-on:click.prevent="back_to_lanes"
          class="rounded-sm my-2 block back-to-lanes">Back to Lanes</button>
        <a
          v-on:click="new_lane" 
          href="/lanes/new/edit" 
          class="new-lane rounded-sm my-2 block" >New Lane</a>
        <div v-if="validate_done()">
          <a 
            :href="'/lanes/'+lane().slug+'/ship'" 
            class="rounded-sm my-2 block ship-lane">Ship to this Lane</a>
        </div>
        <div v-else>
          <button disabled class="rounded-sm my-2 lane-done">Not Ready</button>
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
                    :disabled="!captain.can_set_ply" 
                    :value="captain._id">
                  {{captain._id}}
                </label>
              </li>
            </div>
          </ul>
        </fieldset>

        <h2 class="text-2xl my-2">Harbor</h2>
        <fieldset class="fieldset harbor">
          <legend v-if="current_lane.type">Work: {{lane_type}}</legend>
          <legend v-if="!current_lane.type && choose_type">Choose your type of Work:</legend>
          <div v-if="!current_lane.type">
            <div v-if="choose_type">
              <div 
                v-for="harbor in harbors" 
                :key="harbor._id">
                <button 
                  v-on:click="choose_harbor_type"
                  :id="'button-choose-'+harbor._id" 
                  class="my-2 rounded-sm block choose-harbor-type" 
                  :data-type="harbor._id">{{harbor._id}}</button>
              </div>
            </div>
            <div v-else>
              <button 
                v-on:click.prevent="add_destination"
                class="block rounded-sm my-2 add-harbor">
                Add some Work for this Harbor
              </button>
            </div>
          </div>
          <div v-if="current_lane.type">
            <section id=rendered-input v-html="render_harbor">
            </section>
            <div v-if="validating_fields">
              <button class="" disabled>Working...</button>
            </div>
            <div v-else>
              <button :class="'save p-2 rounded-sm my-2 block'+can_save">Save</button>
            </div>
          </div>
        </fieldset>
        <div v-if="!no_followup">
          <button 
            v-on:click.prevent="add_followup_lane"
            class="add-followup">Add Followup Destination</button>
        </div>
        <div v-if="!no_salvage">
          <button 
            v-on:click.prevent="add_salvage_plan"
            class="warning add-salvage-plan">
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
    
    <shipping-log></shipping-log>
  </div>
</template>

<script>
import { Session } from 'meteor/session';
import { Harbors } from '../../../../api/harbors';
import { get_lane } from '../lib/util';
import { moment } from 'meteor/momentjs:moment';
import './edit_lane.css';
import {
  update_harbor,
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
  harbors,
  current_lane,
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
  plying,
  lane_type,
  not_found,
} from './lib';
import ShippingLog from '../../../components/shipping_log';

const options = { sort: { actual: -1 }, limit: H.AMOUNT_SHOWN };

export default {
  components: { 
    ShippingLog 
  },

  meteor: {
    $subscribe: {
      'Lanes': function () { return [get_lane(this.$route.params.name)] },
      'Users': [],
      'Harbors': function () {
        const type = get_lane(this.$route.params.name)?.type;
        return [Harbors.findOne(type)];
      },
    },
    followup_lane,
    salvage_plan_lane,
    lanes,
    lane_count,
    shipment_history,
    shipping_log_amount_shown () { return H.AMOUNT_SHOWN },
    no_followup,
    no_salvage,
    choose_followup,
    choose_salvage_plan,
    captain_list,
    plying,
    harbors,
    choose_type () { return Session.get('choose_type') },
    current_lane,
    lane_type,
    render_harbor,
    validating_fields () { return Session.get('validating_fields') },
    can_save () { return not_found.get() ? 'disabled' : '' },
  },

  data () {
    return {
      harbor_refresh: 0,
    };
  },

  methods: {
    refresh_harbor () { this.harbor_refresh += 1 },
    validate_done,
    chosen_followup,
    chosen_salvage_plan,
    duration (shipment) {
      return moment
        .duration(shipment?.finished - shipment?.actual)
        .humanize();
    },
    pretty_date (date) { return new Date(date).toLocaleString() },
    update_harbor,
    submit_form,
    change_followup_lane,
    change_salvage_plan,
    change_lane_name,
    lane,
    slug,
    prevent_enter_key (event) {
      if (event.key == 'Enter') event.preventDefault();
    },
    change_captains,
    add_destination () { return Session.set('choose_type', true) },
    back_to_lanes,
    choose_harbor_type,
    add_followup_lane () { return Session.set('choose_followup', true) },
    add_salvage_plan () { return Session.set('choose_salvage_plan', true) },
    new_lane () { Session.set('lane', {})},
    get_lane_name,
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