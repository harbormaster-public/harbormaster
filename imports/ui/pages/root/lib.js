import * as d3 from 'd3';
import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';

let total_shipments = new H.ReactiveVar('Loading');
let nodes = [];
export let node_ids = [];
let links = [];

const shipments_last_24_hours = function () {
  return total_shipments.get().toLocaleString();
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

  if (! shipment) return { locale: 'loading...' };

  return H.Session.get('latest_shipment');
};

const total_captains = function () {
  var captains = [];
  var lanes = Lanes.find().fetch();

  _.each(lanes, function (lane) {
    /* istanbul ignore else */
    if (lane.captains) {
      captains = captains.concat(lane.captains);
    }
  });
  return _.uniq(captains).length.toLocaleString();
};

const total_harbormasters = function () {
  var harbormasters = Users.find({ harbormaster: true }).fetch();
  return harbormasters.length.toLocaleString();
};

const is_harbormaster = function () {
  return Users.findOne({
    _id: H.user().emails[0].address,
  }).harbormaster;
};

const is_captain = function () {
  let lanes_captained = Lanes.find({
    captains: { $in: [H.user().emails[0].address] },
  }).count();
  if (lanes_captained > 0) return true;
  return false;
};

const moniker = function () {
  let user = H.user().emails[0]?.address;
  let role = 'User';
  if (is_harbormaster()) role = `Harbormaster`;
  if (is_captain()) role = `Captain`;
  return `${role} ${user}`;
};

const svg_graph = function () {
  const width = H.$('#all-charters svg').width();
  const height = H.$('#all-charters svg').height();
  if (!width || !height) return '';

  H.$('#all-charters svg').html('');

  let svg;
  let link;
  let link_line;
  let dragstarted;
  let dragged;
  let node;
  let clamp;
  let dragended;
  let click;
  let ticked;
  let simulation;

  /*
  The following graph code is adapted from here:
  https://observablehq.com/@d3/disjoint-force-directed-graph/2

  The code in the following if-statement primarily consists of calls to d3's
  API, and has historically little value in testing whether the API assigns the
  values passed to it directly in its internally-managed UI (it does).  Further,
  d3's API internally relies on certain browser constructs (e.g. document) which
  we don't yet need to stub out for this.

  If, down the road, a bug crops up here, it might be worth moving the
  event handlers into local methods for testability, and providing some
  instrumentation to ensure the vars are what we expect to be passing to d3.
  Until then, we'll ignore this UI-specific code from our coverage analysis.
  */
  /* istanbul ignore if */
  if (!H.isTest) {
    svg = d3.select('svg')
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;");

    link = svg.append("g")
      .selectAll('.link')
      .data(links)
      .join("g")
      .attr('class', 'link');

    link_line = link.append("path")
      .attr('d', d => {
        const x1 = (d.source.x) || '0';
        const y1 = (d.source.y) || '0';
        const x2 = (d.target.x) || '0';
        const y2 = (d.target.y) || '0';
        return `M ${x1} ${y1} L ${x2} ${y2}`;
      })
      .attr('id', d => d.id)
      .attr('stroke-width', 2)
      .attr('stroke', d => d.stroke);

    dragstarted = function (event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
      d3.select(this).classed('fixed', true);
    };

    dragged = function (event, d) {
      d.fx = clamp(event.x, 0, width);
      d.fy = clamp(event.y, 0, height);
      simulation.alpha(1).restart();
    };

    node = svg.append("g")
      .selectAll('.node')
      .data(nodes)
      .join("g")
      .attr('class', 'node');

    clamp = function (x, lo, hi) {
      return ((x < lo ? lo : x) > hi ? hi : x);
    };

    dragended = function (event) {
      if (!event.active) simulation.alphaTarget(0);
    };

    click = function (event, d) {
      delete d.fx;
      delete d.fy;
      d3.select(this).classed('fixed', false);
      simulation.alpha(1).restart();
    };

    ticked = function () {
      link_line.attr('d', (d) => {
        const x1 = (d.source.x) || '0';
        const y1 = (d.source.y) || '0';
        const x2 = (d.target.x) || '0';
        const y2 = (d.target.y) || '0';
        return `M ${x1} ${y1} L ${x2} ${y2}`;
      });

      node.attr('transform', (d) => {
        const x = d.x ? d.x : 0;
        const y = d.y ? d.y : 0;
        return `translate(${x}, ${y})`;
      });
    };
    node.append('circle')
      .attr("r", 10)
      .attr('stroke-width', 2)
      .attr('fill', d => d.fill)
      .attr('stroke', d => d.stroke);

    node.append('text')
      .text(d => d.name)
      .attr('x', 15)
      .attr('y', 3)
      .style('fill', d => d.fill)
      .style('font-size', '10px');

    node.append("title").text(d => d.name);

    node.call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended))
      .on('click', click);
  }

  /* istanbul ignore next */
  simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).distance(50).id(d => d.id))
    .force("charge", d3.forceManyBody().strength(-100))
    .force("x", d3.forceX(width / 2))
    .force("y", d3.forceY(height / 2))
    .on("tick", ticked);

  H.simulation = simulation;

  return '';
};

const collect_graph_lists = function (lane) {
  let node_fill;
  if (!lane) return false;

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

  if (lane.followup?._id) {
    links.push({
      id: `${lane._id}:${lane.followup._id}`,
      sid: lane._id,
      tid: lane.followup._id,
      source: lane._id,
      target: lane.followup._id,
      stroke: '#fa0',
    });

    if (node_ids.indexOf(lane.followup._id) == -1) {
      collect_graph_lists(Lanes.findOne(lane.followup._id));
    }
  }

  if (lane.salvage_plan?._id) {
    links.push({
      id: `${lane._id}:${lane.salvage_plan._id}`,
      sid: lane._id,
      tid: lane.salvage_plan._id,
      source: lane._id,
      target: lane.salvage_plan._id,
      stroke: '#0af',
    });

    if (node_ids.indexOf(lane.salvage_plan._id) == -1) {
      collect_graph_lists(Lanes.findOne(lane.salvage_plan._id));
    }
  }

  return { nodes, links, node_ids };
};

const build_graph = function () {
  nodes = [];
  links = [];
  node_ids = [];
  const lanes = Lanes.find().fetch();
  lanes.forEach(collect_graph_lists);
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
  svg_graph,
  collect_graph_lists,
  build_graph,
};
