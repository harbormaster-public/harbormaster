<template>
  <div>
    <h1>Lanes</h1>
    <router-link 
      to="/lanes/new/edit" 
      class="hollow button" 
      id="new-lane"
      @click="set_new_lane"
      >New Lane</router-link>
    <table class="lanes-table">
      <thead>
        <tr>
          <th @click="sort_by_header" :class="'name-header name-column '+active('name')" data-value=name>Name</th>
          <th @click="sort_by_header" :class="'captains-column captains-header '+active('captains')" data-value=captains>Captains</th>
          <th @click="sort_by_header" :class="'type-header type-column '+active('type')" data-value=type>Type</th>
          <th @click="sort_by_header" :class="'last-shipped-header last-shipped-column '+active('shipped')" data-value=shipped>Last Shipped</th>
          <th @click="sort_by_header" :class="'total-shipments-column total-shipments-header '+active('shipments')" data-value=shipments>Total Completed Shipments</th>
          <th @click="sort_by_header" :class="'salvage-runs-column total-salvage-runs-header '+active('salvage-runs')" data-value=salvage-runs>Total Salvage Runs</th>
          <th @click="sort_by_header" class="current-state-header current-state-column" disabled>Current State</th>
          <th @click="sort_by_header" class="followup-header followup-column" disabled>Followup</th>
          <th @click="sort_by_header" class="salvage-plan-header salvage-plan-column" disabled>Salvage Plan</th>
        </tr>
      </thead>
      <tbody>

        <tr v-if="empty" class="empty">
          <td colspan=9>No lanes found.  <router-link to="/lanes/new/edit">Create the first.</router-link></td>
        </tr>

        <tr 
          v-else-if="ready()" 
          v-for="lane in lanes" 
          :key="lane.id"
        >
          <td class="name-column">
              <span v-if="can_ply(lane)" class="admin collapsed">
                <router-link :to="'/lanes/'+lane.slug+'/charter'" class="button info tiny charter">Charter</router-link>
                <router-link :to="'/lanes/'+lane.slug+'/ship'" class="button tiny success ship-lane">Ship</router-link>
                <router-link :to="'/lanes/'+lane.slug+'/edit'" class="button tiny secondary edit-lane">Edit</router-link>
                <button @click="delete_lane($event, lane)" class="button tiny warning delete-lane">Delete</button>
              </span>
            <span class="name">{{lane.name}}</span>
          </td>
          <td class="captains-column">{{total_captains(lane)}}</td>
          <td class="type-column">{{lane.type}}</td>
          <td class="last-shipped-column" width=125><router-link :to="'/lanes/'+lane.slug+'/ship/'+latest_shipment(lane)">{{last_shipped(lane)}}</router-link></td>
          <td class="total-shipments-column">{{total_shipments(lane)}}</td>
          <td class="salvage-runs-column">{{total_salvage_runs(lane)}}</td>
          <td :class="'current-state-column '+current_state(lane)">{{current_state(lane)}}</td>
          <td class="followup-column">{{followup_name(lane)}}</td>
          <td class="salvage-plan-column">{{salvage_plan_name(lane)}}</td>
        </tr>
        <tr v-else class="loading-text">
        <!-- <tr v-else-if="loading_lanes()" class="loading-text"> -->
          <td colspan=9>Loading...</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { Lanes } from '../../../api/lanes';
import {
  loading_lanes,
  sort_by_header,
  delete_lane,
  ready,
  active,
  can_ply,
  current_state,
  followup_name,
  last_shipped,
  latest_shipment,
  salvage_plan_name,
  total_captains,
  total_shipments,
  total_salvage_runs,
  total_stops,
  lane_ids,
  empty,
  lanes,
} from './lib';
import './lanes.css';

let options = {
  sort: { actual: -1 },
};

export default {
  meteor: {
    $subscribe: {
      'ShipmentCount': [],
      'SalvageCount': [],
      'LatestShipment': [],
      'Shipments': [lane_ids, options],
    },
    empty,
    lanes,
  },

  methods: {
    loading_lanes,
    sort_by_header,
    delete_lane,
    set_new_lane () { Session.set('lane', null) },
    ready,
    active,
    can_ply,
    current_state,
    followup_name,
    last_shipped,
    latest_shipment,
    salvage_plan_name,
    total_captains,
    total_shipments,
    total_salvage_runs,
    total_stops,
  },

  created () {
    Lanes.find().forEach(lane => {
      let lane_ids_list = lane_ids.get();
      lane_ids_list.push(lane._id);
      lane_ids.set(lane_ids_list);
    });
  },

  mounted () {
    Meteor.call('Lanes#get_total', (err, res) => {
      if (err) throw err;

      Session.set('total_lanes', res);
      Session.set('lane', null);
      Session.set('validating_fields', false);
      Session.set('choose_type', false);
    });
  },
}
</script>