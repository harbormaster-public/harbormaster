import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Lanes } from '../../../../api/lanes';
import { Shipments } from '../../../../api/shipments';
import { get_lane } from '../lib/util';

import cytoscape from 'cytoscape';

const ROOT = 'ROOT';
const FOLLOWUP = 'FOLLOWUP';
const SALVAGE = 'SALVAGE';
const TOP_PADDING = 185;
const FOLLOWUP_COLOR = '#0af';
const SALVAGE_COLOR = '#fa0';
const ROOT_COLOR = '#f0a';
const root_lane = new ReactiveVar({});
const node_list = new ReactiveVar([]);

Template.charter.onCreated(function () {
  let options = {
    sort: { actual: -1 },
    limit: 1,
  };

  this.autorun(() => {
    Meteor.subscribe('Lanes');
    Lanes.find().forEach((lane) => {
      Meteor.subscribe('Shipments', lane, options);
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

  this.autorun(() => {
    let graph = node_list.get();
    cy.add(graph);
    cy.layout({
      name: 'circle',
      fit: true,
      avoidOverlap: true,
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

    let assign_children = (target) => {
      let followup = Lanes.findOne(target.followup);
      let plan = Lanes.findOne(target.salvage_plan);
      if (followup && ! target.recursive) {
        followup.role = FOLLOWUP;
        followup.parent = target._id;
        followup.recursive = followup._id == target._id ? true : false;
        target.children.push(followup);
        list.push({
          group: 'nodes',
          data: {
            id: followup._id,
            name: followup.name,
            color: FOLLOWUP_COLOR,
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

      if (plan && ! target.recursive) {
        plan.role = SALVAGE;
        plan.parent = target._id;
        plan.recursive = plan._id == target._id ? true : false;
        target.children.push(plan);
        list.push({
          group: 'nodes',
          data: {
            id: plan._id,
            name: plan.name,
            color: SALVAGE_COLOR,
          },
        }, {
          data: {
            group: 'edges',
            source: target._id,
            target: plan._id,
            color: SALVAGE_COLOR,
          },
        });
      }

      target.children.forEach((child) => {
        child.children = [];
        if (! child.recursive) assign_children(child);
      });

      return target;
    };

    lane.children = [];
    lane.role = ROOT;

    list.push({
      group: 'nodes',
      data: {
        id: lane._id,
        name: lane.name,
        color: ROOT_COLOR,
      },
    });
    lane = assign_children(lane);

    node_list.set(list);
    root_lane.set(lane);

    return '';
  },

});
