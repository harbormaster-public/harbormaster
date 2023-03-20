import H from '../../../startup/config/namespace';
import { Lanes } from '..';
import {
  Shipments,
  LatestShipment,
} from '../../shipments';
import { Harbors } from '../../harbors';
import uuid from 'uuid';
import _ from 'lodash';

Lanes.rawCollection().createIndex({ name: 1 }, { background: true });

const trim_manifest = (manifest) => {
  if (manifest.prior_manifest) delete manifest.prior_manifest;
  const trimmed = _.cloneDeep(manifest);
  
  return trimmed;
};

Meteor.publish('Lanes', function (lane = {}) {
  if (typeof lane == 'string') {
    const single = Lanes.find(
      { $or: [{ _id: lane }, { name: lane }, { slug: lane }] }
    );
    
    return single;
  }
  if (lane instanceof Array) return Lanes.find({ _id: { $in: lane }});
  return Lanes.find(lane);
});

console.log('Collecting latest shipments...');

Lanes.find().forEach((lane) => {
  console.log(`Finding latest shipment for ${lane.name}...`);

  if (!lane.last_shipment) {
    let shipment = Shipments.findOne(
      { lane: lane._id }, 
      { sort: { actual: -1 } }
    ) || { actual: 'Never', start: '' };
    lane.last_shipment = shipment;
    Lanes.update(lane._id, {$set:{ last_shipment: lane.last_shipment }});
    LatestShipment.upsert(lane._id, { shipment });
  }
});

console.log('Done collecting latest shipments.');

H.publish('LatestShipment', function () {
  return LatestShipment.find();
});

Meteor.methods({
  'Lanes#get_total': async () => {
    // return Lanes.find().count();  vvv supposed to be faster
    return await Lanes.estimatedDocumentCount();
  },

  'Lanes#update_webhook_token': function (lane_id, user_id, remove) {
    let lane = Lanes.findOne(lane_id);
    let token = uuid.v4().replace(/-/g, '_');

    if (lane.tokens && remove) {
      let tokens = _.invert(lane.tokens);
      delete tokens[user_id];
      lane.tokens = _.invert(tokens);
    }

    lane.tokens = lane.tokens || {};

    if (! remove) lane.tokens[token] = user_id;

    return Lanes.update(lane_id, {$set:{ tokens: lane.tokens }});
  },

  'Lanes#start_shipment': async function (id, manifest, shipment_start_date) {
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
      stdout: {},
      stderr: {},
      active: true,
    });
    LatestShipment.upsert(
      lane._id, 
      {$set: {shipment: Shipments.findOne(shipment_id)}}
    );

    lane.shipment_count = lane.shipment_count >= 0 ? 
      lane.shipment_count + 1 
      : 1
    ;
    manifest.shipment_start_date = shipment_start_date;
    manifest.shipment_id = shipment_id;
    Lanes.update(lane._id, {$set: { shipment_count: lane.shipment_count }});

    console.log('Starting shipment for lane:', lane.name);
    try { 
      new_manifest = await Meteor.bindEnvironment(
        H.harbors[lane.type].work(lane, manifest)
      ); 
    }
    catch (err) {
      console.error(
        'Shipment failed with error:\n',
        err + '\n',
        'for lane:\n',
        lane.name
      );
      manifest.error = err;
      new_manifest = manifest;
    }
    finally {

      if (new_manifest && new_manifest.error) {
        let exit_code = 1;
        let shipment = Shipments.findOne(shipment_id);
        let key = new Date();
        let result = new_manifest.error.toString();

        shipment.stderr[key] = (
          shipment.stderr[key] && shipment.stderr[key].length
        ) ?
          shipment.stderr[key] + result :
          result
        ;

        lane.last_shipment = shipment;
        Shipments.update(shipment_id, shipment);
        Lanes.update(lane._id, {$set: { last_shipment: lane.last_shipment }});
        LatestShipment.upsert(shipment.lane, { shipment });

        return await Meteor.call(
          'Lanes#end_shipment', 
          lane, 
          exit_code, 
          new_manifest
        );
      }

      return new_manifest;
    }
  },

  'Lanes#end_shipment': async function (lane, exit_code, manifest) {
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

    if (exit_code && exit_code != 0) {
      lane.salvage_runs = lane.salvage_runs >= 0 ? lane.salvage_runs + 1 : 1;
    }

    let shipment_id = manifest.shipment_id;
    let finished = new Date();
    let next_shipment_start_date = H.start_date();

    manifest.lane_id = lane._id;
    manifest.lane_name = lane.name;
    manifest.lane_slug = lane.slug;

    Shipments.update(shipment_id, {
      $set: {
        finished: finished,
        exit_code: exit_code,
        manifest: manifest,
        active: false,
      },
    });
    let shipment = Shipments.findOne(shipment_id);
    lane.last_shipment = shipment;
    Lanes.update(lane._id, {
      $set: {
        last_shipment: lane.last_shipment,
        salvage_runs: lane.salvage_runs
      }
    });
    
    LatestShipment.upsert(shipment.lane, { shipment });
    manifest.stdout = shipment.stdout;
    manifest.stderr = shipment.stderr;

    console.log(
      'Shipping completed for lane:',
      lane.name,
      'with shipment:',
      shipment_id,
      'and exit code:',
      exit_code
    );

    if (exit_code != 0 && lane.salvage_plan) {
      let salvage_manifest = Harbors.findOne(lane.salvage_plan.type)
        .lanes[lane.salvage_plan._id]
        .manifest
      ;
      salvage_manifest.prior_manifest = trim_manifest(manifest);
      
      console.log(
        `Starting shipment for "${
          lane.salvage_plan.name
        }" as salvage run of "${lane.name}"`
      );

      return await Meteor.call(
        'Lanes#start_shipment',
        lane.salvage_plan._id,
        salvage_manifest,
        next_shipment_start_date
      );
    }

    if (exit_code == 0 && lane.followup) {
      let followup_manifest = Harbors.findOne(lane.followup.type)
        .lanes[lane.followup._id]
        .manifest
      ;
      followup_manifest.prior_manifest = trim_manifest(manifest);
      
      console.log(
        `Starting shipment for "${
          lane.followup.name
        }" as followup of "${lane.name}"`
      );

      return await Meteor.call(
        'Lanes#start_shipment',
        lane.followup._id,
        followup_manifest,
        next_shipment_start_date
      );
    }

    return manifest;
  },

  'Lanes#reset_shipment': function (slug, date) {
    let lane = Lanes.findOne({ slug });
    let shipment = Shipments.findOne({ start: date, lane: lane._id });
    if (!shipment) shipment = Shipments.findOne(
      { lane: lane._id },
      { sort: { actual: -1 }},
    );
    
    Shipments.update(shipment._id, { $set: {
      active: false,
      exit_code: 1,
    }});

    LatestShipment.upsert(
      lane._id, 
      {$set: {shipment: Shipments.findOne(shipment._id)}}
    );

    lane.last_shipment = shipment ? 
      Shipments.findOne(shipment._id) :
      Shipments.findOne(
        { lane: lane._id },
        { sort: { actual: -1 }},
      )
    ;
    
    Lanes.update(lane._id, {$set: { last_shipment: lane.last_shipment }});

    return lane;
  },

  'Lanes#reset_all_active_shipments': function (name) {
    let lane = Lanes.findOne({ $or: [{ name }, { slug: name }] });
    
    Shipments.update(
      { lane: lane._id, active: true },
      { $set: {
        active: false,
        exit_code: 1,
      }},
      { multi: true }
    );

    lane.latest_shipment = Shipments.findOne(
      { lane: lane._id },
      { sort: { actual: -1 }},
    );
    LatestShipment.upsert(lane._id, {shipment: lane.latest_shipment});
    Lanes.update(lane._id, {$set: { last_shipment: lane.last_shipment }});

    return lane;
  },

  'Lanes#update_slug': (lane) => {
    Lanes.update(
      { _id: lane._id },
      { $set: {
        slug: lane.slug,
      }}
    );

    return true;
  },

  'Lanes#delete': function (lane) {
    Lanes.remove(lane);
    const harbor = Harbors.findOne(lane.type);
    delete harbor.lanes[lane._id];
    Harbors.update(harbor._id, harbor);
    console.log(`Deleted lane: ${lane.name}`);
    return H.call('Lanes#get_total');
  },

  'Lanes#upsert': function (lane) {
    const { _id } = lane;

    if (_id && Lanes.findOne(_id)) Lanes.update({ _id }, lane);
    else Lanes.insert(lane);

    return true;
  },

  'Lanes#duplicate': (lane) => {
    const increment = get_increment(lane);
    const harbor = Harbors.findOne(lane.type);
    const manifest = harbor.lanes[lane._id].manifest;
    const replacement_regex = /\d+$/g;
    
    console.log(`Duplicating lane ${lane.name}...`);
    delete lane.last_shipment;
    delete lane._id;
    delete lane.tokens;
    lane.shipment_count = 0;
    lane.salvage_runs = 0;
    lane.name = `${lane.name.replace(replacement_regex, '')}${increment}`;
    lane.slug = `${lane.slug.replace(replacement_regex, '')}${increment}`;
    const new_lane_id = Lanes.insert(lane);
    harbor.lanes[new_lane_id] = { manifest };
    Harbors.update(harbor._id, harbor);
    console.log(`New lane created: ${lane.name}`);
    return `/lanes/${lane.slug}/edit`;
  },
});

const increment_regex = /(.*?)(\d+)$/;

function get_increment(lane) {
  let increment = 2;
  let dupe_slug = `${lane.slug}-${increment}`;
  const slug_match = lane.slug.match(increment_regex);
  if (slug_match?.length) {
    increment = parseInt(slug_match[2], 10);
    increment += 1;
    dupe_slug = `${slug_match[1]}${increment}`;
  }
  console.log(`Checking for exsting lane: ${dupe_slug}`);
  let existing_dupe = Lanes.findOne({ slug: dupe_slug });
  if (existing_dupe) {
    console.log(`Lane ${dupe_slug} already exists.`);
    return get_increment(existing_dupe);
  }
  console.log(`No duplicate found for ${dupe_slug}, using it.`);
  return increment;
}
