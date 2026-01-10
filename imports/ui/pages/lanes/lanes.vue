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
              class="lane-options">+</button>
            <span v-if="can_ply(lane)" class="admin">
              <router-link :to="`/lanes/${lane.slug}/charter`" class="charter">
                <span class="admin-label">Charter</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke-width="1.5" 
                  stroke="currentColor" 
                  class="size-5 charter-icon">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke="currentColor"
                    d="M6.5 18V6M6.5 18L18 8M6.5 18H18"
                  />
                  <circle cx="6.5" cy="6" r="2.25" stroke-width="1.5" stroke="currentColor" />
                  <circle cx="18" cy="8" r="2.25" stroke-width="1.5" stroke="currentColor" />
                  <circle cx="18" cy="18" r="2.25" stroke-width="1.5" stroke="currentColor" />
                  <circle cx="6.5" cy="18" r="2.25" stroke-width="1.5" stroke="currentColor" />
                </svg>
              </router-link>
              <router-link :to="`/lanes/${lane.slug}/ship`" class="ship-lane">
                <span class="admin-label">Ship</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke-width="1.5" 
                  stroke="currentColor" 
                  class="size-5 ship-icon">
                    <path 
                      stroke-linecap="round" 
                      stroke-linejoin="round" 
                      :d="ICON_PATHS.ship" 
                      />
                </svg>
              </router-link>
              <router-link :to="`/lanes/${lane.slug}/edit`" class="edit-lane">
                <span class="admin-label">Edit</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke-width="1.5" 
                  stroke="currentColor" 
                  class="size-5 edit-icon">
                    <path 
                    stroke-linecap="round" 
                    stroke-linejoin="round" 
                    :d="ICON_PATHS.edit" 
                    />
                </svg>
              </router-link>
              <button @click="delete_lane($event, lane)" class="delete-lane">
                <span class="admin-label">Delete</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke-width="1.5" 
                  stroke="currentColor" 
                  class="size-5 delete-icon">
                  <path 
                    stroke-linecap="round" 
                    stroke-linejoin="round" 
                    :d="ICON_PATHS.delete" 
                  />
                </svg>
              </button>
              <button @click="duplicate_lane($event, lane)" class="duplicate-lane">
                <span class="admin-label">Duplicate</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke-width="1.5" 
                  stroke="currentColor" 
                  class="size-5 duplicate-icon">
                  <path 
                    stroke-linecap="round" 
                    stroke-linejoin="round" 
                    :d="ICON_PATHS.duplicate" 
                  />
                </svg>
              </button>
              <button
                class="ship-now-lane quick-button"
                title="Start a Shipment to this Lane"
                :disabled="ship_now_working(lane)"
                @click="start_shipment_now($event, lane)"
              >
                <span class="admin-label">Go Now</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke-width="1.5" 
                  stroke="currentColor" 
                  class="size-5 go-now-icon">
                  <path 
                    stroke-linecap="round" 
                    stroke-linejoin="round" 
                    :d="ICON_PATHS.goNow" 
                  />
                </svg>
              </button>
              <button
                class="reset-lane quick-button"
                title="Reset the latest shipment for this lane"
                 :disabled="reset_working(lane) || !lane?.last_shipment?.active || !latest_shipment(lane)"
                @click="reset_shipment_now($event, lane)"
              >
                <span class="admin-label">Reset Last</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke-width="1.5" 
                  stroke="currentColor" 
                  class="size-6 reset-last-icon">
                  <path 
                    stroke-linecap="round" 
                    stroke-linejoin="round" 
                    :d="ICON_PATHS.resetLast" 
                  />
                </svg>
              </button>
              <button
                class="reset-all-lane quick-button"
                title="Reset all active shipments for this lane"
                 :disabled="reset_all_working(lane) || !lane?.last_shipment?.active"
                @click="reset_all_active_now($event, lane)"
              >
                <span class="admin-label">Reset All</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke-width="1.5" 
                  stroke="currentColor" 
                  class="size-6 reset-all-icon">
                  <path 
                    stroke-linecap="round" 
                    stroke-linejoin="round" 
                    :d="ICON_PATHS.resetAll" 
                  />
                </svg>
              </button>
            </span>
            <span class="name">{{lane.name}}</span>
          </td>
          <td class="captains-column">{{total_captains(lane)}}</td>
          <td class="type-column">{{lane.type}}</td>
          <td class="last-shipped-column" width=125>
            <router-link v-if="latest_shipment(lane)"
              :to="`/lanes/${lane.slug}/ship/${latest_shipment(lane)}`">{{last_shipped(lane)}}</router-link>
            <span v-else>N/A</span>
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
  ship_now_working,
  reset_working,
  reset_all_working,
  lane_ids,
  empty,
  lanes,
  start_shipment_now,
  reset_shipment_now,
  reset_all_active_now,
  handle_import_yaml,
  handle_download_yaml,
} from './lib';
import './lanes.css';

const ICON_PATHS = Object.freeze({
  ship: [
    'M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8',
    'm5.84-2.58a14.98 14.98 0 0 0 6.16-12.12',
    'A14.98 14.98 0 0 0 9.631 8.41',
    'm5.96 5.96a14.926 14.926 0 0 1-5.841 2.58',
    'm-.119-8.54a6 6 0 0 0-7.381 5.84h4.8',
    'm2.581-5.84a14.927 14.927 0 0 0-2.58 5.84',
    'm2.699 2.7c-.103.021-.207.041-.311.06',
    'a15.09 15.09 0 0 1-2.448-2.448',
    'a14.9 14.9 0 0 1 .06-.312',
    'm-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306',
    'a4.493 4.493 0 0 0 4.306-1.758',
    'M16.5 9a1.5 1.5 0 1 1-3 0',
    '1.5 1.5 0 0 1 3 0Z',
  ].join(' '),
  edit: [
    'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652',
    'L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13',
    'L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897',
    'l8.932-8.931Z',
    'm0 0L19.5 7.125',
    'M18 14v4.75A2.25 2.25 0 0 1 15.75 21',
    'H5.25A2.25 2.25 0 0 1 3 18.75V8.25',
    'A2.25 2.25 0 0 1 5.25 6H10',
  ].join(' '),
  delete: [
    'm14.74 9-.346 9',
    'm-4.788 0L9.26 9',
    'm9.968-3.21c.342.052.682.107 1.022.166',
    'm-1.022-.165L18.16 19.673',
    'a2.25 2.25 0 0 1-2.244 2.077H8.084',
    'a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79',
    'm14.456 0a48.108 48.108 0 0 0-3.478-.397',
    'm-12 .562c.34-.059.68-.114 1.022-.165',
    'm0 0a48.11 48.11 0 0 1 3.478-.397',
    'm7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201',
    'a51.964 51.964 0 0 0-3.32 0',
    'c-1.18.037-2.09 1.022-2.09 2.201v.916',
    'm7.5 0a48.667 48.667 0 0 0-7.5 0',
  ].join(' '),
  duplicate: [
    'M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6',
    'A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5',
    'h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18',
    'A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18',
    'v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6',
  ].join(' '),
  goNow: [
    'M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6',
    'a2.25 2.25 0 0 1 2.25 2.25v13.5',
    'A2.25 2.25 0 0 1 16.5 21h-6',
    'a2.25 2.25 0 0 1-2.25-2.25V15',
    'M12 9l3 3m0 0-3 3m3-3H2.25',
  ].join(' '),
  resetLast: [
    'M12 9v3.75',
    'm-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374',
    'h14.71c1.73 0 2.813-1.874 1.948-3.374',
    'L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0',
    'L2.697 16.126Z',
    'M12 15.75h.007v.008H12v-.008Z',
  ].join(' '),
  resetAll: [
    'M12 9v3.75',
    'm9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    'm-9 3.75h.008v.008H12v-.008Z',
  ].join(' '),
});

let options = {
  sort: { actual: -1 },
};

export default {
  data() {
    return { ICON_PATHS };
  },
  meteor: {
    $subscribe: {
      Lanes: ['/lanes'],
      Harbors: ['/lanes'],
    },
    empty,
    lanes,
  },

  methods: {
    current_state,
    handle_opts_click (event) {
      const row = event.target?.closest?.('tr');
      if (event.target.getAttribute('class').match(/active/)) {
        event.target.nextElementSibling.setAttribute(
          'class',
          event
            .target
            .nextElementSibling
            .getAttribute('class')
            .replace(' active', ''),
        );
        row?.classList?.remove('admin-active');
        event.target.innerHTML = '+';
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
      row?.classList?.add('admin-active');
      event.target.innerHTML = '-';
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
    ship_now_working,
    start_shipment_now,
    reset_working,
    reset_all_working,
    reset_shipment_now,
    reset_all_active_now,
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