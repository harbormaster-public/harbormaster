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

  methods: {
    build_graph,
    handle_download_yaml,
  }
};
</script>