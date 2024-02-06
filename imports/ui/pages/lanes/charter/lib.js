import { Lanes } from "../../../../api/lanes";
import { Shipments } from "../../../../api/shipments";
import { get_lane } from "../lib/util";

export const ROOT = "ROOT";
export const FOLLOWUP = "FOLLOWUP➡️";
export const SALVAGE = "⚠️SALVAGE";
export const FOLLOWUP_COLOR = "rgba(0, 170, 255, 1)";
export const FOLLOWUP_LINK_COLOR = "rgba(0, 170, 255, 0.75)";
export const SALVAGE_COLOR = "rgba(255, 170, 0, 1)";
export const SALVAGE_LINK_COLOR = "rgba(255, 170, 0, 0.75)";
export const ROOT_COLOR = "#f0a";
export const SUCCESS_COLOR = "#3adb76";
export const FAIL_COLOR = "red";
const TOP_PADDING = 225;
export const STROKE_WIDTH = 5;

export const root_node = new H.ReactiveVar();
const node_list = new H.ReactiveVar([]);
const link_list = new H.ReactiveVar([]);

const assign_followup = function (followup, $lane, parent_id, nodes, links) {
  if (followup && !$lane?.recursive && followup?._id != parent_id) {
    let last_shipment = followup.last_shipment;
    let color = FOLLOWUP_COLOR;
    let followup_id = followup._id;

    if (last_shipment?.exit_code == 0) color = SUCCESS_COLOR;
    else if (last_shipment?.exit_code) color = FAIL_COLOR;

    followup.role = FOLLOWUP;
    followup.parent = $lane._id;
    followup.recursive = followup._id == $lane._id ? true : false;
    $lane.children.push(followup);

    /* istanbul ignore else */
    if (nodes.map((node) => node.id).indexOf(followup_id) == -1) {
      nodes.push({
        id: followup_id,
        name: followup.name,
        color: color,
        cssClass: followup_id,
        stroke: FOLLOWUP_COLOR,
        stroke_width: STROKE_WIDTH,
        lane: followup,
        shipment: Shipments.findOne({ lane: followup._id }),
        x: null,
        y: null,
      });

    }
    links.push({
      id: `${$lane._id}:${followup_id}`,
      sid: $lane._id,
      tid: followup_id,
      color: FOLLOWUP_LINK_COLOR,
      name: FOLLOWUP,
      source: $lane._id,
      target: followup._id,
    });

    return true;
  }

  return false;
};

const assign_salvage = function (plan, $lane, parent_id, nodes, links) {
  if (plan && !$lane.recursive && plan._id != parent_id) {
    let last_shipment = plan.last_shipment;
    let color = SALVAGE_COLOR;
    let salvage_id = plan._id;

    plan.role = SALVAGE;
    plan.parent = $lane._id;
    plan.recursive = plan._id == $lane._id ? true : false;
    $lane.children.push(plan);

    if (last_shipment?.exit_code == 0) color = SUCCESS_COLOR;
    else if (last_shipment?.exit_code) color = FAIL_COLOR;

    /* istanbul ignore else */
    if (nodes.map((node) => node.id).indexOf(salvage_id) == -1) {
      nodes.push({
        id: salvage_id,
        name: plan.name,
        color: color,
        cssClass: salvage_id,
        stroke: SALVAGE_COLOR,
        stroke_width: STROKE_WIDTH,
        lane: plan,
        shipment: Shipments.findOne({ lane: plan._id }),
        x: null,
        y: null,
      });

    }
    links.push({
      id: `${$lane._id}:${salvage_id}`,
      sid: $lane._id,
      tid: salvage_id,
      color: SALVAGE_LINK_COLOR,
      name: SALVAGE,
      source: $lane._id,
      target: plan._id,
    });

    return true;
  }

  return false;
};

const assign_children = ($lane, parent_id, nodes, links) => {
  let followup = Lanes.findOne($lane.followup?._id);
  let plan = Lanes.findOne($lane.salvage_plan?._id);
  const node_ids = nodes.map((node) => node.id);

  assign_followup(followup, $lane, parent_id, nodes, links);
  assign_salvage(plan, $lane, parent_id, nodes, links);

  if (
    $lane._id != root_node?.get()?.id &&
    node_ids.indexOf($lane._id) != -1 &&
    (node_ids.indexOf(followup?._id) != -1 || node_ids.indexOf(plan?._id)) != -1
  ) return $lane;

  $lane.children.forEach((child) => {
    child.children = [];

    /* istanbul ignore else */
    if (!child.recursive && child._id != root_node?.get()?.id) assign_children(
      child, $lane._id, nodes, links
    );
  });

  return $lane;
};

const build_graph = function () {
  let $lane = get_lane(this.$route?.params?.slug);
  let nodes = [];
  let links = [];

  if (!$lane._id || !$lane.name) return false;

  $lane.children = [];
  $lane.role = ROOT;
  let last_shipment = $lane.last_shipment;
  let color = ROOT_COLOR;
  if (last_shipment && last_shipment.exit_code == 0) color = SUCCESS_COLOR;
  else if (last_shipment && last_shipment.exit_code) color = FAIL_COLOR;

  root_node.set({
    id: $lane._id,
    name: $lane.name,
    color: color,
    cssClass: $lane._id,
    lane: $lane,
    stroke: ROOT_COLOR,
    stroke_width: STROKE_WIDTH,
    shipment: last_shipment,
    x: null,
    y: null,
  });
  nodes.push(root_node.get());

  assign_children($lane, false, nodes, links);

  node_list.set(nodes);
  link_list.set(links);

  return node_list.get();
};

const lane = function () {
  const $lane = get_lane(this.$route?.params.slug);
  return $lane;
};

const handle_link_click = function (event, link) {
  const $lane = link.target?.lane || link.lane;
  let start = $lane.last_shipment ?
    `/ship/${$lane.last_shipment.start}`
    : "/charter"
  ;
  let url = `/lanes/${$lane.slug}${start}`;

  /* istanbul ignore else */
  if (this.$route.path != url) this.$router.push(url);
  else console.log("Avoiding redundant navigation.");
  return url;
};

const graph_options = function () {
  return {
    canvas: false,
    size: { h: H.window ? H.window.innerHeight - TOP_PADDING : 0 },
    offset: { x: 0, y: 0 },
    force: 50000,
    forces: {
      Center: true,
      X: 2,
      Y: 2,
      ManyBody: true,
      Link: true,
    },
    nodeSize: 50,
    linkWidth: 25,
    nodeLabels: true,
    linkLabels: true,
    fontSize: 14,
    strLinks: true,
    resizeListener: true,
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
};
