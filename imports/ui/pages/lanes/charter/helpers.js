import { Template } from 'meteor/templating';
import { Lanes } from '../../../../api/lanes';
import { Session } from 'meteor/session';
import { Shipments } from '../../../../api/shipments';

import SVG from 'svg';

//TODO: Handle multiples of the same lane and recursion
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
    });

    return line;
  })

  return $svg_spans;
});

Template.charter.helpers({

  lane () {
    let name = FlowRouter.getParam('name');
    let lane = Session.get('lane') || Lanes.findOne({ name: name });

    return lane;
  },

  charter_lanes () {
    let name = FlowRouter.getParam('name');
    let lane = Session.get('lane') || Lanes.findOne({ name: name });
    let charter_lanes = [];
    let lanes_covered = {};
    let starting_index = 0;
    let starting_lane_list = [{ lane: lane }];

    if (! lane) return false;

    //TODO: Handle recursive references
    function get_charter_lanes (index, list) {
      let indexed_lanes = [];

      _.each(list, function (entry) {
        if (entry.lane.followup) {
          indexed_lanes.push({
            lane: Lanes.findOne(entry.lane.followup),
            type: 'followup',
            parent: entry.lane._id
          });
        }

        if (entry.lane.salvage_plan) {
          indexed_lanes.push({
            lane: Lanes.findOne(entry.lane.salvage_plan),
            type: 'salvage',
            parent: entry.lane._id
          });
        }
      });

      if (indexed_lanes.length) {
        charter_lanes[index] = indexed_lanes;
        starting_index++;
        get_charter_lanes(starting_index, indexed_lanes);
      }

      return charter_lanes;
    }

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
