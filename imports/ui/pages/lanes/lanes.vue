<template>
  <div id=lanes-page>
    <h1 class="text-5xl my-2">Lanes</h1>
    <button 
      v-on:click="handle_import_yaml"
      id="import-yaml" 
      class="p-2 border-2 rounded-sm my-2">Import from YAML</button>
    <router-link to="/lanes/new/edit" class="p-2 border-2 rounded-sm my-2 block" id="new-lane" @click="set_new_lane">New
      Lane</router-link>
    <table class="lanes-table table-auto my-2">
      <thead>
        <tr>
          <th @click="sort_by_header" :class="'name-header name-column '+active('name')" data-value=name>Name</th>
          <th @click="sort_by_header" :class="'captains-column captains-header '+active('captains')" data-value=captains>
            Captains</th>
          <th @click="sort_by_header" :class="'type-header type-column '+active('type')" data-value=type>Type</th>
          <th @click="sort_by_header" :class="'last-shipped-header last-shipped-column '+active('shipped')"
            data-value=shipped>Last Shipped</th>
          <th @click="sort_by_header" :class="'total-shipments-column total-shipments-header '+active('shipments')"
            data-value=shipments>Total Shipments</th>
          <th @click="sort_by_header" :class="'salvage-runs-column total-salvage-runs-header '+active('salvage-runs')"
            data-value=salvage-runs>Total Salvage Runs</th>
          <th @click="sort_by_header" class="current-state-header current-state-column" data-value=state>Current State
          </th>
          <th @click="sort_by_header" class="followup-header followup-column" data-value=followup>Followup</th>
          <th @click="sort_by_header" class="salvage-plan-header salvage-plan-column" data-value=salvage>Salvage Plan</th>
        </tr>
      </thead>
      <tbody v-if="empty" class="empty">
        <tr>
          <td colspan=9>No lanes found. <router-link to="/lanes/new/edit">Create the first.</router-link></td>
        </tr>
      </tbody>
      <tbody v-else-if="ready()">
        <tr v-for="lane in lanes" :key="lane._id">
          <td class="name-column">
            <button
              v-if="can_ply(lane)"
              @click="handle_opts_click"
              class="lane-options">⋮</button>
            <span v-if="can_ply(lane)" class="admin">
              <router-link :to="`/lanes/${lane.slug}/charter`" class="charter">Charter</router-link>
              <router-link :to="`/lanes/${lane.slug}/ship`" class="ship-lane">Ship</router-link>
              <router-link :to="`/lanes/${lane.slug}/edit`" class="edit-lane">Edit</router-link>
              <button @click="delete_lane($event, lane)" class="delete-lane">Delete</button>
              <button @click="duplicate_lane($event, lane)" class="duplicate-lane">Duplicate</button>
            </span>
            <span class="name">{{lane.name}}</span>
          </td>
          <td class="captains-column">{{total_captains(lane)}}</td>
          <td class="type-column">{{lane.type}}</td>
          <td class="last-shipped-column" width=125>
            <router-link v-if="latest_shipment(lane)"
              :to="`/lanes/${lane.slug}/ship/${latest_shipment(lane)}`">{{last_shipped(lane)}}</router-link>
          </td>
          <td class="total-shipments-column">{{lane.shipment_count || '0'}}</td>
          <td class="salvage-runs-column">{{lane.salvage_runs || '0'}}</td>
          <td :class="`current-state-column ${current_state(lane)}`">{{current_state(lane)}}</td>
          <td class="followup-column">{{followup_name(lane)}}</td>
          <td class="salvage-plan-column">{{salvage_plan_name(lane)}}</td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr class="loading-text">
          <td colspan=9>Loading...</td>
        </tr>
      </tbody>
    </table>
    <button 
      v-on:click="handle_download_yaml"
      id="download-yaml" 
      class="p-2 border-2 rounded-sm my-2">Download as YAML</button>
  </div>
</template>

<script>
import { Lanes } from '../../../api/lanes';
import {
  loading_lanes,
  sort_by_header,
  delete_lane,
  duplicate_lane,
  ready,
  active,
  can_ply,
  current_state,
  followup_name,
  last_shipped,
  latest_shipment,
  salvage_plan_name,
  total_captains,
  lane_ids,
  empty,
  lanes,
  handle_import_yaml,
  handle_download_yaml,
} from './lib';
import './lanes.css';

let options = {
  sort: { actual: -1 },
};

export default {
  meteor: {
    $subscribe: {
      Lanes: ['/lanes'],
      Harbors: ['/lanes'],
    },
    lanes () {
      return Lanes.find({});
    },
    empty,
    lanes,
  },

  methods: {
    current_state,
    handle_opts_click (event) {
      if (event.target.getAttribute('class').match(/active/)) {
        event.target.nextElementSibling.setAttribute(
          'class',
          event
            .target
            .nextElementSibling
            .getAttribute('class')
            .replace(' active', ''),
        );
        event.target.innerHTML = '⋮';
        return event.target.setAttribute(
          'class',
          event.target.getAttribute('class').replace(' active', ''),
        );
      }

      event.target.nextElementSibling.setAttribute(
        'class',
        event
          .target
          .nextElementSibling
          .getAttribute('class') + ' active',
      );
      event.target.innerHTML = '🖈';
      return event.target.setAttribute(
        'class',
        event.target.getAttribute('class') + ' active',
      );
    },
    set_new_lane () { H.Session.set('lane', null) },
    loading_lanes,
    sort_by_header,
    delete_lane,
    duplicate_lane,
    ready,
    active,
    can_ply,
    followup_name,
    last_shipped,
    latest_shipment,
    salvage_plan_name,
    total_captains,
    handle_import_yaml,
    handle_download_yaml,
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

      H.Session.set('total_lanes', res);
      H.Session.set('lane', null);
      H.Session.set('validating_fields', false);
      H.Session.set('choose_type', false);
    });
  },
}
</script>