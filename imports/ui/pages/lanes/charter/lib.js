import * as d3 from 'd3';
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
export const ACTIVE_COLOR = '#fa0';
const TOP_PADDING = 225;
export const STROKE_WIDTH = 5;

export const root_node = new H.ReactiveVar();
const node_list = new H.ReactiveVar([]);
const link_list = new H.ReactiveVar([]);

const handle_download_yaml = function () {
  const { slug: slug_string } = this.$route.params;
  H.call('Lanes#download_charter_yaml', slug_string, (err, res) => {
    if (err) {
      H.alert('Something went wrong!  See the console (F12) for details.');
      throw err;
    }
    const localISOdate = new Date(
      new Date().getTime() - (new Date().getTimezoneOffset() * 60000)
    ).toISOString().replace('Z', '');
    const charter_filename = `${slug_string}_${localISOdate}_charter.yml`;
    const download_link = document.createElement('a');
    download_link.setAttribute(
      'href',
      `data:text/plain;charset=utf-8,${encodeURIComponent(res)}`
    );
    download_link.setAttribute('download', charter_filename);
    download_link.click();
  });
};

const assign_followup = function (
  followup, $lane, parent_slug, nodes, links
) {
  if (followup) {
    let last_shipment = followup.last_shipment;
    let color = FOLLOWUP_COLOR;
    let followup_slug = followup.slug;
    const link_id = `${$lane.slug}:${followup_slug}`;

    if (last_shipment?.exit_code == 0) color = SUCCESS_COLOR;
    else if (last_shipment?.exit_code) color = FAIL_COLOR;
    else if (last_shipment?.active) color = ACTIVE_COLOR;

    followup.role = FOLLOWUP;
    followup.parent = $lane.slug;
    followup.recursive = followup.slug == $lane.slug ? true : false;
    if ($lane.children.map(child => child.slug).indexOf(followup_slug) == -1) {
      $lane.children.push(followup);
    }

    /* istanbul ignore else */
    if (nodes.map(node => node.id).indexOf(followup_slug) == -1) {
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
    /* istanbul ignore else */
    if (links.map(link => link.id).indexOf(link_id) == -1) {
      links.push({
        id: link_id,
        sid: $lane.slug,
        tid: followup_slug,
        color: FOLLOWUP_LINK_COLOR,
        name: FOLLOWUP,
        source: $lane.slug,
        target: followup.slug,
      });
    }

    return true;
  }

  return false;
};

const assign_salvage = function (plan, $lane, parent_slug, nodes, links) {
  if (plan) {
    let last_shipment = plan.last_shipment;
    let color = SALVAGE_COLOR;
    let salvage_slug = plan.slug;
    const link_id = `${$lane.slug}:${salvage_slug}`;

    plan.role = SALVAGE;
    plan.parent = $lane.slug;
    plan.recursive = plan.slug == $lane.slug ? true : false;
    if ($lane.children.map(child => child.slug).indexOf(salvage_slug) == -1) {
      $lane.children.push(plan);
    }

    if (last_shipment?.exit_code == 0) color = SUCCESS_COLOR;
    else if (last_shipment?.exit_code) color = FAIL_COLOR;
    else if (last_shipment?.active) color = ACTIVE_COLOR;

    /* istanbul ignore else */
    if (nodes.map(node => node.id).indexOf(salvage_slug) == -1) {
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
    /* istanbul ignore else */
    if (links.map(link => link.id).indexOf(link_id) == -1) {
      links.push({
        id: link_id,
        sid: $lane.slug,
        tid: salvage_slug,
        color: SALVAGE_LINK_COLOR,
        name: SALVAGE,
        source: $lane.slug,
        target: plan.slug,
      });
    }

    return true;
  }

  return false;
};

const assign_children = function ($lane, parent_slug, nodes, links) {
  let followup = Lanes.findOne({ slug: $lane.followup?.slug });
  let plan = Lanes.findOne({ slug: $lane.salvage_plan?.slug });
  const node_slugs = nodes.map((node) => node.id);

  assign_followup(followup, $lane, parent_slug, nodes, links);
  assign_salvage(plan, $lane, parent_slug, nodes, links);

  if (
    $lane.slug != root_node?.get()?.id
    && node_slugs.indexOf($lane.slug) != -1
    && (
      (!followup || node_slugs.indexOf(followup?.slug) != -1) &&
      (!plan || node_slugs.indexOf(plan?.slug) != -1)
    )
  ) return $lane;

  $lane.children.forEach(function (child) {
    child.children = [];

    if (
      !child.recursive &&
      child.slug != root_node?.get()?.id &&
      (child.followup || child.salvage_plan)
    ) {
      assign_children(child, $lane.slug, nodes, links);
    }
  });

  return $lane;
};

const build_graph = function () {
  let $lane = get_lane(
    slug.call(this, this.$route?.params?.slug, true)
  );
  let nodes = [];
  let links = [];

  if (!$lane.slug || !$lane.name) return false;

  $lane.children = [];
  $lane.role = ROOT;
  let last_shipment = $lane.last_shipment;
  let color = ROOT_COLOR;
  if (last_shipment?.exit_code == 0) color = SUCCESS_COLOR;
  else if (last_shipment?.exit_code) color = FAIL_COLOR;
  else if (last_shipment?.active) color = ACTIVE_COLOR;

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

let simulation = null;
let node_selection = null;
let link_selection = null;
let link_line_selection = null;
let link_text_selection = null;
let previous_node_ids = null;
let current_route_slug = null;

const getState = (laneObj) => laneObj.last_shipment?.exit_code ??
  (laneObj.last_shipment?.active ? 'active' : undefined);

const getColor = (state, defaultColor) => {
  if (state === 0) return SUCCESS_COLOR;
  if (state && state !== 'active') return FAIL_COLOR;
  if (state === 'active') return ACTIVE_COLOR;
  return defaultColor;
};

const updateExistingNode = (newNode, existing) => {
  const freshLane = Lanes.findOne({ slug: newNode.id });
  const state = freshLane ? getState(freshLane) : undefined;
  let defaultColor = SALVAGE_COLOR;
  if (newNode.stroke === ROOT_COLOR) defaultColor = ROOT_COLOR;
  else if (newNode.stroke === FOLLOWUP_COLOR)
    defaultColor = FOLLOWUP_COLOR;
  const newColor = getColor(state, defaultColor);
  if (existing.color !== newColor) {
    existing.color = newColor;
    newNode.color = newColor;
  }
  const preserve = (prop) => {
    if (existing[prop] !== null && existing[prop] !== undefined)
      newNode[prop] = existing[prop];
  };
  preserve('x');
  preserve('y');
  preserve('vx');
  preserve('vy');
  preserve('fx');
  preserve('fy');
};

const synchronizeNodesWithSimulation = (current_nodes, sim) => {
  current_nodes.forEach(newNode => {
    const existing = sim.nodes().find(n => n.id === newNode.id);
    if (existing) {
      updateExistingNode(newNode, existing);
    }
    else {
      // New node - will be added by simulation.nodes(current_nodes) below
      void 0; // Explicit statement for coverage
    }
  });
};

const svg_graph = function svg_graph () {
  const width = H.$('.charter').width();
  const height = H.$('.charter').height();
  const current_nodes = node_list.get();
  const current_links = link_list.get();

  // Early return if container doesn't exist or has no dimensions
  if (!width || !height || !current_nodes?.length) {
    return '';
  }

  const current_node_ids = current_nodes.map(n => n.id).sort().join(',');

  // Get the current route slug from the root node or node list
  const route_slug = root_node?.get()?.id || current_nodes[0]?.id;

  // If route changed, reset previous_node_ids to force rebuild
  if (route_slug && route_slug !== current_route_slug) {
    previous_node_ids = null;
    current_route_slug = route_slug;
    // Also stop and clear any existing simulation
    if (simulation) {
      simulation.stop();
      simulation = null;
    }
  }

  const structure_changed = previous_node_ids !== current_node_ids;
  const svg_exists = H.$('.charter svg').length > 0;
  const svg_has_content = H.$('.charter svg g').length > 0;

  if (structure_changed || !simulation || !svg_exists || !svg_has_content) {
    if (simulation) simulation.stop();
    if (H.$('.charter svg g').length) H.$('.charter svg').html('');

    /* istanbul ignore next - d3 rendering setup */
    const svg = d3.select('.charter svg')
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;");

    /* istanbul ignore next - d3 rendering setup */
    const defs = svg.append('defs');
    /* istanbul ignore next - d3 rendering setup */
    const arrow_followup = defs.append('marker')
      .attr('id', 'arrow-followup')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 10)
      .attr('refY', 4)
      .attr('markerWidth', 3)
      .attr('markerHeight', 3)
      .attr('orient', 'auto-start-reverse');
    /* istanbul ignore next - d3 rendering setup */
    arrow_followup.append('path')
      .attr('fill', FOLLOWUP_COLOR)
      .attr('d', 'M 0 0 L 10 5 L 0 10 z');
    /* istanbul ignore next - d3 rendering setup */
    const arrow_salvage = arrow_followup.clone(true)
      .attr('id', 'arrow-salvage');
    /* istanbul ignore next - d3 rendering setup */
    arrow_salvage.select('path').attr('fill', SALVAGE_COLOR);

    // Create selections first so they're available for the tick handler
    /* istanbul ignore next - d3 rendering setup */
    link_selection = svg.append("g")
      .selectAll('.link')
      .data(current_links)
      .join("g")
      .attr('class', 'link');

    /* istanbul ignore next - d3 rendering setup */
    link_line_selection = link_selection.append("path")
      .attr('d', get_link_path_text)
      .attr('id', d => d.id)
      .attr('stroke-width', 15)
      .attr('stroke', d => d.color)
      .attr('marker-end', d => (d.name == FOLLOWUP ?
        'url(#arrow-followup)' : 'url(#arrow-salvage)'));

    /* istanbul ignore next - d3 rendering setup */
    link_text_selection = link_selection.append('text')
      .attr('class', 'link-label')
      .append('textPath')
      .style('fill', '#fff')
      .style('font-size', '14px')
      .attr('startOffset', '33%')
      .text(d => d.name)
      .attr('xlink:href', d => `#${d.id}`);

    /* istanbul ignore next - d3 rendering setup */
    node_selection = svg.append("g")
      .selectAll('.node')
      .data(current_nodes)
      .join("g")
      .attr('class', 'node');

    /* istanbul ignore next - d3 rendering setup */
    node_selection.append('circle')
      .attr("r", 25)
      .attr("fill", d => d.color)
      .attr('stroke', d => d.stroke)
      .attr("stroke-width", d => d.stroke_width);

    /* istanbul ignore next - d3 rendering setup */
    node_selection.append("title")
      .text(d => `${location.host}/lanes/${d.id}/charter`);

    /* istanbul ignore next - d3 rendering setup */
    node_selection.append('a')
      .attr('xlink:href', d => `/lanes/${d.id}/charter`)
      .append('text')
      .text(d => d.name)
      .attr('x', 30)
      .attr('y', 7)
      .attr('fill', '#fff')
      .style('fill', '#fff')
      .style('font-size', '16px');

    // Create simulation after selections are ready
    /* istanbul ignore next - d3 rendering setup */
    simulation = d3.forceSimulation(current_nodes)
      .force("link", d3.forceLink(current_links).distance(250).id(d => d.id))
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force('radial', d3.forceRadial(250, width / 2, height / 2))
      .on("tick", () => ticked(link_text_selection, link_line_selection,
        node_selection))
      .alpha(1)
      .restart();

    /* istanbul ignore next - d3 rendering setup */
    node_selection.call(
      d3.drag()
        .on("start", event => dragstarted(event, simulation, d3))
        .on("drag", (event, d) => dragged(event, d, width, height,
          simulation))
        .on("end", event => dragended(event, simulation))
    ).on('click', (event, d) => click.bind(this)(event, d, simulation, d3));

    previous_node_ids = current_node_ids;
  }
  else {
    synchronizeNodesWithSimulation(current_nodes, simulation);

    simulation.nodes(current_nodes);
    simulation.force("link").links(current_links);
    simulation.alpha(1).restart();

    // Update link selections
    /* istanbul ignore next - d3 rendering update */
    link_selection = link_selection.data(current_links, d => d.id);
    /* istanbul ignore next - d3 rendering update */
    link_selection.select('path')
      .attr('stroke', d => d.color);

    // Update node selections
    /* istanbul ignore next - d3 rendering update */
    node_selection = node_selection.data(current_nodes, d => d.id);
    /* istanbul ignore next - d3 rendering update */
    node_selection.select('circle')
      .attr("fill", d => d.color);
    /* istanbul ignore next - d3 rendering update */
    node_selection.select('text')
      .attr('fill', '#fff')
      .style('fill', '#fff');
  }

  return '';
};

const ticked = function (link_text, link_line, node) {
  /* istanbul ignore next - d3 rendering update */
  link_text.attr(
    'transform',
    /* istanbul ignore next
      reason: this would only test if d3 internals can be mathed
    */
    d => {
      const x = (d.source.x + d.target.x) / 2;
      const y = (d.source.y + d.target.y) / 2;
      return `translate(${x}, ${y})`;
    }
  );
  /* istanbul ignore next - d3 rendering update */
  link_line.attr('d', get_link_path_text);
  /* istanbul ignore next - d3 rendering update */
  link_line.attr('fill', 'none');

  /* istanbul ignore next - d3 rendering update */
  node.attr(
    'transform',
    /* istanbul ignore next */
    d => `translate(${d.x}, ${d.y})`
  );
};

const dragged = function (event, d, width, height, sim) {
  d.fx = clamp(event.x, 0, width);
  d.fy = clamp(event.y, 0, height);
  sim.alpha(1).restart();
};

const dragstarted = function (event, sim, d3lib) {
  if (!event.active) sim.alphaTarget(0.3).restart();
  event.subject.fx = event.subject.x;
  event.subject.fy = event.subject.y;
  /* istanbul ignore next - d3 rendering update */
  d3lib.select(event.sourceEvent.target.parentElement).classed('fixed', true);
};

const dragended = function (event, sim) {
  /* istanbul ignore else */
  if (!event.active) sim.alphaTarget(0);
};

// eslint-disable-next-line no-nested-ternary
const clamp = function (x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; };

const click = function (event, d, sim, d3lib) {
  delete d.fx;
  delete d.fy;
  /* istanbul ignore next - d3 rendering update */
  d3lib.select(event.target.parentElement).classed('fixed', false);
  sim.alpha(1).restart();
};

/* istanbul ignore next
  reason: this would only test if d3 internals can be mathed
*/
const get_link_path_text = function (d) {
  const x1 = (d.source.x || 0);
  const y1 = (d.source.y || 0);
  const x2 = (d.target.x || 0);
  const y2 = (d.target.y || 0);
  const arcX = (x1 + x2) / 2;
  const arcY = (y1 + y2) / 2;
  const path_string = `M ${x1} ${y1} A ${arcX} ${arcY} 0 0 1 ${x2} ${y2}`;
  return path_string;
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
  svg_graph,
  dragged,
  dragstarted,
  dragended,
  clamp,
  click,
  get_link_path_text,
  getState,
  getColor,
  synchronizeNodesWithSimulation,
};
