import { Lanes } from '..';
import { Shipments } from '../../shipments';
import { Harbors } from '../../harbors';
import uuid from 'uuid';

Lanes.rawCollection().createIndex({ name: 1 }, { background: true });

Meteor.publish('Lanes', function () {
  return Lanes.find();
});

Meteor.methods({
  'Lanes#get_total': () => {
    return Lanes.find().count();
  },

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
    let shipment_id = Shipments.insert({
      start: shipment_start_date,
      actual: new Date(),
      lane: lane._id,
      stdin: [],
      stdout: [],
      stderr: [],
      active: true
    });

    manifest.shipment_start_date = shipment_start_date;
    manifest.shipment_id = shipment_id;
    lane.shipments = lane.shipments || [];
    lane.salvage_runs = lane.salvage_runs || [];
    lane.followups = lane.followups || [];
    lane.shipments.push(shipment_id);

    Lanes.update(lane._id, lane);

    console.log('Starting shipment for lane:', lane.name);
    try {
      new_manifest = $H.harbors[lane.type].work(lane, manifest);

    } catch (err) {
      console.error(
        'Shipment failed with error:\n',
        err + '\n',
        'for lane:\n',
        lane.name
      );
      manifest.error = err;
      new_manifest = manifest;

    } finally {

      if (new_manifest && new_manifest.error) {
        let exit_code = 1;
        let shipment = Shipments.findOne(shipment_id);

        shipment.stderr.push({
          date: new Date(),
          result: new_manifest.error.toString()
        });

        Shipments.update(shipment_id, shipment);

        return Meteor.call('Lanes#end_shipment', lane, exit_code, new_manifest);
      }

      return new_manifest;
    }
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

    let shipment_id = manifest.shipment_id;
    let finished = new Date();
    let next_shipment_start_date = $H.start_date();

    Shipments.update(shipment_id, {
      $set: {
        finished: finished,
        exit_code: exit_code,
        manifest: manifest,
        active: false
      }
    });

    console.log(
      'Shipping completed for lane:',
      lane.name,
      'with shipment:',
      shipment_id,
      'and exit code:',
      exit_code
    );

    let salvage_lane = Lanes.findOne(lane.salvage_plan);
    let followup_lane = Lanes.findOne(lane.followup);

    if (exit_code != 0 && salvage_lane) {
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

    if (exit_code == 0 && followup_lane) {
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

  'Lanes#reset_shipment': function (name, date) {
    let lane = Lanes.findOne({ name });
    let shipment = Shipments.findOne({ start: date, lane: lane._id });

    return Shipments.update(shipment._id, { $set: {
      active: false,
      exit_code: 1,
    }});
  },

  'Lanes#reset_all_active_shipments': function (name) {
    let lane = Lanes.findOne({ name });

    return Shipments.update(
      { lane: lane._id, active: true },
      { $set: {
        active: false,
        exit_code: 1,
      }},
      { multi: true }
    );
  },
});

