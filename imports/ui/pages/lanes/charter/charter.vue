<template>
  <div>
    <h1>Lane Charter</h1>
    <figure
      v-if="this.$subReady.Shipments && build_graph().length"
      class="charter"
    >
      <figcaption>
        Starting with lane:
        <a class="root" :href="'/lanes/' + lane().slug + '/ship'">{{
          lane().name
        }}</a>
      </figcaption>
      <d3-network
        ref="d3"
        :net-nodes="build_graph()"
        :net-links="links()"
        :options="graph_options()"
        @link-click="handleLinkClick"
      />
    </figure>
    <h2 v-else>Loading...</h2>
  </div>
</template>

<script>
import { ReactiveVar } from "meteor/reactive-var";
import { Lanes } from "../../../../api/lanes";
import { Shipments } from "../../../../api/shipments";
import { get_lane } from "../lib/util";
import D3Network from "vue-d3-network";

const ROOT = "ROOT";
const FOLLOWUP = "FOLLOWUP ➡";
const SALVAGE = "SALVAGE ➡";
const FOLLOWUP_COLOR = "#0af";
const SALVAGE_COLOR = "#fa0";
const ROOT_COLOR = "#f0a";
const SUCCESS_COLOR = "#3adb76";
const FAIL_COLOR = "red";
const TOP_PADDING = 225;
const STROKE_WIDTH = 5;

const node_list = new ReactiveVar([]);
const link_list = new ReactiveVar([]);
const root_node = new ReactiveVar();
const graphed_nodes = new ReactiveVar({});

const options = {
  sort: { actual: -1 },
};

const assign_followup = function (followup, target, parent_id, nodes, links) {
  if (followup && !target.recursive && followup._id != parent_id) {
    let last_shipment = Shipments.findOne({ lane: followup._id });
    let color = FOLLOWUP_COLOR;
    let followup_id = followup._id;

    if (last_shipment && last_shipment.exit_code) color = FAIL_COLOR;
    else if (last_shipment && last_shipment.exit_code == 0)
      color = SUCCESS_COLOR;

    followup.role = FOLLOWUP;
    followup.parent = target._id;
    followup.recursive = followup._id == target._id ? true : false;
    target.children.push(followup);

    if (nodes.map((node) => node.id).indexOf(followup_id) == -1) {
      nodes.push({
        id: followup_id,
        name: followup.name,
        _color: color,
        _cssClass: followup_id,
        _svgAttrs: {
          stroke: FOLLOWUP_COLOR,
          "stroke-width": STROKE_WIDTH,
        },
        lane: followup,
        shipment: Shipments.findOne({ lane: followup._id }),
      });
    }

    links.push({
      id: `${target._id}:${followup_id}`,
      sid: target._id,
      tid: followup_id,
      _color: FOLLOWUP_COLOR,
      name: FOLLOWUP,
    });
  }
};

const assign_salvage = function (plan, target, parent_id, nodes, links) {
  if (plan && !target.recursive && plan._id != parent_id) {
    let last_shipment = Shipments.findOne({ lane: plan._id });
    let color = SALVAGE_COLOR;
    let salvage_id = plan._id;

    plan.role = SALVAGE;
    plan.parent = target._id;
    plan.recursive = plan._id == target._id ? true : false;
    target.children.push(plan);

    if (last_shipment && last_shipment.exit_code == 0) color = SUCCESS_COLOR;
    else if (last_shipment && last_shipment.exit_code) color = FAIL_COLOR;

    if (nodes.map((node) => node.id).indexOf(salvage_id) == -1) {
      nodes.push({
        id: salvage_id,
        name: plan.name,
        _color: color,
        _cssClass: salvage_id,
        _svgAttrs: {
          stroke: SALVAGE_COLOR,
          "stroke-width": STROKE_WIDTH,
        },
        lane: plan,
        shipment: Shipments.findOne({ lane: plan._id }),
      });
    }

    links.push({
      id: `${target._id}:${salvage_id}`,
      sid: target._id,
      tid: salvage_id,
      _color: SALVAGE_COLOR,
      name: SALVAGE,
    });
  }
};

const assign_children = (target, parent_id, nodes, links) => {
  let followup = Lanes.findOne(target.followup);
  let plan = Lanes.findOne(target.salvage_plan);

  assign_followup(followup, target, parent_id, nodes, links);

  assign_salvage(plan, target, parent_id, nodes, links);

  target.children.forEach((child) => {
    child.children = [];

    if (!child.recursive && child._id != root_node.get().id)
      assign_children(child, target._id, nodes, links);
  });

  return target;
};

const build_graph = function () {
  let lane = get_lane(this.$route.params.name);
  let nodes = [];
  let links = [];

  if (!lane) return false;

  lane.children = [];
  lane.role = ROOT;
  let last_shipment = Shipments.findOne({ lane: lane._id });
  let color = ROOT_COLOR;
  if (last_shipment && last_shipment.exit_code) color = FAIL_COLOR;
  else if (last_shipment && last_shipment.exit_code == 0) color = SUCCESS_COLOR;

  root_node.set({
    id: lane._id,
    name: lane.name,
    _color: color,
    _cssClass: lane._id,
    lane: lane,
    _svgAttrs: {
      stroke: ROOT_COLOR,
      "stroke-width": STROKE_WIDTH,
    },
    shipment: last_shipment,
  });
  nodes.push(root_node.get());

  graphed_nodes[lane._id] = 1;

  assign_children(lane, false, nodes, links);

  node_list.set(nodes);
  link_list.set(links);

  return node_list.get();
};

export default {
  meteor: {
    $subscribe: {
      Lanes: function () {
        let list = [node_list.get()?.map((node) => ({ _id: node.id }))];
        return list;
      },

      Shipments: function () {
        let list = node_list.get()?.map((node) => node.id);
        return [list, options];
      },
    },
  },

  beforeCreate() {
    build_graph.call(this);
  },

  methods: {
    build_graph,

    links() {
      return link_list.get();
    },

    graph_options() {
      return {
        canvas: false,
        size: { h: window.innerHeight - TOP_PADDING },
        offset: { x: 0, y: 0 },
        force: 50000,
        forces: {
          Center: true,
          X: 2,
          Y: 3,
          ManyBody: true,
          Link: true,
        },
        nodeSize: 50,
        linkWidth: 25,
        nodeLabels: true,
        linkLabels: true,
        fontSize: 14,
        strLinks: true,
        resizeListener: false,
        canvasStyles: {},
      };
    },

    handleLinkClick(event, link) {
      const { lane } = link.target;
      let start = lane.shipment ? `/ship/${lane.shipment.start}` : "/charter";
      let url = `/lanes/${lane.slug}${start}`;

      if (this.$route.path != url) this.$router.push(url);
      else console.log("Avoiding redundant navigation.");
    },

    lane() {
      let lane = get_lane(this.$route.params.name);

      return lane ? lane : {};
    },
  },

  mounted() {},

  components: {
    D3Network,
  },
};
</script>

<style>
.node:hover,
.link:hover {
  cursor: pointer;
}

.link-label {
  pointer-events: none;
}

figure.charter {
  border: none;
  text-align: center;
  position: relative;
}

.charter figcaption {
  text-align: left;
}

.charter div {
  position: relative;
}

.svg-path {
  width: 100%;
  height: 20px;
  position: absolute;
  left: 0;
  top: -10px;
}

.svg-path svg {
  position: absolute;
  left: 0;
  top: 0;
}

.charter .lane {
  margin: 10px;
}

.charter-lane.exit-code.code- {
  border-color: #f0a;
  color: #f0a;
}

.followup-lane.exit-code.code- {
  border-color: #0af;
  color: #0af;
}

.salvage-lane.exit-code.code- {
  border-color: #fa0;
  color: #fa0;
}

.charter .lane.code-0 {
  color: #000;
}

.charter .lane.active {
  background: #ccc;
  font-weight: bold;
  border-color: #aaa;
}

#graph {
  width: 100%;
  height: 100%;
  position: absolute;
}

#graph canvas {
  left: 0;
  border: 1px solid #ccc;
}

.root {
  color: #f0a;
}

</style>