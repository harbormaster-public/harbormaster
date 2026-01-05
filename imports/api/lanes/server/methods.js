import H from '../../../startup/config/namespace';
import { Lanes } from '..';
import {
  Shipments,
  LatestShipment,
} from '../../shipments';
import { Harbors } from '../../harbors';
import { v4 as uuidv4 } from 'uuid';
import _ from 'lodash';
import YAML from 'yaml';

const trim_manifest = (manifest) => {
  if (manifest.prior_manifest) delete manifest.prior_manifest;
  const trimmed = _.cloneDeep(manifest);

  return trimmed;
};

const collect_latest_shipments = async function () {
  /* istanbul ignore next */
  if (!H.isTest) console.log('Collecting latest shipments...');

  const lanes = await Lanes.find({}).fetchAsync();
  for (const lane of lanes) {
  /* istanbul ignore next */
    if (!H.isTest) console.log(`Finding latest shipment for ${lane.name}...`);

    /* istanbul ignore else */
    if (!lane.last_shipment) {
      let shipment = await Shipments.findOneAsync(
        { lane: lane._id },
        { sort: { actual: -1 } },
      ) || { actual: 'Never', start: '' };
      lane.last_shipment = shipment;
      await Lanes.updateAsync(
        { _id: lane._id },
        { $set: { last_shipment: lane.last_shipment } },
      );
      await LatestShipment.upsertAsync(
        { _id: lane._id },
        { $set: { shipment } },
      );
    }
  }

  /* istanbul ignore next */
  if (!H.isTest) console.log('Done collecting latest shipments.');
};

const get_increment = async function (lane, increment = 2) {
  if (!lane || !lane.slug) return increment;
  const increment_regex = /(.*?)(\d+)$/;
  const slug_match = lane.slug.match(increment_regex);
  // If the base lane slug already ends with digits, we want duplicates like:
  // - test-23 -> test-24
  // and on recursive calls we MUST honor the provided `increment` rather than
  // re-parsing from lane.slug (which would reset the sequence).
  const baseSlug = slug_match ? slug_match[1] : lane.slug;
  const initialFromSlug = slug_match ? (parseInt(slug_match[2], 10) + 1) : null;
  const effectiveIncrement = (slug_match && increment === 2) ?
    initialFromSlug :
    increment;

  let dupe_slug = slug_match ?
    `${baseSlug}${effectiveIncrement}` :
    `${lane.slug}-${effectiveIncrement}`;
  /* istanbul ignore next */
  if (!H.isTest) console.log(`Checking for exsting lane: ${dupe_slug}`);
  let existing_dupe = await Lanes.findOneAsync({ slug: dupe_slug });
  if (existing_dupe) {
    /* istanbul ignore next */
    if (!H.isTest) console.log(`Lane ${dupe_slug} already exists.`);
    const existing_match = existing_dupe.slug.match(increment_regex);
    /* istanbul ignore else */
    if (existing_match) {
      const existing_num = parseInt(existing_match[2], 10);
      const next_increment = existing_num + 1;
      const next_slug = `${existing_match[1]}${next_increment}`;
      const next_exists = await Lanes.findOneAsync({ slug: next_slug });
      if (next_exists) {
        return await get_increment(existing_dupe, next_increment);
      }
      return next_increment;
    }
    // If existing dupe doesn't match increment pattern,
    // increment from the current value
    return await get_increment(existing_dupe, effectiveIncrement + 1);
  }
  /* istanbul ignore next */
  if (!H.isTest) {
    console.log(`No duplicate found for ${dupe_slug}, using it.`);
  }
  return Number(effectiveIncrement);
};

const publish_lanes = function publish_lanes (view, slug) {
  let published;
  switch (view) {
    case '/':
      published = Lanes.find({}, { fields: {
        _id: 1,
        name: 1,
        slug: 1,
        'last_shipment.exit_code': 1,
        'last_shipment.active': 1,
        'followup._id': 1,
        'followup.slug': 1,
        'salvage_plan._id': 1,
        'salvage_plan.slug': 1,
      } });
      break;
    case '/lanes':
      published = Lanes.find({}, { fields: {
        _id: 1,
        name: 1,
        captains: 1,
        slug: 1,
        type: 1,
        shipment_count: 1,
        salvage_runs: 1,
        'last_shipment.actual': 1,
        'last_shipment.start': 1,
        'last_shipment.exit_code': 1,
        'last_shipment.active': 1,
        'followup.name': 1,
        'followup.slug': 1,
        'salvage_plan.name': 1,
        'salvage_plan.slug': 1,
      } });
      break;
    case '/charter':
      //TODO: filter this by the lane slug, and its downstreams
      published = Lanes.find({}, { fields: {
        _id: 1,
        name: 1,
        slug: 1,
        'last_shipment.exit_code': 1,
        'last_shipment.active': 1,
        'followup._id': 1,
        'followup.slug': 1,
        'salvage_plan._id': 1,
        'salvage_plan.slug': 1,
      } });
      break;
    case '/edit':
      published = Lanes.find({ slug }, { fields: {
        _id: 1,
        name: 1,
        captains: 1,
        slug: 1,
        type: 1,
        rendered_input: 1,
        minimum_complete: 1,
        tokens: 1,
        'last_shipment._id': 1,
        'last_shipment.start': 1,
        'last_shipment.actual': 1,
        'last_shipment.finished': 1,
        'last_shipment.exit_code': 1,
        'last_shipment.active': 1,
        'followup._id': 1,
        'followup.slug': 1,
        'followup.name': 1,
        'followup.type': 1,
        'salvage_plan._id': 1,
        'salvage_plan.slug': 1,
        'salvage_plan.name': 1,
        'salvage_plan.type': 1,
      } });
      break;
    case '/downstreams':
      published = Lanes.find({}, { fields: {
        _id: 1,
        slug: 1,
        name: 1,
      } });
      break;
    case '/log':
      published = Lanes.find( { slug }, { fields: {
        _id: 1,
        shipment_count: 1,
        'last_shipment.exit_code': 1,
        'last_shipment.active': 1,
      } },
      );
      break;
    case '/ship':
      published = Lanes.find({ slug }, { fields: {
        _id: 1,
        name: 1,
        captains: 1,
        slug: 1,
        type: 1,
        rendered_work_preview: 1,
        'last_shipment.exit_code': 1,
        'last_shipment.active': 1,
        'last_shipment.stdout': 1,
        'last_shipment.stderr': 1,
        'last_shipment.manifest': 1,
        'last_shipment.finished': 1,
        'followup.slug': 1,
        'followup.name': 1,
        'salvage_plan.slug': 1,
        'salvage_plan.name': 1,
      } });
      break;
    case '/profile':
      published = Lanes.find({}, { fields: {
        _id: 1,
        name: 1,
        slug: 1,
        tokens: 1,
        captains: 1,
      } });
      break;
    default:
      break;
  }
  return published;
};

const get_total = async () => await (Lanes.find()).countAsync();

const update_webhook_token = async function (lane_id, user_id, remove) {
  let lane = await Lanes.findOneAsync(lane_id);
  if (!lane) throw new Error(`Lane not found: ${lane_id}`);
  let token = uuidv4().replace(/-/g, '_');

  if (lane.tokens && remove) {
    let tokens = _.invert(lane.tokens);
    delete tokens[user_id];
    lane.tokens = _.invert(tokens);
  }

  if (!remove) lane.tokens = { [token]: user_id };

  return await Lanes.updateAsync(lane_id, { $set: { tokens: lane.tokens } });
};

const start_shipment = async function (id, manifest, shipment_start_date) {
  if (
    typeof id != 'string' ||
    (manifest && typeof manifest != 'object') ||
    !shipment_start_date
  ) {
    throw new TypeError(
      `Improper arguments for "Lanes#start_shipment" method!
      The first argument must be a String; the _id of the lane.
      The second argument, if present, must be an object;
      parameters to pass to the Harbor.
      The third argument must be the shipment start date.
      Received: ${id}, ${manifest}, ${shipment_start_date}`,
    );
  }

  let lane = await Lanes.findOneAsync({ _id: id });
  if (!lane) throw new Error(`Lane not found: ${id}`);
  let new_manifest;
  let shipment_id = await Shipments.insertAsync({
    start: shipment_start_date,
    actual: new Date(),
    lane: lane._id,
    stdin: [],
    stdout: {},
    stderr: {},
    active: true,
  });
  await LatestShipment.upsertAsync(
    { _id: lane._id },
    { $set: { shipment: await Shipments.findOneAsync(shipment_id) } },
  );
  lane.shipment_count = lane.shipment_count >= 0 ? lane.shipment_count + 1 : 1;
  manifest.shipment_start_date = shipment_start_date;
  manifest.shipment_id = shipment_id;
  await Lanes.updateAsync(
    { _id: lane._id },
    { $set: { shipment_count: lane.shipment_count } },
  );

  /* istanbul ignore next */
  if (!H.isTest) console.log('Starting shipment for lane:', lane.name);
  try {
    const work_method = H.bindEnvironment(
      H.harbors[lane.type].work,
      (err) => { throw err; },
    );
    new_manifest = await work_method(lane, manifest);
  }
  catch (err) {
    /* istanbul ignore next */
    if (!H.isTest) console.error(
      'Shipment failed with error:\n',
      err + '\n',
      'for lane:\n',
      lane.name,
    );
    manifest.error = err;
    new_manifest = manifest;
  }
  finally {

    let shipment = await Shipments.findOneAsync(shipment_id);
    if (new_manifest && new_manifest.error) {
      let exit_code = 1;
      let key = new Date();
      let result = new_manifest.error.toString();

      shipment.stderr[key] = result;

      await Shipments.updateAsync({ _id: shipment_id }, { $set: shipment });
      lane.last_shipment = shipment;
      await Lanes.updateAsync(
        { _id: lane._id },
        { $set: { last_shipment: lane.last_shipment } },
      );
      await LatestShipment.upsertAsync(
        { _id: shipment.lane },
        { $set: { shipment } },
      );

      return await H.call(
        'Lanes#end_shipment',
        lane,
        exit_code,
        new_manifest,
      );
    }

    lane.last_shipment = shipment;
    await Lanes.updateAsync(
      { _id: lane._id },
      { $set: { last_shipment: lane.last_shipment } },
    );
    await LatestShipment.upsertAsync(
      { _id: shipment.lane }, { $set: { shipment } },
    );

    return new_manifest;
  }
};

const end_shipment = async function (lane, exit_code, manifest) {
  if (
    lane && typeof lane._id != 'string' ||
    (typeof exit_code != 'string' && typeof exit_code != 'number') ||
    (manifest && typeof manifest != 'object')
  ) {
    throw new TypeError(
      'Invalid arguments for "Lanes#end_shipment" method!\n' +
      'The first argument must be a reference to a lane object.\n' +
      'The second argument must be the exit code of the finished work; ' +
      'An Integer or String representing one.\n' +
      'The third argument, if present, must be an object;' +
      'The (modified) manifest object originally passed to the Harbor.',
    );
  }

  if (exit_code && exit_code != '0') {
    lane.salvage_runs = lane.salvage_runs >= 0 ? lane.salvage_runs + 1 : 1;
  }

  let shipment;
  let shipment_id = manifest.shipment_id;
  let finished = new Date();
  let next_shipment_start_date = H.start_date();

  manifest.lane_id = lane._id;
  manifest.lane_name = lane.name;
  manifest.lane_slug = lane.slug;

  await Shipments.updateAsync({ _id: shipment_id }, {
    $set: {
      finished: finished,
      exit_code: exit_code,
      manifest: manifest,
      active: false,
    },
  });
  shipment = await Shipments.findOneAsync({ _id: shipment_id });
  lane.last_shipment = shipment;
  lane.last_shipment.finished = finished;
  lane.last_shipment.exit_code = exit_code;
  lane.last_shipment.manifest = manifest;
  lane.last_shipment.active = false;
  await Lanes.updateAsync({ _id: lane._id }, {
    $set: {
      last_shipment: lane.last_shipment,
      salvage_runs: lane.salvage_runs,
    },
  });

  await LatestShipment.upsertAsync(
    { _id: shipment.lane }, { $set: { shipment } },
  );
  manifest.stdout = shipment.stdout;
  manifest.stderr = shipment.stderr;

  /* istanbul ignore next */
  if (!H.isTest) console.log(
    'Shipping completed for lane:',
    lane.name,
    'with shipment:',
    shipment_id,
    'and exit code:',
    exit_code,
  );

  if (exit_code != 0 && lane.salvage_plan) {
    if (
      typeof lane.salvage_plan !== 'object' ||
      (!lane.salvage_plan?._id && !lane.salvage_plan?.slug)
    ) {
      throw new Error(
        `Invalid salvage_plan reference: ${JSON.stringify(lane.salvage_plan)}`,
      );
    }

    const salvageQuery = lane.salvage_plan._id ?
      { _id: lane.salvage_plan._id } :
      { slug: lane.salvage_plan.slug };

    let salvage_lane = await Lanes.findOneAsync(salvageQuery);
    if (!salvage_lane) {
      throw new Error(
        `Salvage plan lane not found: ${JSON.stringify(lane.salvage_plan)}`,
      );
    }
    const salvage_harbor = await Harbors.findOneAsync(salvage_lane.type);
    if (
      !salvage_harbor ||
      !salvage_harbor.lanes ||
      !salvage_harbor.lanes[salvage_lane._id] ||
      !salvage_harbor.lanes[salvage_lane._id].manifest
    ) {
      throw new Error('Harbor or lane manifest not found');
    }
    let salvage_manifest = salvage_harbor.lanes[salvage_lane._id].manifest;
    salvage_manifest.prior_manifest = trim_manifest(manifest);

    /* istanbul ignore next */
    if (!H.isTest) console.log(
      `Starting shipment for "${salvage_lane.name || lane.salvage_plan.name ||
        lane.salvage_plan.slug || lane.salvage_plan._id}" as salvage run of "${
        lane.name}"`,
    );
    return await H.call(
      'Lanes#start_shipment',
      salvage_lane._id,
      salvage_manifest,
      next_shipment_start_date,
    );
  }
  if (exit_code == 0 && lane.followup) {
    if (
      typeof lane.followup !== 'object' ||
      (!lane.followup?._id && !lane.followup?.slug)
    ) {
      throw new Error(
        `Invalid followup reference: ${JSON.stringify(lane.followup)}`,
      );
    }

    const followupQuery = lane.followup._id ?
      { _id: lane.followup._id } :
      { slug: lane.followup.slug };
    let followup_lane = await Lanes.findOneAsync(followupQuery);
    if (!followup_lane) {
      throw new Error(
        `Followup lane not found: ${JSON.stringify(lane.followup)}`,
      );
    }
    const followup_harbor = await Harbors.findOneAsync(followup_lane.type);
    if (
      !followup_harbor ||
      !followup_harbor.lanes ||
      !followup_harbor.lanes[followup_lane._id] ||
      !followup_harbor.lanes[followup_lane._id].manifest
    ) {
      throw new Error('Harbor or lane manifest not found');
    }
    let followup_manifest = followup_harbor.lanes[followup_lane._id].manifest;
    followup_manifest.prior_manifest = trim_manifest(manifest);

    /* istanbul ignore next */
    if (!H.isTest) console.log(
      `Starting shipment for "${followup_lane.name || lane.followup.name ||
      lane.followup.slug || lane.followup._id}" as followup of "${lane.name}"`,
    );
    return await H.call(
      'Lanes#start_shipment',
      followup_lane._id,
      followup_manifest,
      next_shipment_start_date,
    );
  }

  return manifest;
};

const reset_shipment = async function (slug, date) {
  let lane = await Lanes.findOneAsync({ slug });
  if (!lane) throw new Error(`Lane not found: ${slug}`);
  let shipment = await Shipments.findOneAsync({ start: date, lane: lane._id });
  if (!shipment) shipment = await Shipments.findOneAsync(
    { lane: lane._id },
    { sort: { actual: -1 } },
  );

  await Shipments.updateAsync({ _id: shipment._id }, {
    $set: {
      active: false,
      exit_code: 1,
    },
  });

  await LatestShipment.upsertAsync(
    { _id: lane._id },
    { $set: { shipment: await Shipments.findOneAsync({ _id: shipment._id }) } },
  );

  lane.last_shipment = await Shipments.findOneAsync({ _id: shipment._id });
  await Lanes.updateAsync(
    { _id: lane._id },
    { $set: { last_shipment: lane.last_shipment } },
  );

  return lane;
};

const reset_all_active_shipments = async function (name) {
  let lane = await Lanes.findOneAsync({ $or: [{ name }, { slug: name }] });
  if (!lane) throw new Error(`Lane not found: ${name}`);

  await Shipments.updateAsync(
    { lane: lane._id, active: true },
    {
      $set: {
        active: false,
        exit_code: 1,
      },
    },
    { multi: true },
  );

  lane.last_shipment = await Shipments.findOneAsync(
    { lane: lane._id },
    { sort: { actual: -1 } },
  );
  await LatestShipment.upsertAsync(
    { _id: lane._id },
    { $set: { shipment: lane.last_shipment } },
  );
  await Lanes.updateAsync(
    { _id: lane._id },
    { $set: { last_shipment: lane.last_shipment } },
  );

  return lane;
};

const update_slug = async (lane) => {
  if (!lane || !lane._id) return false;
  await Lanes.updateAsync({ _id: lane._id }, { $set: { slug: lane.slug } });
  return true;
};

const delete_lane = async function (lane) {
  if (!lane || !lane._id) throw new Error('Invalid lane');
  await Lanes.removeAsync({ _id: lane._id });
  /* istanbul ignore else */
  if (lane.type) {
    const harbor = await Harbors.findOneAsync(lane.type);
    /* istanbul ignore else */
    if (harbor && harbor.lanes) {
      delete harbor.lanes[lane._id];
      await Harbors.updateAsync(harbor._id, { $set: { lanes: harbor.lanes } });
    }
  }
  /* istanbul ignore next */
  if (!H.isTest) console.log(`Deleted lane: ${lane.name}`);
  return await get_total();
};

const upsert = async function (lane = {}) {
  const { _id, slug, name } = lane;

  // IMPORTANT:
  // Never query with undefined/empty values (e.g. { slug: undefined } matches
  // documents where slug is missing), which can cause accidental overwrites.
  const $or = [];
  if (_id) $or.push({ _id });
  if (typeof slug === 'string' && slug.length) $or.push({ slug });
  if (typeof name === 'string' && name.length) $or.push({ name });

  // If we have no identity fields, this must be a brand new lane. Insert it.
  if (!$or.length) {
    const insertedId = await Lanes.insertAsync(lane);
    return await Lanes.findOneAsync(insertedId);
  }

  const query = { $or };
  // Use a modifier update to avoid replacing the whole document and dropping
  // fields not present in `lane`.
  const $set = Object.fromEntries(
    Object.entries(lane)
      .filter(([key, value]) => key !== '_id' && value !== undefined),
  );
  const modifier = { $set };
  if (_id) {
    modifier.$setOnInsert = { _id };
  }

  await Lanes.upsertAsync(query, modifier);
  return await Lanes.findOneAsync(query);
};

const duplicate = async (lane) => {
  if (!lane || !lane._id || !lane.type) throw new Error('Invalid lane');
  const increment = await get_increment(lane);
  const harbor = await Harbors.findOneAsync(lane.type);
  if (!harbor || !harbor.lanes || !harbor.lanes[lane._id]) {
    throw new Error(`Harbor or lane manifest not found`);
  }
  const manifest = harbor.lanes[lane._id].manifest;
  const replacement_regex = /\d+$/g;

  /* istanbul ignore next */
  if (!H.isTest) console.log(`Duplicating lane ${lane.name}...`);
  delete lane.last_shipment;
  delete lane._id;
  delete lane.tokens;
  lane.shipment_count = 0;
  lane.salvage_runs = 0;
  lane.name = `${lane.name.replace(replacement_regex, '')}${increment}`;
  lane.slug = `${lane.slug.replace(replacement_regex, '')}${increment}`;
  const new_lane_id = await Lanes.insertAsync(lane);
  harbor.lanes[new_lane_id] = { manifest };
  await Harbors.updateAsync(harbor._id, { $set: { lanes: harbor.lanes } });
  /* istanbul ignore next */
  if (!H.isTest) console.log(`New lane created: ${lane.name}`);
  return `/lanes/${lane.slug}/edit`;
};

const download_charter_yaml = async (slug) => {
  const charter = new Map();
  const add_downstreams = async (lane) => {
    let followup;
    let salvage_plan;
    const harbor = await Harbors.findOneAsync(lane.type);
    if (
      !harbor ||
      !harbor.lanes ||
      !harbor.lanes[lane._id] ||
      !harbor.lanes[lane._id].manifest
    ) {
      throw new Error('Harbor or lane manifest not found');
    }
    charter.set(lane.slug, {
      name: lane.name,
      type: lane.type,
      tokens: lane.tokens || {},
      captains: lane.captains || [],
      followup: lane.followup?.slug,
      salvage_plan: lane.salvage_plan?.slug,
      manifest: harbor.lanes[lane._id].manifest,
    });
    // Process followup first to ensure correct order
    if (lane.followup && !charter.has(lane.followup.slug)) {
      followup = await Lanes.findOneAsync({ slug: lane.followup.slug });
      /* istanbul ignore else */
      if (followup) {
        await add_downstreams(followup);
      }
      /* istanbul ignore next */
      if (!followup && !H.isTest) console.error(
        `Unable to find lane by slug: ${lane.followup.slug}`,
      );
    }
    // Process salvage_plan after followup to ensure correct order
    if (lane.salvage_plan && !charter.has(lane.salvage_plan.slug)) {
      salvage_plan = await Lanes.findOneAsync({ slug: lane.salvage_plan.slug });
      /* istanbul ignore else */
      if (salvage_plan) {
        await add_downstreams(salvage_plan);
      }
      /* istanbul ignore next */
      if (!salvage_plan && !H.isTest) console.error(
        `Unable to find lane by slug ${lane.salvage_plan.slug}`,
      );
    }
  };
  const fields = {
    _id: 1,
    name: 1,
    slug: 1,
    type: 1,
    'followup._id': 1,
    'followup.slug': 1,
    'salvage_plan._id': 1,
    'salvage_plan.slug': 1,
    tokens: 1,
    captains: 1,
  };
  const $lane = await Lanes.findOneAsync({ slug }, { fields });

  if (slug && $lane) { await add_downstreams($lane); }
  else {
    const lanes = await Lanes.find({}, { fields }).fetchAsync();
    for (const lane of lanes) { await add_downstreams(lane); }
  }

  const charterObj = Object.fromEntries(charter);
  const lane_yaml = YAML.stringify(charterObj, { sortKeys: false });
  return lane_yaml;
};

const import_yaml = async (filename, yaml) => {
  const charter = YAML.parse(yaml);
  /* istanbul ignore next */
  if (!H.isTest) console.log(`Importing YAML from: ${filename}`);
  const found = [];
  const missing = [];
  const created = [];

  for (const [slug, values] of Object.entries(charter)) {
    if (await Lanes.findOneAsync({ slug })) found.push(slug);
    else if (!(await Harbors.findOneAsync(values.type))) missing.push(slug);
    else {
      const new_lane = {
        slug,
        type: values.type,
        name: values.name,
      };
      if (values.followup) {
        const followupLane = await Lanes.findOneAsync(
          { slug: values.followup },
          { fields: { _id: 1, slug: 1 } },
        );
        new_lane.followup = followupLane
          ? { _id: followupLane._id, slug: followupLane.slug }
          : { _id: values.followup, slug: values.followup };
      }
      if (values.salvage_plan) {
        const salvageLane = await Lanes.findOneAsync(
          { slug: values.salvage_plan },
          { fields: { _id: 1, slug: 1 } },
        );
        new_lane.salvage_plan = salvageLane
          ? { _id: salvageLane._id, slug: salvageLane.slug }
          : { _id: values.salvage_plan, slug: values.salvage_plan };
      }
      const lane_id = await Lanes.insertAsync(new_lane);
      const harbor = await Harbors.findOneAsync(values.type);
      harbor.lanes = (harbor.lanes || {});
      harbor.lanes[lane_id] = { manifest: values.manifest };
      await Harbors.updateAsync(harbor._id, { $set: { lanes: harbor.lanes } });
      created.push(slug);
    }
  }

  return { found, missing, created };
};

export {
  trim_manifest,
  collect_latest_shipments,
  publish_lanes,
  get_total,
  get_increment,
  update_webhook_token,
  start_shipment,
  end_shipment,
  reset_shipment,
  reset_all_active_shipments,
  update_slug,
  delete_lane,
  upsert,
  duplicate,
  download_charter_yaml,
  import_yaml,
};
