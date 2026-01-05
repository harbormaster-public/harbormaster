import * as d3 from 'd3';
import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';

let total_shipments = new H.ReactiveVar('Loading');
const node_list = new H.ReactiveVar([]);
const link_list = new H.ReactiveVar([]);
let nodes = [];
export let node_ids = [];
let links = [];
let simulation = null;
let node_selection = null;
let link_selection = null;
let previous_node_ids = null;

const setLinkSelection = function (value) {
  link_selection = value;
};

const setNodeSelection = function (value) {
  node_selection = value;
};

const shipments_last_24_hours = function () {
  const val = total_shipments.get();
  return (val && val.toLocaleString) ? val.toLocaleString() : String(val);
};

const latest_shipment = function () {
  let shipment = H.Session.get('latest_shipment') || false;

  H.call(
    'Shipments#get_latest_date',
    /* istanbul ignore next */
    function (err, res) {
      if (err) throw err;
      H.Session.set('latest_shipment', res);
    });

  if (! shipment) {
    return { locale: 'loading...' };
  }

  return H.Session.get('latest_shipment');
};

const total_captains = function () {
  let captains = [];
  const lanes = Lanes.find({}, { fields: { captains: 1 } }).fetch();

  _.each(lanes, function (lane) {
    if (lane.captains && lane.captains.length) {
      captains = captains.concat(lane.captains);
    }
  });
  return _.uniq(captains).length.toLocaleString();
};

const total_harbormasters = function () {
  return Users.find({ harbormaster: true }).count();
};

const is_harbormaster = async function () {
  const currentUser = H.user();
  const user_id = currentUser && currentUser.emails && currentUser.emails[0]
    ? currentUser.emails[0].address
    : undefined;
  const user = await Users.findOneAsync(user_id);
  return user && user.harbormaster;
};

const is_captain = async function () {
  const currentUser = H.user && H.user();
  const email = currentUser?.emails?.[0]?.address;
  if (!email) return false;

  return await Lanes.find({
    captains: { $in: [email] },
  }).countAsync() > 0;
};

const moniker = async function () {
  const currentUser = H.user();
  let userEmail;
  if (currentUser && currentUser.emails && currentUser.emails[0]) {
    userEmail = currentUser.emails[0].address;
  }
  else {
    userEmail = undefined;
  }
  let user = userEmail;
  let role = 'User';
  if (await is_captain()) {
    role = `Captain`;
  }
  if (await is_harbormaster()) {
    role = `Harbormaster`;
  }
  return `${role} ${user}`;
};

const getState = function (laneObj) {
  const lastShipment = laneObj.last_shipment;
  if (lastShipment &&
      lastShipment.exit_code !== null &&
      lastShipment.exit_code !== undefined) {
    return lastShipment.exit_code;
  }
  if (lastShipment && lastShipment.active) {
    return 'active';
  }
  return undefined;
};

const getColor = function (state) {
  if (state === 0) {
    return '#44aa99';
  }
  if (state && state !== 'active') {
    return '#D41159';
  }
  if (state === 'active') {
    return 'darkgoldenrod';
  }
  return undefined;
};

/**
 * Clamps a value between a minimum and maximum
 * @param {number} x - Value to clamp
 * @param {number} lo - Minimum value
 * @param {number} hi - Maximum value
 * @returns {number} Clamped value
 */
const clamp = function (x, lo, hi) {
  return ((x < lo ? lo : x) > hi ? hi : x);
};

/**
 * Creates path data string for a link between two nodes
 * @param {Object} d - Link data object with source and target nodes
 * @returns {string} SVG path data string
 */
const createLinkPathData = function (d) {
  const x1 = (d.source.x) || '0';
  const y1 = (d.source.y) || '0';
  const x2 = (d.target.x) || '0';
  const y2 = (d.target.y) || '0';
  return `M ${x1} ${y1} L ${x2} ${y2}`;
};

/**
 * Creates and configures the SVG element
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @returns {Object} D3 selection of the SVG element
 */
const createSvgElement = function (width, height) {
  return d3.select('#all-charters svg')
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto;");
};

/**
 * Creates link selections and link line selections
 * @param {Object} svg - D3 selection of SVG element
 * @param {Array} current_links - Array of link data objects
 * @returns {Object} Object containing link_selection and link_line_selection
 */
const createLinkSelections = function (svg, current_links) {
  const new_link_selection = svg.append("g")
    .selectAll('.link')
    .data(current_links)
    .join("g")
    .attr('class', 'link');

  const new_link_line_selection = new_link_selection.append("path")
    .attr('d', createLinkPathData)
    .attr('id', d => d.id)
    .attr('stroke-width', 2)
    .attr('stroke', d => d.stroke);

  return {
    link_selection: new_link_selection,
    link_line_selection: new_link_line_selection,
  };
};

/**
 * Creates drag event handlers for node interactions
 * @param {Object} force_simulation - D3 force simulation object
 * @param {number} width - SVG width for clamping
 * @param {number} height - SVG height for clamping
 * @returns {Object} Object containing dragstarted, dragged, dragended,
 *   and click handlers
 */
const createDragHandlers = function (force_simulation, width, height) {
  const dragstarted = function (event) {
    if (!event.active) force_simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
    d3.select(this).classed('fixed', true);
  };

  const dragged = function (event, d) {
    d.fx = clamp(event.x, 0, width);
    d.fy = clamp(event.y, 0, height);
    force_simulation.alpha(1).restart();
  };

  const dragended = function (event) {
    if (!event.active) force_simulation.alphaTarget(0);
  };

  const click = function (event, d) {
    delete d.fx;
    delete d.fy;
    d3.select(this).classed('fixed', false);
    force_simulation.alpha(1).restart();
  };

  return { dragstarted, dragged, dragended, click };
};

/**
 * Creates the tick handler function for the simulation
 * @param {Object} link_line_paths - D3 selection of link line paths
 * @param {Object} node_groups - D3 selection of node groups
 * @returns {Function} Ticked handler function
 */
const createTickedHandler = function (link_line_paths, node_groups) {
  return function () {
    link_line_paths.attr('d', createLinkPathData);

    node_groups.attr('transform', (d) => {
      const x = d.x ? d.x : 0;
      const y = d.y ? d.y : 0;
      return `translate(${x}, ${y})`;
    });
  };
};

/**
 * Creates node selections with visual elements (circles, text, titles)
 * @param {Object} svg - D3 selection of SVG element
 * @param {Array} current_nodes - Array of node data objects
 * @returns {Object} D3 selection of node groups
 */
const createNodeSelections = function (svg, current_nodes) {
  const new_node_selection = svg.append("g")
    .selectAll('.node')
    .data(current_nodes)
    .join("g")
    .attr('class', 'node');

  new_node_selection.append('circle')
    .attr("r", 10)
    .attr('stroke-width', 2)
    .attr('fill', d => d.fill)
    .attr('stroke', d => d.stroke);

  new_node_selection.append('text')
    .text(d => d.name)
    .attr('x', 15)
    .attr('y', 3)
    .style('fill', d => d.fill)
    .style('font-size', '10px');

  /* istanbul ignore next - d3 rendering setup */
  new_node_selection.append("title").text(d => d.name);

  return new_node_selection;
};

/**
 * Sets up drag behavior on node selections
 * @param {Object} node_groups - D3 selection of node groups
 * @param {Object} handlers - Object containing drag handlers
 *   (dragstarted, dragged, dragended, click)
 */
const setupDragBehavior = function (node_groups, handlers) {
  node_groups.call(d3.drag()
    .on("start", handlers.dragstarted)
    .on("drag", handlers.dragged)
    .on("end", handlers.dragended))
    .on('click', handlers.click);
};

/**
 * Creates a D3 force simulation with nodes, links, and forces
 * @param {Array} current_nodes - Array of node data objects
 * @param {Array} current_links - Array of link data objects
 * @param {number} width - SVG width for centering force
 * @param {number} height - SVG height for centering force
 * @param {Function} ticked - Ticked handler function
 * @returns {Object} D3 force simulation object
 */
const createSimulation = function (
  current_nodes, current_links, width, height, ticked
) {
  return d3.forceSimulation(current_nodes)
    .force("link", d3.forceLink(current_links).distance(50).id(d => d.id))
    .force("charge", d3.forceManyBody().strength(-100))
    .force("x", d3.forceX(width / 2))
    .force("y", d3.forceY(height / 2))
    .on("tick", ticked);
};

/**
 * Updates node properties by preserving position/velocity and updating
 * fill color
 * @param {Array} current_nodes - Array of node data objects to update
 * @param {Object} force_simulation - D3 force simulation object
 */
const updateNodeProperties = function (current_nodes, force_simulation) {
  current_nodes.forEach(newNode => {
    const existing = force_simulation.nodes().find(n => n.id === newNode.id);
    if (existing) {
      const freshLane = Lanes.findOne({ _id: newNode.id }, {
        fields: { 'last_shipment.exit_code': 1, 'last_shipment.active': 1 },
      });
      if (freshLane) {
        const state = getState(freshLane);
        const newFill = getColor(state);
        if (existing.fill !== newFill) {
          existing.fill = newFill;
          newNode.fill = newFill;
        }
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
    }
  });
};

/**
 * Updates the simulation with new nodes and links
 * @param {Object} force_simulation - D3 force simulation object
 * @param {Array} current_nodes - Array of node data objects
 * @param {Array} current_links - Array of link data objects
 */
const updateSimulation = function (
  force_simulation, current_nodes, current_links
) {
  force_simulation.nodes(current_nodes);
  force_simulation.force("link").links(current_links);
  force_simulation.alpha(1).restart();
};

/**
 * Updates link selections with new link data
 * @param {Object} existing_link_selection - D3 selection of link groups
 * @param {Array} current_links - Array of link data objects
 * @returns {Object} Object containing updated link_selection and
 *   link_line_selection
 */
const updateLinkSelections = function (existing_link_selection, current_links) {
  let updated_link_selection = existing_link_selection.data(
    current_links, d => d.id
  );
  updated_link_selection.exit().remove();
  updated_link_selection = updated_link_selection.enter()
    .append("g")
    .attr('class', 'link')
    .merge(updated_link_selection);
  let updated_link_line_selection = updated_link_selection.select('path');
  if (updated_link_line_selection.empty()) {
    updated_link_line_selection = updated_link_selection.append("path");
  }
  updated_link_line_selection
    .attr('d', createLinkPathData)
    .attr('id', d => d.id)
    .attr('stroke-width', 2)
    .attr('stroke', d => d.stroke);
  return {
    link_selection: updated_link_selection,
    link_line_selection: updated_link_line_selection,
  };
};

/**
 * Updates node selections with new node data
 * @param {Object} existing_node_selection - D3 selection of node groups
 * @param {Array} current_nodes - Array of node data objects
 * @returns {Object} Updated node_selection
 */
const updateNodeSelections = function (existing_node_selection, current_nodes) {
  const updated_node_selection = existing_node_selection.data(
    current_nodes, d => d.id
  );
  updated_node_selection.select('circle').attr("fill", d => d.fill);
  updated_node_selection.select('text').style('fill', d => d.fill);
  return updated_node_selection;
};

/**
 * Initializes a new graph visualization with SVG, selections, simulation,
 * and drag handlers
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @param {Array} current_nodes - Array of node data objects
 * @param {Array} current_links - Array of link data objects
 * @returns {Object} Object containing svg, link_selection, link_line_selection,
 *   node_selection, and simulation
 */
const initializeGraphVisualization = function (
  width, height, current_nodes, current_links
) {
  const svg = createSvgElement(width, height);

  const link_selections_result = createLinkSelections(svg, current_links);
  const new_link_selection = link_selections_result.link_selection;
  const new_link_line_selection = link_selections_result.link_line_selection;

  const new_node_selection = createNodeSelections(svg, current_nodes);

  const ticked = createTickedHandler(
    new_link_line_selection, new_node_selection
  );

  const new_simulation = createSimulation(
    current_nodes, current_links, width, height, ticked
  );

  const drag_handlers = createDragHandlers(new_simulation, width, height);
  setupDragBehavior(new_node_selection, drag_handlers);

  return {
    svg,
    link_selection: new_link_selection,
    link_line_selection: new_link_line_selection,
    node_selection: new_node_selection,
    simulation: new_simulation,
  };
};

/**
 * The following graph code is adapted from here:
 * https://observablehq.com/@d3/disjoint-force-directed-graph/2
 *
 */
const svg_graph = function () {
  const width = H.$('#all-charters svg').width();
  const height = H.$('#all-charters svg').height();
  const current_nodes = node_list.get() || nodes;
  const current_links = link_list.get() || links;

  if (!width || !height) {
    return '';
  }

  if (!current_nodes?.length) {
    return '';
  }

  const current_node_ids = current_nodes.map(n => n.id).sort().join(',');
  const structure_changed = previous_node_ids !== current_node_ids;
  const svg_exists = H.$('#all-charters svg').length > 0;
  const svg_has_content = H.$('#all-charters svg g').length > 0;

  if (structure_changed || !simulation || !svg_exists || !svg_has_content) {
    if (simulation) simulation.stop();
    if (H.$('#all-charters svg g').length) H.$('#all-charters svg').html('');

    if (typeof document !== 'undefined') {
      const graphSetup = initializeGraphVisualization(
        width, height, current_nodes, current_links
      );
      link_selection = graphSetup.link_selection;
      node_selection = graphSetup.node_selection;
      simulation = graphSetup.simulation;
      H.simulation = simulation;
    }

    previous_node_ids = current_node_ids;
  }
  else {
    updateNodeProperties(current_nodes, simulation);
    updateSimulation(simulation, current_nodes, current_links);

    if (link_selection) {
      const linkSelections = updateLinkSelections(
        link_selection, current_links
      );
      link_selection = linkSelections.link_selection;
    }

    if (node_selection) {
      node_selection = updateNodeSelections(node_selection, current_nodes);
    }
  }

  return '';
};

/**
 * Resolve a lane reference (which may be an object with `_id` and/or `slug`,
 * or a string id/slug) into a published Lane document.
 *
 * Root page subscriptions historically published only `_id` refs; however,
 * lanes may be configured with slug-only refs (especially before any shipments
 * have occurred). This helper makes graph link building resilient.
 */
const resolveLaneRef = function (laneRef) {
  if (!laneRef) return null;

  if (laneRef._id && laneRef.name) {
    return laneRef;
  }

  let ref = laneRef;
  if (typeof laneRef === 'string') {
    ref = { _id: laneRef, slug: laneRef };
  }
  const $or = [];
  if (ref && ref._id) $or.push({ _id: ref._id });
  if (ref && ref.slug) $or.push({ slug: ref.slug });
  if (!$or.length) return null;
  return Lanes.findOne({ $or });

};

const collect_graph_lists = function (lane) {
  let node_fill;
  if (!lane) {
    return false;
  }

  if (lane.last_shipment?.active) node_fill = 'darkgoldenrod';
  else if (lane.last_shipment?.exit_code == 0) node_fill = '#44aa99';
  else if (lane.last_shipment?.exit_code) node_fill = '#D41159';

  node_ids = nodes.map(node => node.id);
  const lane_collected = node_ids.indexOf(lane._id) == -1;
  if (lane_collected) {
    nodes.push({
      id: lane._id,
      name: lane.name,
      lane: lane,
      x: 0,
      y: 0,
      fill: node_fill,
      stroke: 'white',
    });
    node_ids.push(lane._id);
  }
  else {
    const existing_node = nodes.find(n => n.id === lane._id);
    if (existing_node) {
      existing_node.fill = node_fill;
    }
  }

  const followup_lane = resolveLaneRef(lane.followup);
  if (followup_lane?._id) {
    const link_id = `${lane._id}:${followup_lane._id}`;
    const link_exists = links.some(l => l.id === link_id);
    if (!link_exists) {
      links.push({
        id: link_id,
        sid: lane._id,
        tid: followup_lane._id,
        source: lane._id,
        target: followup_lane._id,
        // Match charter graph semantics: followup = blue, salvage = orange.
        stroke: '#0af',
      });
    }

    if (node_ids.indexOf(followup_lane._id) == -1) {
      const next_lane = followup_lane;
      collect_graph_lists(next_lane);
    }
  }

  const salvage_lane = resolveLaneRef(lane.salvage_plan);
  if (salvage_lane?._id) {
    const link_id = `${lane._id}:${salvage_lane._id}`;
    const link_exists = links.some(l => l.id === link_id);
    if (!link_exists) {
      links.push({
        id: link_id,
        sid: lane._id,
        tid: salvage_lane._id,
        source: lane._id,
        target: salvage_lane._id,
        // Match charter graph semantics: salvage = orange.
        stroke: '#fa0',
      });
    }

    if (node_ids.indexOf(salvage_lane._id) == -1) {
      const next_lane2 = salvage_lane;
      collect_graph_lists(next_lane2);
    }
  }

  return { nodes, links, node_ids };
};

const build_graph = function () {
  nodes = [];
  links = [];
  node_ids = [];
  const lanes = Lanes.find({}, {
    fields: {
      _id: 1,
      name: 1,
      slug: 1,
      'followup._id': 1,
      'followup.slug': 1,
      'salvage_plan._id': 1,
      'salvage_plan.slug': 1,
      'last_shipment.exit_code': 1,
      'last_shipment.active': 1,
    },
  }).fetch();
  for (const lane of lanes) { collect_graph_lists(lane); }
  node_list.set(nodes);
  link_list.set(links);
  return nodes;
};

export {
  shipments_last_24_hours,
  latest_shipment,
  total_captains,
  total_harbormasters,
  total_shipments,
  is_harbormaster,
  is_captain,
  moniker,
  getState,
  getColor,
  svg_graph,
  collect_graph_lists,
  build_graph,
  node_list,
  link_list,
  link_selection,
  setLinkSelection,
  setNodeSelection,
  clamp,
  createLinkPathData,
  createSvgElement,
  createLinkSelections,
  createNodeSelections,
  createDragHandlers,
  createTickedHandler,
  setupDragBehavior,
  createSimulation,
  updateNodeProperties,
  updateSimulation,
  updateLinkSelections,
  updateNodeSelections,
  initializeGraphVisualization,
};
