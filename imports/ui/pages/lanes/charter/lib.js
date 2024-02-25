import { Lanes } from "../../../../api/lanes";
import { Shipments } from "../../../../api/shipments";
import { get_lane } from "../lib/util";
import { slug } from "../edit_lane/lib";

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

const handle_download_yaml = function () {
  const { slug } = this.$route.params;
  H.call('Lanes#download_charter_yaml', slug, (err, res) => {
    if (err) {
      H.alert('Something went wrong!  See the console (F12) for details.');
      throw err;
    }
    const localISOdate = new Date(
      new Date().getTime() - (new Date().getTimezoneOffset() * 60000)
    ).toISOString().replace('Z', '');
    const charter_filename = `${slug}_${localISOdate}_charter.yml`;
    const download_link = document.createElement('a');
    download_link.setAttribute(
      'href',
      `data:text/plain;charset=utf-8,${encodeURIComponent(res)}`
    );
    download_link.setAttribute('download', charter_filename);
    download_link.click();
  });
};

const assign_followup = function (followup, $lane, parent_slug, nodes, links) {
  if (followup && !$lane?.recursive && followup?.slug != parent_slug) {
    let last_shipment = followup.last_shipment;
    let color = FOLLOWUP_COLOR;
    let followup_slug = followup.slug;

    if (last_shipment?.exit_code == 0) color = SUCCESS_COLOR;
    else if (last_shipment?.exit_code) color = FAIL_COLOR;

    followup.role = FOLLOWUP;
    followup.parent = $lane.slug;
    followup.recursive = followup.slug == $lane.slug ? true : false;
    $lane.children.push(followup);

    /* istanbul ignore else */
    if (nodes.map((node) => node.id).indexOf(followup_slug) == -1) {
      nodes.push({
        id: followup_slug,
        name: followup.name,
        color: color,
        cssClass: followup_slug,
        stroke: FOLLOWUP_COLOR,
        stroke_width: STROKE_WIDTH,
        lane: followup,
        shipment: Shipments.findOne({ lane: followup.slug }),
        x: null,
        y: null,
      });

    }
    links.push({
      id: `${$lane.slug}:${followup_slug}`,
      sid: $lane.slug,
      tid: followup_slug,
      color: FOLLOWUP_LINK_COLOR,
      name: FOLLOWUP,
      source: $lane.slug,
      target: followup.slug,
    });

    return true;
  }

  return false;
};

const assign_salvage = function (plan, $lane, parent_slug, nodes, links) {
  if (plan && !$lane.recursive && plan.slug != parent_slug) {
    let last_shipment = plan.last_shipment;
    let color = SALVAGE_COLOR;
    let salvage_slug = plan.slug;

    plan.role = SALVAGE;
    plan.parent = $lane.slug;
    plan.recursive = plan.slug == $lane.slug ? true : false;
    $lane.children.push(plan);

    if (last_shipment?.exit_code == 0) color = SUCCESS_COLOR;
    else if (last_shipment?.exit_code) color = FAIL_COLOR;

    /* istanbul ignore else */
    if (nodes.map((node) => node.id).indexOf(salvage_slug) == -1) {
      nodes.push({
        id: salvage_slug,
        name: plan.name,
        color: color,
        cssClass: salvage_slug,
        stroke: SALVAGE_COLOR,
        stroke_width: STROKE_WIDTH,
        lane: plan,
        shipment: Shipments.findOne({ lane: plan.slug }),
        x: null,
        y: null,
      });

    }
    links.push({
      id: `${$lane.slug}:${salvage_slug}`,
      sid: $lane.slug,
      tid: salvage_slug,
      color: SALVAGE_LINK_COLOR,
      name: SALVAGE,
      source: $lane.slug,
      target: plan.slug,
    });

    return true;
  }

  return false;
};

const assign_children = ($lane, parent_slug, nodes, links) => {
  let followup = Lanes.findOne({ slug: $lane.followup?.slug });
  let plan = Lanes.findOne({ slug: $lane.salvage_plan?.slug });
  const node_slugs = nodes.map((node) => node.id);

  assign_followup(followup, $lane, parent_slug, nodes, links);
  assign_salvage(plan, $lane, parent_slug, nodes, links);

  if (
    $lane.slug != root_node?.get()?.id &&
    node_slugs.indexOf($lane.slug) != -1 &&
    (
      node_slugs.indexOf(followup?.slug) != -1 ||
      node_slugs.indexOf(plan?.slug) != -1
    )
  ) return $lane;

  $lane.children.forEach((child) => {
    child.children = [];

    /* istanbul ignore else */
    if (!child.recursive && child.slug != root_node?.get()?.id) assign_children(
      child, $lane.slug, nodes, links
    );
  });

  return $lane;
};

const build_graph = function () {
  let $lane = get_lane(slug(this.$route?.params?.slug, true));
  let nodes = [];
  let links = [];

  if (!$lane.slug || !$lane.name) return false;

  $lane.children = [];
  $lane.role = ROOT;
  let last_shipment = $lane.last_shipment;
  let color = ROOT_COLOR;
  if (last_shipment && last_shipment.exit_code == 0) color = SUCCESS_COLOR;
  else if (last_shipment && last_shipment.exit_code) color = FAIL_COLOR;

  root_node.set({
    id: $lane.slug,
    name: $lane.name,
    color: color,
    cssClass: $lane.slug,
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
  handle_download_yaml,
  node_list,
  link_list,
};
