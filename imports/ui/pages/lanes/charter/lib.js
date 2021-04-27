import { ReactiveVar } from "meteor/reactive-var";
import { Lanes } from "../../../../api/lanes";
import { Shipments } from "../../../../api/shipments";
import { get_lane } from "../lib/util";

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

const root_node = new ReactiveVar();
const graphed_nodes = new ReactiveVar({});
const node_list = new ReactiveVar([]);
const link_list = new ReactiveVar([]);

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
  let lane = get_lane(this.$route.params.slug);
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

const lane = function () {
  let lane = get_lane(this.$route.params.slug);

  return lane ? lane : {};
};

handle_link_click = function (event, link) {
  const { lane } = link.target;
  let start = lane.shipment ? `/ship/${lane.shipment.start}` : "/charter";
  let url = `/lanes/${lane.slug}${start}`;

  if (this.$route.path != url) this.$router.push(url);
  else console.log("Avoiding redundant navigation.");
};

const graph_options = function () {
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
};

export {
  assign_followup,
  assign_salvage,
  assign_children,
  build_graph,
  lane,
  graph_options,
  handle_link_click,
  node_list,
  link_list,
}