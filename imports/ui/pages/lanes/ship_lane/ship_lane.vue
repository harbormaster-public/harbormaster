<template>
  <div id="ship-lane-page">
    <div v-if="this.$subReady.Lanes && lane">
      <h1 class="text-5xl my-2"><em>Ship to lane:</em>&nbsp;<strong>{{lane.name}}</strong></h1>
      <h2 class="text-2xl my-2 px-2">Let's review.  Ready to ship?</h2>
      <a :href="`/lanes/${lane.slug}/edit`" class="rounded-sm my-2 block edit-lane">Edit this lane</a>
      <a href="/lanes/new/edit" class="rounded-sm my-2 block new-lane">New Lane</a>
      <a :href="`/lanes/${lane.slug}/charter`" class="rounded-sm my-2 block lane-charter">Lane Charter</a>
    </div>
    <div v-else-if="this.$subReady.Lanes">
      <h1 class="text-5xl my-2">That lane doesn't exist.</h1>
    </div>
    <div v-else>
      <h1 class="text-5xl my-2">Loading...</h1>
    </div>
    <a href="/lanes" class="rounded-sm my-2 block show-lanes">Back to Lanes</a>

    <h3 class="text-xl my-2 px-2"><em>Shipment Active:</em>&nbsp;<strong>{{active}}</strong></h3>
    <div v-if="active">
      <button @click.prevent="reset_shipment" class="rounded-sm my-2 block reset-shipment">Reset Shipment</button>
    </div>
    <div v-else>
      <div v-if="working">
        <button class="rounded-sm my-2 block working" disabled>Working...</button>
      </div>
      <div v-else>
        <button @click.prevent="start_shipment" class="rounded-sm my-2 block start-shipment" :disabled="can_ship">Start Shipment</button>
      </div>
    </div>
    <div v-if="any_active()">
      <button @click.prevent="reset_all_active" class="rounded-sm my-2 block reset-all-active">Reset All Active Shipments</button>
    </div>

    <div v-if="lane">
      <h3 
        id="harbor-title"
        class="text-xl my-2 px-2"
      ><em>Harbor:</em>&nbsp;<strong>{{lane.type}}</strong></h3>

      <figure 
        id="work-preview"
        name="work-preview"
        :class="`my-4 rounded-sm work-preview ${active ? 'active' : ''}`"
      >
        <figcaption class="work-caption">Work Preview</figcaption>
        <section id=work-preview v-html="work_preview"></section>
      </figure>

      <figure 
        id="work-output"
        name="work-output"
        :class="`my-4 rounded-sm work-output exit-code code-${exit_code}`"
      >
        <figcaption class="work-caption">Work Output</figcaption>
        <figcaption :class="`scroll-to-toggle ${
          (scroll_to ? 'scrolling' : '')
        }`">
          Scroll to Bottom?
          <input 
            type="checkbox" 
            name="scroll-to-bottom-checkbox"
            @change="handle_scroll_change"
            :checked="scroll_to"
          >
        </figcaption>
        <section>
            <div v-if="has_work_output() && work_output()">
              <div v-if="work_output().stdout && Object.keys(work_output().stdout).length">
                <div v-for="entry in Object.keys(work_output().stdout)" :key="entry.finished">
                  <em><div class="timestamp">{{entry}}:</div></em>
                  <div class="result">
                    <span v-html="work_output().stdout[entry]"></span>
                  </div>
                </div>
              </div>
              <div v-else-if="work_output().stderr && Object.keys(work_output().stderr).length">
                <div v-for="entry in Object.keys(work_output().stderr)" :key="entry.finished">
                  <em><div class="timestamp">{{entry}}:</div></em>
                  <div class="result">
                    <span v-html="work_output().stderr[entry]"></span>
                  </div>
                </div>
              </div>
              <div v-else-if="work_output().finished">
                {{work_output().finished}}: Shipment reported no output.
              </div>
            </div>
            <div v-else-if="active">
              Please wait...
            </div>
            <div v-else>
              (Nothing yet to report.)
            </div>
        </section>
      </figure>
      <a 
        href="#harbor-title" 
        class="button hollow back-to-top"
      >Back to top</a>
    </div>

    <div v-if="lane && lane.followup">
      <h3 class="text-xl my-2 px-2"><em>Followup: </em>
        <strong>
          <a
            class="followup-link" 
            :href="'/lanes/'+lane.followup.slug+'/ship'">
            {{lane.followup.name}}
          </a>
        </strong>
      </h3>
    </div>

    <div v-if="lane && lane.salvage_plan">
      <h3 class="text-xl my-2 px-2"><em>Salvage Plan: </em>
        <strong>
          <a 
            class="salvage-plan-link"
            :href="'/lanes/'+lane.salvage_plan.slug+'/ship'">
            {{lane.salvage_plan.name}}
          </a>
        </strong>
      </h3>
    </div>
    
    <shipping-log></shipping-log>
  </div>
</template>

<script>
import scroll_to from 'scroll-to-element';
import ShippingLog from '../../../components/shipping_log';

import {
  lane,
  work_preview,
  active,
  created,
  exit_code,
  any_active,
  reset_all_active,
  reset_shipment,
  work_output,
  duration,
  pretty_date,
  start_shipment,
  has_work_output,
} from './lib';
import './ship_lane.css';

export default {
  meteor: {
    $subscribe: {
      'Lanes': function () { return [this.$route.params.slug] },
    },
    lane,
    work_preview,
    active,
    exit_code,
  },
  created,

  data () {
    return {
      scroll_to: false,
    }
  },

  methods: {
    any_active,
    reset_all_active,
    reset_shipment,
    work_output,
    duration,
    pretty_date,
    start_shipment,
    has_work_output,
    handle_scroll_change: function (evt) {
      this.$data.scroll_to = evt.target.checked;
    }
  },

  updated () {
    console.log(`Scrolling to Bottom?: ${this.$data.scroll_to}`);
    if (this.$data.scroll_to) scroll_to('.work-output', {
      align: 'bottom'
    });
  },

  components: {
    ShippingLog
  }
}
</script>
