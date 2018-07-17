import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Lanes } from '../../../../api/lanes';
import { Shipments } from '../../../../api/shipments';
import { get_lane } from '../lib/util';

import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

cytoscape.use(dagre);

const ROOT = 'ROOT';
const FOLLOWUP = 'FOLLOWUP';
const SALVAGE = 'SALVAGE';
const TOP_PADDING = 185;
const FOLLOWUP_COLOR = '#0af';
const SALVAGE_COLOR = '#fa0';
const ROOT_COLOR = '#f0a';
const SUCCESS_COLOR = '#3adb76';
const FAIL_COLOR = 'red';
const node_list = new ReactiveVar([]);

Template.charter.onCreated(function () {
  let options = {
    sort: { actual: -1 },
    limit: 1,
  };

  this.autorun(() => {
    let list = node_list.get();

    list.forEach((node) => {
      H.subscribe('Lanes', node.data.lane);
      H.subscribe('Shipments', node.data.lane, options);
    });
  });
});

Template.charter.onRendered(function () {

  let draw_height = $('body').height();
  $('#graph').height(draw_height - TOP_PADDING);

  let cy = cytoscape({
    container: $('#graph'),
    style: [
      {
        selector: 'node',
        style: {
          'content': 'data(name)',
          'background-color': 'data(color)',
          'border-width': '3px',
          'border-color': 'data(border)',
        },
      },
      {
        selector: 'edge',
        style: {
          'mid-target-arrow-color': 'data(color)',
          'mid-target-arrow-shape': 'triangle',
          'mid-target-arrow-fill': 'filled',
          'arrow-scale': 2,
        },
      },
    ],
  });

  $('#graph').on('mouseout', () => document.body.style.cursor = '');
  cy.on('mouseout', 'node', () => document.body.style.cursor = '');
  cy.on('mouseover', 'node', () => document.body.style.cursor = 'pointer');
  cy.on('tap', 'node', (e) => {
    let data = e.target.data();
    let start = data.shipment ? `/ship/${data.shipment.start}` : '/charter';
    let url = `/lanes/${data.lane.slug}${start}`;
    document.body.style.cursor = '';
    FlowRouter.go(url);
  });

  this.autorun(() => {
    let graph = node_list.get();
    cy.remove('node');
    cy.add(graph);
    cy.layout({
      name: 'dagre',
      fit: true,
      rankDir: 'LR',
      nodeDimensionsIncludeLabels: true,
    }).run();
  });
});

Template.charter.helpers({

  lane () {
    let name = FlowRouter.getParam('name');
    let lane = get_lane(name);

    return lane;
  },

  build_graph () {
    let name = FlowRouter.getParam('name');
    let lane = get_lane(name);
    let list = [];
    if (! lane) return false;

    let assign_children = (target, parent) => {
      let followup = Lanes.findOne(target.followup);
      let plan = Lanes.findOne(target.salvage_plan);

      if (followup && ! target.recursive && followup._id != parent) {
        let last_shipment = Shipments.findOne({ lane: followup._id });
        let color = FOLLOWUP_COLOR;

        if (last_shipment && last_shipment.exit_code) color = FAIL_COLOR;
        else if (
          last_shipment && last_shipment.exit_code == 0
        ) color = SUCCESS_COLOR;

        followup.role = FOLLOWUP;
        followup.parent = target._id;
        followup.recursive = followup._id == target._id ? true : false;
        target.children.push(followup);
        list.push({
          group: 'nodes',
          data: {
            id: followup._id,
            name: followup.name,
            color,
            border: FOLLOWUP_COLOR,
            lane: followup,
            shipment: Shipments.findOne({ lane: followup._id }),
          },
        }, {
          group: 'edges',
          data: {
            source: target._id,
            target: followup._id,
            color: FOLLOWUP_COLOR,
          },
        });
      }

      if (plan && ! target.recursive && plan._id != parent) {
        let last_shipment = Shipments.findOne({ lane: followup._id });
        let color = SALVAGE_COLOR;

        if (
          last_shipment && last_shipment.exit_code == 0
        ) color = SUCCESS_COLOR;
        else if (last_shipment && last_shipment.exit_code) color = FAIL_COLOR;

        plan.role = SALVAGE;
        plan.parent = target._id;
        plan.recursive = plan._id == target._id ? true : false;
        target.children.push(plan);
        list.push({
          group: 'nodes',
          data: {
            id: plan._id,
            name: plan.name,
            color,
            border: SALVAGE_COLOR,
            lane: plan,
            shipment: Shipments.findOne({ lane: plan._id }),
          },
        }, {
          group: 'edges',
          data: {
            source: target._id,
            target: plan._id,
            color: SALVAGE_COLOR,
          },
        });
      }

      target.children.forEach((child) => {
        child.children = [];
        if (! child.recursive) assign_children(child, target._id);
      });

      return target;
    };

    lane.children = [];
    lane.role = ROOT;
    let last_shipment = Shipments.findOne({ lane: lane._id });
    let color = ROOT_COLOR;
    if (last_shipment && last_shipment.exit_code) color = FAIL_COLOR;
    else if (
      last_shipment && last_shipment.exit_code == 0
    ) color = SUCCESS_COLOR;

    list.push({
      group: 'nodes',
      data: {
        id: lane._id,
        name: lane.name,
        color,
        border: ROOT_COLOR,
        lane: lane,
        shipment: last_shipment,
      },
    });
    lane = assign_children(lane);

    node_list.set(list);

    return '';
  },

});
