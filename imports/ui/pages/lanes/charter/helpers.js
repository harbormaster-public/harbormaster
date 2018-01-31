import { Template } from 'meteor/templating';
import { Lanes } from '../../../../api/lanes';
import { Shipments } from '../../../../api/shipments';

import SVG from 'svg.js';

import * as d3 from 'd3';

const ROOT = 'ROOT';
const FOLLOWUP = 'FOLLOWUP';
const SALVAGE = 'SALVAGE';

Template.charter.onRendered(function () {
  let $svg_spans = this.$('.svg-path');

  _.each($svg_spans, function (span) {
    const FOLLOWUP_COLOR = '#0af';
    const SALVAGE_COLOR = '#fa0';
    let width = span.offsetWidth;
    let height = span.offsetHeight;
    let draw = SVG(span.id).size(width, height);
    let $span = $(span);
    let $parent = $('#' + $span.attr('data-parent'));
    let $child = $('#' + $span.attr('data-child'));
    let offset = 10;
    let start_y = 0;
    let start_x = $parent.position().left + ($parent.outerWidth() / 2) + offset;
    let end_y = $span.outerHeight();
    let end_x = $child.position().left + ($child.outerWidth() / 2) + offset;
    let line = draw.line(start_x, start_y, end_x, end_y).stroke({
      width: 1,
      color: $child.hasClass('followup-lane') ?
        FOLLOWUP_COLOR :
        SALVAGE_COLOR
      ,
    });

    return line;
  });

  return $svg_spans;
});

Template.charter.helpers({

  lane () {
    let name = FlowRouter.getParam('name');
    let lane = Lanes.findOne({ name: name });

    return lane;
  },

  build_graph () {
    return false;
    let name = FlowRouter.getParam('name');
    let lane = Lanes.findOne({ name: name });
    let assign_children = (target) => {
      if (target.followup && target.followup != target._id) {
        let followup = Lanes.findOne(target.followup);
        followup.role = FOLLOWUP;
        followup.recursive = followup._id == target._id ? true : false;
        target.children.push(followup);
      }

      if (target.salvage_plan && target.salvage_plan != target._id) {
        let plan = Lanes.findOne(target.salvage_plan);
        plan.role = SALVAGE;
        plan.recursive = plan._id == target._id ? true : false;
        target.children.push(plan);
      }

      target.children.forEach((child) => {
        child.children = [];
        if (! child.recursive) assign_children(child);
      });

      return target;
    };

    lane.children = [];
    lane.role = ROOT;

    lane = assign_children(lane);

    let width = 1024;
    let height = 768;

    let treemap = d3.tree().size([width, height]);
    let nodes = treemap(d3.hierarchy(lane));

    let svg = d3.select('.graph').append('svg')
      .attr('width', width)
      .attr('height', height);
    let g = svg.append('g')
      .attr('transform', 'translate(0,0)');
    let link = g.selectAll('.link')
      .data(nodes.descendants().slice(1))
      .enter().append('path')
      .attr('d', (d) => {
        return "M" + d.x + "," + d.y
          + "C" + d.x + "," + (d.y + d.parent.y) / 2
          + " " + d.parent.x + "," + (d.y + d.parent.y) / 2
          + " " + d.parent.x + "," + d.parent.y;
      });
    let node = g.selectAll('.node')
      .data(nodes.descendants())
      .enter().append('g')
      .attr("class", (d) => {
        return "node" + (d.children ? " node--internal" : " node--leaf");
      })
      .attr("transform", (d) => {
        return "translate(" + d.x + "," + d.y + ")";
      });

    node.append('circle').attr('r', 10);
    node.append('text')
      .attr('dy', '.35em')
      .attr('y', (d) => { return d.children ? -20 : 20; })
      .style('text-anchor', 'middle')
      .text((d) => { return d.data.name; });

    //return lane;
  },

  charter_lanes () {
    let name = FlowRouter.getParam('name');
    let lane = Lanes.findOne({ name: name });
    let charter_lanes = [];
    let starting_index = 0;
    let starting_lane_list = [{ lane: lane }];

    if (! lane) return false;

    //TODO: Handle recursive references
    let get_charter_lanes = function get_charter_lanes (index, list) {
      let indexed_lanes = [];

      _.each(list, function (entry) {
        if (entry.lane.followup) {
          indexed_lanes.push({
            lane: Lanes.findOne(entry.lane.followup),
            type: 'followup',
            parent: entry.lane._id,
          });
        }

        if (entry.lane.salvage_plan) {
          indexed_lanes.push({
            lane: Lanes.findOne(entry.lane.salvage_plan),
            type: 'salvage',
            parent: entry.lane._id,
          });
        }
      });

      if (indexed_lanes.length) {
        charter_lanes[index] = indexed_lanes;
        starting_index++;
        get_charter_lanes(starting_index, indexed_lanes);
      }

      return charter_lanes;
    };

    return get_charter_lanes(starting_index, starting_lane_list);
  },

  exit_code () {
    let name = FlowRouter.getParam('name');
    let lane = this.lane || Lanes.findOne({ name: name });
    let shipments = Shipments.find(
      { lane: lane._id },
      { sort: { actual: -1 } }
    ).fetch();
    let exit_code = shipments.length ?
      shipments[0].exit_code :
      false
    ;

    return exit_code;
  },

  active () {
    let name = FlowRouter.getParam('name');
    let lane = this.lane || Lanes.findOne({ name: name });
    let shipments = Shipments.find({
      lane: lane._id,
      active: true
    }).fetch();

    return shipments.length ? 'active' : false;
  }
});
