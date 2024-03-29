<template>
  <div v-if="$subReady.Lanes && $subReady.Users && $subReady.Harbors" id=edit-lane-page>
    <h1 class="text-5xl my-2">Edit Lane</h1>
    <div v-if="plying">
      <form v-on:submit.prevent="submit_form" :key="harbor_refresh">
        <pre class="py-2">
          <label>Name:&nbsp;
            <input
              @change.prevent="change_lane_name"
              @keypress="prevent_enter_key"
              :value="get_lane_name"
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
              :value="slug(this.$route.params.slug, true)"
              class="slug"
            >
          </label>
        </pre>
        <hr>
        <button v-on:click.prevent="back_to_lanes" class="rounded-sm my-2 block back-to-lanes">Back to Lanes</button>
        <a v-on:click="new_lane" href="/lanes/new/edit" class="new-lane rounded-sm my-2 block">New Lane</a>
        <div v-if="validate_done()">
          <a :href="'/lanes/'+lane().slug+'/ship'" class="rounded-sm my-2 block ship-lane">Ship to this Lane</a>
        </div>
        <div v-else>
          <button disabled class="rounded-sm lane-done">Not Ready</button>
        </div>
        <fieldset v-on:change.prevent="change_captains" class="fieldset captains">
          <legend>Captain(s)</legend>
          <ul>
            <div v-for="captain in captain_list" :key="captain._id">
              <li>
                <label>
                  <input type=checkbox :checked="captain.can_ply" :disabled="!captain.can_set_ply" :value="captain._id">
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
              <div v-for="harbor in harbors" :key="harbor._id">
                <button v-on:click="choose_harbor_type" :id="'button-choose-'+harbor._id"
                  class="my-2 rounded-sm block choose-harbor-type" :data-type="harbor._id">{{harbor._id}}</button>
              </div>
            </div>
            <div v-else>
              <button v-on:click.prevent="add_destination" class="block rounded-sm my-2 add-harbor">
                Add some Work for this Harbor
              </button>
            </div>
          </div>
          <div v-if="current_lane.type">
            <section id=rendered-input v-html="render_harbor">
            </section>
            <div v-if="validating_fields">
              <h3 class="text-xl my-2 text-center">Working...</h3>
            </div>
            <div v-else>
              <button id=harbor-save-button :class="'save p-2 rounded-sm my-2 block'+can_save">Save</button>
            </div>
          </div>
        </fieldset>
        <div v-if="current_lane.type && !validating_fields">
          <button id="duplicate-lane-button" class="p-2 rounded-sm my-2 block can-duplicate-lane"
            v-on:click.prevent="duplicate_lane">Duplicate This Lane</button>
        </div>

      </form>
    </div>
    <div v-else>
      <h2>You do not have permission to edit this lane.</h2>
    </div>

    <choose-downstreams
      :no_followup="no_followup"
      :add_followup_lane="add_followup_lane"
      :choose_followup="choose_followup"
      :change_followup_lane="change_followup_lane"
      :followup_lane="followup_lane"
      :lanes="lanes"
      :chosen_followup="chosen_followup"
      :no_salvage="no_salvage"
      :add_salvage_plan="add_salvage_plan"
      :choose_salvage_plan="choose_salvage_plan"
      :change_salvage_plan="change_salvage_plan"
      :salvage_plan_lane="salvage_plan_lane"
      :chosen_salvage_plan="chosen_salvage_plan"
    ></choose-downstreams>

    <shipping-log></shipping-log>
  </div>
  <div v-else>
    <h1 class="text-5xl my-2">Loading...</h1>
  </div>
</template>

<script>
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
import ChooseDownstreams from '../../../components/choose_downstreams';

const options = { sort: { actual: -1 }, limit: H.AMOUNT_SHOWN };

export default {
  components: {
    ShippingLog,
    ChooseDownstreams,
  },

  meteor: {
    $subscribe: {
      Lanes: function () { return ['/edit', this.$route.params.slug]; },
      Users: ['/edit'],
      Harbors: ['/edit'],
    },
    followup_lane,
    salvage_plan_lane,
    lanes,
    lane_count,
    shipment_history,
    shipping_log_amount_shown() { return H.AMOUNT_SHOWN },
    no_followup,
    no_salvage,
    choose_followup,
    choose_salvage_plan,
    captain_list,
    plying,
    harbors,
    choose_type() { return H.Session.get('choose_type') },
    current_lane,
    lane_type,
    render_harbor,
    validating_fields() { return H.Session.get('validating_fields') },
    can_save() { return not_found.get() ? 'disabled' : '' },
    get_lane_name,
  },

  data() {
    return {
      harbor_refresh: 0,
    };
  },

  methods: {
    validate_done,
    chosen_followup,
    chosen_salvage_plan,
    duration(shipment) {
      return moment
        .duration(shipment?.finished - shipment?.actual)
        .humanize();
    },
    pretty_date(date) { return new Date(date).toLocaleString() },
    update_harbor,
    submit_form,
    change_followup_lane,
    change_salvage_plan,
    change_lane_name,
    lane,
    slug,
    prevent_enter_key(event) {
      if (event.key == 'Enter') event.preventDefault();
    },
    change_captains,
    add_destination() { return H.Session.set('choose_type', true) },
    back_to_lanes,
    choose_harbor_type,
    add_followup_lane() { return H.Session.set('choose_followup', true) },
    add_salvage_plan() { return H.Session.set('choose_salvage_plan', true) },
    new_lane() { H.Session.set('lane', {}) },
    duplicate_lane() {
      const lane = get_lane(this.$route.params.slug);
      const warn = `Duplicate this lane, and then edit the new lane?`
      const router = this.$router;
      if (!confirm(warn)) return;
      H.call('Lanes#duplicate', lane, (err, res) => {
        if (err) alert(err);
        router.push(res);
      });
    },
  },
}
</script>