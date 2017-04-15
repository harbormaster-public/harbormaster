import { Lanes } from '../lanes';
import { Shipments } from '../../shipments/shipments';
import { Harbors } from '../../harbors';
import uuid from 'uuid';

Meteor.publish('Lanes', function () {
  return Lanes.find();
});

Meteor.methods({
  'Lanes#update_webhook_token': function (lane_id, user_id, remove) {
    let lane = Lanes.findOne(lane_id);
    let token = uuid.v4();

    if (lane.tokens && remove) {
      let tokens = _.invert(lane.tokens);
      delete tokens[user_id];
      lane.tokens = tokens;
    }

    lane.tokens = lane.tokens || {};

    if (! remove) lane.tokens[token] = user_id;

    return Lanes.update(lane_id, lane);
  },

  'Lanes#start_shipment': function (id, manifest, shipment_start_date) {
    if (
      typeof id != 'string' ||
      (manifest && typeof manifest != 'object') ||
      ! shipment_start_date
    ) {
      throw new TypeError(
        'Improper arguments for "Lanes#start_shipment" method!', '\n',
        'The first argument must be a String; the _id of the lane.', '\n',
        'The second argument, if present, must be an object;' +
          'parameters to pass to the Harbor.\n' +
        'The third argument must be the shipment start date.'
      );
    }

    let lane = Lanes.findOne(id);
    let new_manifest;

    manifest.shipment_start_date = shipment_start_date;
    lane.shipment_active = true;
    lane.shipments = lane.shipments || [];
    lane.salvage_runs = lane.salvage_runs || [];
    lane.followups = lane.followups || [];
    lane.shipments.push(
      Shipments.insert({
        start: shipment_start_date,
        actual: new Date(),
        lane: lane._id
      })
    );
    Lanes.update(lane._id, lane);

    console.log('Starting shipment for lane:', lane.name);
    try {
      new_manifest = $H.harbors[lane.type].work(lane, manifest);
    } catch (err) {
      console.error(err);
      manifest.error = err;
      new_manifest = manifest;
    }

    if (manifest.error && lane.salvage_plan) {
      let exit_code = 1;
      return Meteor.call('Lanes#end_shipment', lane, exit_code, new_manifest);
    }

    return new_manifest;
  },

  'Lanes#end_shipment': function (lane, exit_code, manifest) {
    if (
      typeof lane._id != 'string' ||
      (typeof exit_code != 'string' && typeof exit_code != 'number') ||
      (manifest && typeof manifest != 'object')
    ) {
      throw new TypeError(
        'Invalid arguments for "Lanes#end_shipment" method!', '\n',
        'The first argument must be a reference to a lane object.', '\n',
        'The second argument must be the exit code of the finished work; ' +
          'An Integer or String representing one.', '\n',
        'The third argument, if present, must be an object;' +
          'The (modified) manifest object originally passed to the Harbor.'
      );
    }

    let date = manifest.shipment_start_date;
    let finished = new Date();
    let next_date = finished;
    //TODO: share w/ client code
    let next_shipment_start_date = next_date.getFullYear() + '-' +
      next_date.getMonth() + '-' +
      next_date.getDate() + '-' +
      next_date.getHours() + '-' +
      next_date.getMinutes() + '-' +
      next_date.getSeconds()
    ;


    Shipments.update({ start: date, lane: lane._id }, {
      $set: {
        finished: finished,
        exit_code: exit_code,
        manifest: manifest
      }
    });

    lane.shipment_active = false;
    Lanes.update(lane._id, lane);
    console.log('Shipping completed for lane:', lane.name);

    if (exit_code != 0 && lane.salvage_plan) {
      let salvage_lane = Lanes.findOne(lane.salvage_plan);
      let salvage_manifest = Harbors.findOne(salvage_lane.type)
        .lanes[salvage_lane._id]
        .manifest
      ;
      salvage_manifest.prior_manifest = manifest;
      lane.salvage_runs.push(next_shipment_start_date);
      Lanes.update(lane._id, lane);

      return Meteor.call(
        'Lanes#start_shipment',
        salvage_lane._id,
        salvage_manifest,
        next_shipment_start_date
      );
    }

    if (exit_code == 0 && lane.followup) {
      let followup_lane = Lanes.findOne(lane.followup);
      let followup_manifest = Harbors.findOne(followup_lane.type)
        .lanes[followup_lane._id]
        .manifest
      ;
      followup_manifest.prior_manifest = manifest;
      lane.followups.push(next_shipment_start_date);
      Lanes.update(lane._id, lane);

      return Meteor.call(
        'Lanes#start_shipment',
        followup_lane._id,
        followup_manifest,
        next_shipment_start_date
      );
    }

    return manifest;
  },

  'Lanes#reset_shipment': function (name) {
    let lane = Lanes.findOne({ name: name });

    lane.shipment_active = false;

    return Lanes.update(lane._id, lane);
  }
});

