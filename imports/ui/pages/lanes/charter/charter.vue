<template>
  <div id=charter-page>
    <h1 class="text-5xl my-2">Lane Charter</h1>
    <button 
      v-on:click="handle_download_yaml"
      id="download-yaml" 
      class="p-2 border-2 rounded-sm my-2">Download as YAML</button>
    <figure v-if="this.$subReady.Lanes && lane.name" class="charter">
      <figcaption class="text-2xl">
        Starting with lane:
        <a class="root" :href="'/lanes/' + lane.slug + '/ship'">{{
          lane.name
        }}</a>
      </figcaption>
      <svg></svg>
    </figure>
    <h2 v-else-if="$subReady.Lanes && !lane.name">
      Lane with slug <code>{{$route.params.slug}}</code> isn't configured.
    </h2>
    <h2 v-else>Loading...</h2>
    <div v-if="build_graph().length">{{svg_graph}}</div>
  </div>
</template>

<script>
import { Tracker } from 'meteor/tracker';
import { Lanes } from '../../../../api/lanes';
import {
  build_graph,
  node_list,
  link_list,
  lane,
  graph_options,
  handle_link_click,
  handle_download_yaml,
  svg_graph,
} from './lib';
import './charter.css';

const options = {
  sort: { actual: -1 },
  limit: 1,
};



export default {
  meteor: {
    $subscribe: {
      Lanes: ['/charter'],

      Shipments: function () {
        let list = node_list.get()?.map((node) => node.id);
        return [list, options];
      },
    },
    lane,
    svg_graph,
  },

  data() {
    return {
      previous_lane_states: {},
    };
  },

  mounted() {
    const getState = (lane) => lane.last_shipment?.exit_code ?? (
      lane.last_shipment?.active ? 
      'active' : 
      undefined
    );

    Lanes.find().fetch().forEach(lane => {
      if (lane.name && lane.slug) {
        this.previous_lane_states[lane.slug] = {
          state: getState(lane),
          initialized: true,
        };
      }
    });

    this.tracker = Tracker.autorun(() => {
      Lanes.find().fetch().forEach(lane => {
        if (!lane.name || !lane.slug) return;

        const current = getState(lane);
        const prev = this.previous_lane_states[lane.slug];

        if (prev?.initialized && prev.state !== current) {
          console.log('Lane changed:', lane.name, 'exit_code:', current);
        }

        if (prev) {
          prev.state = current;
        }
        else {
          this.previous_lane_states[lane.slug] = {
            state: current,
            initialized: true,
          };
        }
      });
    });
  },

  beforeUnmount() {
    this.tracker?.stop();
  },

  methods: {
    build_graph,
    handle_download_yaml,
  }
};
</script>