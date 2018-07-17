import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Lanes } from '../../../../api/lanes';
import { Shipments } from '../../../../api/shipments';
import { get_lane } from '../lib/util';

import * as d3 from 'd3';

const ROOT = 'ROOT';
const FOLLOWUP = 'FOLLOWUP';
const SALVAGE = 'SALVAGE';
const TOP_PADDING = 185;
const FOLLOWUP_COLOR = '#0af';
const SALVAGE_COLOR = '#fa0';
const root_lane = new ReactiveVar({});
const width = new ReactiveVar(0);
const height = new ReactiveVar(0);

Template.charter.onCreated(function () {
  let options = {
    sort: { actual: -1 },
    limit: 1
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

  width.set($('#graph').outerWidth());
  height.set($('#graph').outerHeight());

  let treemap = d3.tree().size([width.get(), height.get()]);

  let svg = d3.select('#graph').append('svg')
    .attr('width', width.get())
    .attr('height', height.get());

  let g = svg.append('g')
    .attr('transform', 'translate(0, 50)');

  window.onresize = () => {
    width.set($('#graph').outerWidth());
    height.set($('#graph').outerHeight());
  };

  this.autorun(() => {
    let nodes = treemap(d3.hierarchy(root_lane.get()));

    treemap.size([width.get(), height.get()]);
    svg.attr('width', width.get()).attr('height', height.get());

    d3.selectAll('circle')
      .attr('fill', (d) => {
        let latest_shipment = Shipments.findOne({ lane: d.data._id });
        let fill_color;

        if (
          ! latest_shipment ||
          (! latest_shipment.exit_code && latest_shipment.exit_code != 0)
        ) {
          fill_color = 'transparent';
          return fill_color;
        }

        if (latest_shipment.exit_code == 0) {
          fill_color = 'rgba(0, 255, 0, 0.25)';
        }

        if (latest_shipment.exit_code > 0) {
          fill_color = 'rgba(255, 0, 0, 0.25)';
        }

        return fill_color;
      })
    ;
    d3.selectAll('.charter-link')
      .attr('xlink:href', (d) => {
        let latest_shipment = Shipments.findOne({ lane: d.data._id });
        let start = latest_shipment && latest_shipment.start ?
          latest_shipment.start :
          ''
        ;
        let url = `/lanes/${d.data.slug}/ship/${start}`;
        return url;
      })
    ;

    g.selectAll('.node')
      .data(nodes.descendants())
      .enter().append('path')
      .attr('d', (d) => {
        if (! d.parent) return '';
        return `M${d.x},${d.y / 2}
          C${d.x},${(d.y + d.parent.y) / 4}
           ${d.parent.x},${(d.y + d.parent.y) / 4}
           ${d.parent.x},${d.parent.y}
        `;
      })
      .attr('fill', 'none')
      .attr('stroke', (d) => {
        let stroke_color;
        switch (d.data.role) {
          case 'FOLLOWUP':
            stroke_color = FOLLOWUP_COLOR;
            break;
          case 'SALVAGE':
            stroke_color = SALVAGE_COLOR;
            break;
          default:
            stroke_color = '#f09';
            break;
        }

        return stroke_color;
      })
    ;
    let node = g.selectAll('.node')
      .data(nodes.descendants())
      .enter()
    ;
    let group = node.append('g')
      .attr("class", (d) => {
        return "node" + (d.children ? " node-internal" : " node-leaf");
      })
      .attr("transform", (d) => {
        return "translate(" + d.x + "," + d.y / 2 + ")";
      })
    ;
    let a = group.append('a')
      .attr('class', 'charter-link')
    ;

    a.append('circle')
      .attr('r', 15)
      .attr('stroke', (d) => {
        let stroke_color;
        switch (d.data.role) {
          case 'FOLLOWUP':
            stroke_color = FOLLOWUP_COLOR;
            break;
          case 'SALVAGE':
            stroke_color = SALVAGE_COLOR;
            break;
          default:
            stroke_color = '#f09';
            break;
        }

        return stroke_color;
      })
      .attr('fill', (d) => {
        let latest_shipment = Shipments.findOne(
          { lane: d.data._id },
          { $sort: { finished: -1 }, limit: 1 }
        );
        let fill_color;

        if (! latest_shipment) return fill_color = 'transparent';

        if (latest_shipment.exit_code == 0) {
          fill_color = 'rgba(0, 255, 0, 0.25)';
        }

        if (latest_shipment.exit_code > 0) {
          fill_color = 'rgba(255, 0, 0, 0.25)';
        }

        return fill_color;
      })
    ;
    a.append('text')
      .attr('y', (d) => { return d.children ? -20 : 40; })
      .style('text-anchor', 'middle')
      .text((d) => { return d.data.name; })
      .attr('stroke', 'none')
      .attr('fill', (d) => {
        let fill_color;
        switch (d.data.role) {
          case 'FOLLOWUP':
            fill_color = FOLLOWUP_COLOR;
            break;
          case 'SALVAGE':
            fill_color = SALVAGE_COLOR;
            break;
          default:
            fill_color = '#f09';
            break;
        }

        return fill_color;
      })
    ;
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
    if (! lane) return false;

    let assign_children = (target) => {
      if (target.followup && ! target.recursive) {
        let followup = Lanes.findOne(target.followup);
        followup.role = FOLLOWUP;
        followup.recursive = followup._id == target._id ? true : false;
        target.children.push(followup);
      }

      if (target.salvage_plan && ! target.recursive) {
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

    root_lane.set(lane);

    return '';
  }

});
