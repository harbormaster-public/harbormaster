<template>
  <div>
    <div v-if="this.$subReady.Lanes && lane">
      <h1><em>Ship to lane:</em><br><strong>{{lane.name}}</strong></h1>
      <h2>Let's review.  Ready to ship?</h2>
      <a :href="'/lanes/'+lane.slug+'/edit'" class="button secondary hollow edit-lane">Edit this lane</a>
      <a href="/lanes/new/edit" class="hollow button new-lane">New Lane</a>
      <a :href="'/lanes/'+lane.slug+'/charter'" class="button success hollow lane-charter">Lane Charter</a>
    </div>
    <div v-else>
      <h1>That lane doesn't exist.</h1>
    </div>
    <a href="/lanes" class="button hollow show-lanes">Back to Lanes</a>

    <div>Shipment Active: {{active}}</div>
    <div v-if="active">
      <button @click.prevent="reset_shipment" class="button warning reset-shipment">Reset Shipment</button>
    </div>
    <div v-else>
      <div v-if="working">
        <button class="button secondary disabled" disabled>Working...</button>
      </div>
      <div v-else>
        <button @click.prevent="start_shipment" class="button success start-shipment" :disabled="can_ship">Start Shipment</button>
      </div>
    </div>
    <div v-if="any_active()">
      <button @click.prevent="reset_all_active" class="button alert reset-all-active">Reset All Active Shipments</button>
    </div>

    <div v-if="lane">
      <h3>Harbor: {{lane.type}}</h3>
      <figure :class="'work-preview exit-code code-'+exit_code+' '+(active?'active':'')">
        <figcaption class="work-caption">Work Preview</figcaption>
        <section id=work-preview v-html="work_preview"></section>
      </figure>

      <figure class="work-output">
        <figcaption class="work-caption">Work Output</figcaption>
        <section>
          <pre>
            <div v-if="active">
              Please wait...
            </div>
            <div v-if="has_work_output() && work_output()">
              <div v-if="work_output().stdout && work_output().stdout.length">
                <div v-for="entry in work_output().stdout" :key="entry.finished">
                  <span>{{entry.finished}}: </span>
                  <span>{{entry.result}}</span>
                  <br>
                </div>
              </div><div v-else-if="work_output().stderr && work_output().stderr.length">
                <div v-for="entry in work_output().stderr" :key="entry.finished">
                  <span>{{entry.finished}}: </span>
                  <span>{{entry.result}}</span>
                  <br>
                </div>
              </div><div v-else-if="work_output().finished">
                {{work_output().finished}}: Shipment reported no output.
              </div>
            </div>
          </pre>
        </section>
      </figure>
    </div>

    <div v-if="lane && lane.followup">
      <h4><a class="button" :href="'/lanes/'+followup_name(lane)+'/ship'">Followup: {{followup_name(lane)}}</a></h4>
    </div>

    <div v-if="lane && lane.salvage_plan">
      <h4><a class="button warning" :href="'/lanes/'+salvage_plan_name(lane)+'/ship'">Salvage Plan: {{salvage_plan_name(lane)}}</a></h4>
    </div>
    
    <shipping-log></shipping-log>
  </div>
</template>

<script>
import ShippingLog from '../../../components/shipping_log';
import { get_lane } from '../lib/util';
import {
  lane,
  work_preview,
  active,
  exit_code,
  any_active,
  reset_all_active,
  reset_shipment,
  salvage_plan_name,
  followup_name,
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
      'Lanes': function () { return [get_lane(this.$route.params.name)] },
    },
    lane,
    work_preview,
    active,
    exit_code,
  },

  methods: {
    any_active,
    reset_all_active,
    reset_shipment,
    salvage_plan_name,
    followup_name,
    work_output,
    duration,
    pretty_date,
    start_shipment,
    has_work_output,
  },

  components: {
    ShippingLog
  }
}
</script>