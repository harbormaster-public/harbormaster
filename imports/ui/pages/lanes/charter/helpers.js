import { Template } from 'meteor/templating';
import { Lanes } from '../../../../api/lanes';
import { Shipments } from '../../../../api/shipments';

import * as d3 from 'd3';

const ROOT = 'ROOT';
const FOLLOWUP = 'FOLLOWUP';
const SALVAGE = 'SALVAGE';
const TOP_PADDING = 185;
const FOLLOWUP_COLOR = '#0af';
const SALVAGE_COLOR = '#fa0';

Template.charter.onCreated(function () {
  let options = {
    sort: { actual: -1 },
    limit: 1,
  };

  Lanes.find().forEach((lane) => {
    Meteor.subscribe('Shipments', lane, options);
  });
});

Template.charter.onRendered(function () {
  this.autorun(() => {
    let shipments = Shipments.find().fetch(); // Triggers autorun

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
        let url = `/lanes/${d.data.name}/ship/${start}`;
        return url;
      })
    ;
  });

  let draw_height = $('body').height();
  $('#graph').height(draw_height - TOP_PADDING);

  let lane = Session.get('charter_tree') || {};

  let width = $('#graph').outerWidth();
  let height = $('#graph').outerHeight();

  let treemap = d3.tree().size([width, height]);
  let nodes = treemap(d3.hierarchy(lane));

  let svg = d3.select('#graph').append('svg')
    .attr('width', width)
    .attr('height', height);
  let g = svg.append('g')
    .attr('transform', 'translate(0, 50)');
  let link = g.selectAll('.link')
    .data(nodes.descendants().slice(1))
    .enter().append('path')
    .attr('d', (d) => {
      return "M" + d.x + "," + d.y / 4
        + "C" + d.x + "," + (d.y + d.parent.y) / 8
        + " " + d.parent.x + "," + (d.y + d.parent.y) / 8
        + " " + d.parent.x + "," + d.parent.y / 4;
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
    .enter().append('g')
    .attr("class", (d) => {
      return "node" + (d.children ? " node-internal" : " node-leaf");
    })
    .attr("transform", (d) => {
      return "translate(" + d.x + "," + d.y / 4 + ")";
    })
    .append('a')
    .attr('class', 'charter-link')
  ;

  node.append('circle')
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
      let latest_shipment_id = d.data.shipments[d.data.shipments.length - 1];
      let latest_shipment = Shipments.findOne(latest_shipment_id);
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
  node.append('text')
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

Template.charter.helpers({

  lane () {
    let name = FlowRouter.getParam('name');
    let lane = Lanes.findOne({ name: name });

    return lane;
  },

  build_graph () {
    let name = FlowRouter.getParam('name');
    let lane = Lanes.findOne({ name: name });
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

    Session.set('charter_tree', lane);

    return;
  },

});
