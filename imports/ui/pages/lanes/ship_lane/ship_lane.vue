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

    <h2>Shipping Log: Last {{shipping_log_amount_shown}} shipments</h2>
    <ul>
      <div v-if="!this.$subReady.Shipments">
        <li>Loading...</li>
      </div>
      <div v-else>
        <div v-if="has_work_output()">
          <div v-for="item in shipment_history()" :key="item._id">
            <li>
              <a :href="'/lanes/'+lane.slug+'/ship/'+item.start" :class="'button tiny hollow'+(active ?' active':'')+' exit-code code-'+item.exit_code">
                Shipped {{pretty_date(item.actual)}}; finished {{pretty_date(item.finished)}}; {{duration(item)}} duration
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
import { Session } from 'meteor/session';
import { ReactiveVar } from 'meteor/reactive-var';
import { Lanes } from '../../../../api/lanes';
import { Harbors } from '../../../../api/harbors';
import { Shipments } from '../../../../api/shipments';
import { count, history, get_lane } from '../lib/util';
import { moment } from 'meteor/momentjs:moment';
import router from '../../../../startup/client/routes';

const options = { sort: { actual: -1 }, limit: H.AMOUNT_SHOWN };
const shipment_count = new ReactiveVar();
const not_found = new ReactiveVar(false);
//TODO: Holdover from Blaze.  Componentize
const not_found_text = `
  <p><strong>The harbor you're viewing hasn't been installed for this
    Harbormaster instance.</strong></p>
  <p>Shipping to it has been disabled.  To enable it, the harbor needs to
    be installed in the Harbormaster harbor directory
    (<code>~/.harbormaster/harbors</code> by default).</p>
`;

const lane = function () {
  let lane = get_lane(this.$route.params.name) || false;
  return lane;
};

const active = function () {
  let lane = get_lane(this.$route.params.name) || {};
  let date = this.$route.params.date;
  let total = Shipments.find({
    active: true, 
    lane: lane._id,
  }).fetch();

  if (total.length == 1 && total[0].start == date) return true;
  else return false;
};

const exit_code = function () {
  let lane = get_lane(this.$route.params.name) || {};
  let date = this.$route.params.date;
  
  let shipment = lane ?
    Shipments.findOne({ start: date, lane: lane._id }) :
    false
  ;
  let exit_code = shipment ? shipment.exit_code : '';

  return exit_code;
};

const work_preview = function () {
  let lane = get_lane(this.$route.params.name);
  let harbor = Harbors.findOne(lane?.type);
  const harbor_not_ready_text = `
    <h4>This Harbor is not ready, or otherwise not fully configured.</h4>
    <p>Please "<a href="/lanes/${lane?.name}/edit">Edit this lane</a>" and complete its configuration.</p>
  `;

  if (not_found.get()) return not_found_text;

  if (lane && harbor && harbor.lanes) {
    let manifest = harbor.lanes[lane._id] ?
      harbor.lanes[lane._id].manifest :
      false
    ;

    Meteor.call(
      'Harbors#render_work_preview',
      lane,
      manifest,
      function (err_preview, res_lane) {
        if (err_preview) throw err;
        if (res_lane == 404) return not_found.set(true);

        return H.call('Lanes#upsert', lane, (err_update, res_success) => {
          if (err_update) throw err_update;
          console.log(`Lane "${lane.name}" updated: ${res_success}`);
          return Session.set('lane', res_lane);
        });
      }
    );

    return lane.rendered_work_preview;
  }

  return harbor_not_ready_text;
};

const has_work_output = function () {
  let lane = get_lane(this.$route.params.name);
  let date = this.$route.params.date;
  let shipment = Shipments.findOne({ lane: lane?._id, start: date });
  let any_shipment = Shipments.findOne({ lane: lane?._id });

  if (
    shipment && (
      shipment.stdout.length || 
      shipment.stderr.length || 
      shipment.exit_code == 0
      ) ||
    any_shipment
  ) {
    return true;
  }

  return false;
};

const work_output = function () {
  let lane = get_lane(this.$route.params.name);
  let date = this.$route.params.date;
  let shipment = Shipments.findOne({ 
    lane: lane?._id, 
    start: date,
  });

  return shipment;
};

const shipment_history = function () {
  let shipments = history(get_lane(this.$route.params.name), H.AMOUNT_SHOWN);
  return shipments;
};

const pretty_date = function (date) {
  if (date) return new Date(date).toLocaleString();

  return 'never';
};

const duration = function (shipment) {
  return moment.duration(shipment.finished - shipment.actual).humanize();
};

const followup_name = function (lane) {
  let followup = Lanes.findOne(lane.followup);

  return followup ? followup.name : false;
};

const salvage_plan_name = function (lane) {
  let salvage_plan = Lanes.findOne(lane.salvage_plan);

  return salvage_plan ? salvage_plan.name : false;
};

const any_active = function () {
  let lane = get_lane(this.$route.params.name) || false;
  let shipments = Shipments.find({ lane: lane._id, active: true });

  if (shipments.count()) return true;
  return false;
};

reset_shipment = function () {
  const { name, date } = this.$route.params;
  H.call('Lanes#reset_shipment', name, date, function (err, res) {
    if (err) throw err;
    console.log('Reset shipment response:', res);
  });
};

const reset_all_active = function () {
  const {name} = this.$route.params;
  
  H.call('Lanes#reset_all_active_shipments', name, function (err, res) {
    if (err) throw err;
    console.log('Reset all active shipments response:', res);
  });
};

export default {
  meteor: {
    $subscribe: {
      'Shipments': {
        handler () {
          const name = this.$route.params.name;
          const lane = get_lane(name);

          return [lane, options];
        },
      },
      'Lanes': function () { return [get_lane(this.$route.params.name)] },
    },

    lane,
    work_preview,
    active,
    exit_code,
  },

  methods: {
    shipment_history,
    any_active,
    reset_all_active,
    reset_shipment,
    salvage_plan_name,
    followup_name,
    has_work_output,
    work_output,
    duration,
    pretty_date,
    start_shipment () {
      let { $router } = this;
      let working_lanes = Session.get('working_lanes') || {};
      let lane = get_lane(this.$route.params.name);
      let harbor = Harbors.findOne(lane.type);
      let manifest = harbor.lanes[lane._id].manifest;
      let shipment_start_date = H.start_date();
      let shipment = Shipments.findOne({
        start: shipment_start_date,
        lane: lane._id,
      });

      working_lanes[lane._id] = true;
      Session.set('working_lanes', working_lanes);
      if (! shipment || ! shipment.active) {
        console.log(`Starting shipment for lane: ${lane.name}`);
        Meteor.call(
          'Lanes#start_shipment',
          lane._id,
          manifest,
          shipment_start_date,
          function (err, res) {
            if (err) throw err;

            working_lanes = Session.get('working_lanes');
            working_lanes[lane._id] = false;
            Session.set('working_lanes', working_lanes);
            console.log('Shipment started for lane:', lane.name);
            $router.push('/lanes/'+lane.slug+'/ship/'+shipment_start_date);

            return res;
          }
        );
      }

      return lane;
    },
    
    
  },

  computed: {
    shipping_log_amount_shown () {
      return H.AMOUNT_SHOWN;
    },
  },
}
</script>

<style>
pre { 
  white-space: inherit;
  overflow-x: auto;
}

.exit-code {
  background: rgba(255, 150, 0, 0.75);
}

.exit-code.code- {
  background: none;
}

.exit-code.code-0 {
  background: rgba(0, 255, 0, 0.25);
  border-color: rgba(0, 100, 0, 0.25);
}

.exit-code.code-1 {
  background-color: #ec5840;
  color: #fff;
}

.prompt {
  color: #666;
  padding: 0 10px 0 0;
  display: inline-block;
}

.results {
  margin: 0 10px;
}

figure {
  border: 1px solid #ccc;
  padding: 20px 10px;
}

figcaption {
  color: #000;
}

.pre {
  white-space: pre;
  font: bold 18px monospace;
  color: #ccc;
}

.code- .pre, .code-0 .pre {
  color: #777;
}

.work-caption {
  position: absolute;
  margin-top: -32.5px;
  background: #fff;
  padding: 0 5px;
}

p {
  margin: 0;
}

.work-preview.active {
  background: #eee;
}


</style>