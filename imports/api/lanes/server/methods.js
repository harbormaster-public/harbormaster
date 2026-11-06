import H from '../../../startup/config/namespace';
import { Lanes } from '..';
import { Shipments } from '../../shipments';
import { Harbors } from '../../harbors';
import { v4 as uuidv4 } from 'uuid';
import _ from 'lodash';
import YAML from 'yaml';
import { retry, cancel_retry } from '../../../startup/server/retry';
import { editable_lane_fields, save_lane_fields } from './lane-fields';
import {
  ShipmentReturns, shipment_result, checkpoint_return,
} from '../../shipments/server/returns';
import {
  lane_revision,
  claim_shipment,
  prepare_shipment_totals,
  update_shipment_totals,
  update_shipment_history,
  with_existing_lane,
} from './shipment-state';

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
      await update_shipment_history(lane._id);
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

const recovery_tasks = new Map();
const recovery_key = (id, stage) => `shipment:${stage}:${id}`;
const retry_shipment = (id, stage, at) => retry(
  recovery_key(id, stage), () => recover_one(id, stage), at,
);

const recover_one = (id, stage) => {
  const key = recovery_key(id, stage);
  if (recovery_tasks.has(key)) return recovery_tasks.get(key);
  const task = (async () => {
    const shipment = await Shipments.findOneAsync(id, {
      fields: { [stage]: 1 },
    });
    if (!shipment?.[stage]?.pending) return undefined;
    if (shipment[stage].token && shipment[stage].until > new Date()) {
      return shipment[stage].until;
    }
    const recover = stage == 'completion' ? finish_shipment : run_shipment;
    const result = await recover(id);
    if (result) return undefined;
    const current = await Shipments.findOneAsync(id, {
      fields: { [stage]: 1 },
    });
    if (!current?.[stage]?.pending) return undefined;
    if (current[stage].token && current[stage].until > new Date()) {
      return current[stage].until;
    }
    throw new H.Error('shipment-pending', 'Shipment recovery is pending');
  })().finally(() => {
    if (recovery_tasks.get(key) === task) recovery_tasks.delete(key);
  });
  recovery_tasks.set(key, task);
  return task;
};

const recoverable_shipment = async (id, stage, work) => {
  try { return await claim_shipment(id, stage, work); }
  catch (error) {
    retry_shipment(id, stage);
    throw error;
  }
};

const resume_dispatch = async (shipment, selector) => {
  const lane = await Lanes.findOneAsync(shipment.lane);
  const harbor = lane && H.harbors[lane.type];
  if (typeof harbor?.resume_shipment != 'function') return;
  const current = await Shipments.findOneAsync({ ...selector, active: true });
  if (current) await harbor.resume_shipment(lane, current);
};

const finish_dispatch = async (shipment, selector, result) => {
  const checkpoint = await checkpoint_return(shipment, selector, result);
  if (!checkpoint) return undefined;
  if (checkpoint.receipt.has_result) {
    await Shipments.updateAsync({ ...selector, active: true }, {
      $set: { manifest: checkpoint.result },
    });
  }
  await with_existing_lane(shipment.lane,
    () => update_shipment_history(shipment.lane));
  await resume_dispatch(shipment, selector);
  const saved = await Shipments.updateAsync(selector, {
    $set: { dispatch: checkpoint.receipt },
  });
  if (!saved) return undefined;
  cancel_retry(recovery_key(shipment._id, 'dispatch'));
  return { result: checkpoint.result };
};

const missing_dispatch_lane = async (shipment, selector) => {
  const error = `Lane not found: ${shipment.lane}`;
  if (!shipment.dispatch.started) {
    await Shipments.updateAsync({
      ...selector, active: true,
      'dispatch.started': { $exists: false },
    }, { $set: {
      active: false, exit_code: 1, finished: new Date(),
      'dispatch.pending': false, 'dispatch.error': error,
    } });
  }
  throw new H.Error('lane-not-found', error);
};

const run_shipment = async (shipment_id) => recoverable_shipment(
  shipment_id, 'dispatch', async (shipment, selector) => {
    if (shipment.dispatch.return_id) {
      const saved = await ShipmentReturns.findOneAsync(
        shipment.dispatch.return_id,
      );
      if (saved) {
        return await finish_dispatch(shipment, selector, saved.value);
      }
    }
    if (!shipment.active) {
      if (shipment.dispatch.failed) {
        const result = await H.call('Lanes#end_shipment',
          { _id: shipment.lane }, shipment.exit_code, shipment.manifest,
          selector['dispatch.token']);
        return await finish_dispatch(shipment, selector, result);
      }
      if (shipment.dispatch.return_id &&
        shipment.dispatch.has_result !== false) {
        const error = 'Shipment return was not saved; ' +
          'reconcile before retrying.';
        await Shipments.updateAsync(selector, { $set: {
          'dispatch.pending': false, 'dispatch.error': error,
        } });
        throw new Error(error);
      }
      return await finish_dispatch(shipment, selector,
        await shipment_result(shipment));
    }
    if (shipment.dispatch.returned &&
      shipment.dispatch.has_result === false) {
      return await finish_dispatch(shipment, selector, undefined);
    }
    const lane = await Lanes.findOneAsync(shipment.lane);
    if (!lane) return missing_dispatch_lane(shipment, selector);
    const harbor = H.harbors[lane.type];
    if (!harbor || typeof harbor.work != 'function') {
      throw new Error(`Harbor is not ready: ${lane.type}`);
    }
    const counters = await with_existing_lane(lane._id,
      () => update_shipment_totals(lane._id));
    Object.assign(lane, counters);
    const history = await with_existing_lane(lane._id,
      () => update_shipment_history(lane._id));
    // A shipment exists before this revision advances. Deletion checks for
    // that shipment and removes only the revision it inspected.
    if (!history) return missing_dispatch_lane(shipment, selector);
    const manifest = _.cloneDeep(shipment.manifest);
    let new_manifest = shipment.dispatch.has_result ?
      _.cloneDeep(shipment.manifest) : undefined;
    if (!shipment.dispatch.returned) {
      if (shipment.dispatch.started && harbor.replay_safe !== true) {
        const error = 'Work outcome is unknown; reconcile before retrying.';
        const held = await Shipments.updateAsync({
          ...selector, active: true,
        }, { $set: {
          'dispatch.pending': false, 'dispatch.error': error,
          [`stderr.${new Date()}`]: error,
        } });
        if (held) {
          console.error(`Shipment ${shipment_id}: ${error}`);
          await update_shipment_history(lane._id);
        }
        return undefined;
      }
      const return_id = uuidv4();
      const started = await Shipments.updateAsync({
        ...selector, active: true,
      }, { $set: {
        'dispatch.started': new Date(), 'dispatch.return_id': return_id,
      } });
      if (!started) return undefined;
      shipment.dispatch.return_id = return_id;
      /* istanbul ignore next */
      if (!H.isTest) console.log('Starting shipment for lane:', lane.name);
      try {
        const work_method = H.bindEnvironment(
          harbor.work, err => { throw err; },
        );
        new_manifest = await work_method(lane, manifest, shipment);
      }
      catch (error) {
        if (error.error == 'shipment-pending') throw error;
        /* istanbul ignore next */
        if (!H.isTest) console.error(
          'Shipment failed with error:\n', error + '\n',
          'for lane:\n', lane.name,
        );
        manifest.error = error.toString();
        new_manifest = manifest;
      }
      if (!new_manifest || !new_manifest.error) {
        return await finish_dispatch(shipment, selector, new_manifest);
      }
      new_manifest.error = new_manifest.error.toString();
      const checkpoint = {
        'dispatch.returned': true,
        'dispatch.has_result': true,
        'dispatch.failed': true,
        manifest: new_manifest, exit_code: 1,
      };
      const updated = await Shipments.updateAsync({
        ...selector, active: true,
      }, { $set: checkpoint });
      if (!updated) {
        // A synchronous harbor may already have completed its shipment.
        const owned = await Shipments.findOneAsync(selector);
        if (!owned) return undefined;
        return await finish_dispatch(shipment, selector, new_manifest);
      }
    }
    if (new_manifest && new_manifest.error) {
      const logged = await Shipments.updateAsync(selector, { $set: {
        [`stderr.${new Date()}`]: new_manifest.error.toString(),
      } });
      if (!logged) return undefined;
      // Keep the retryable dispatch until completion has been recorded.
      new_manifest = await H.call('Lanes#end_shipment', lane, 1, new_manifest,
        selector['dispatch.token']);
    }
    return await finish_dispatch(shipment, selector, new_manifest);
  },
);

const prepare_shipment = async function (
  id, manifest, shipment_start_date, shipment_id, pending = true,
) {
  if (
    typeof id != 'string' ||
    !manifest || typeof manifest != 'object' ||
    !shipment_start_date || typeof shipment_id != 'string'
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
  manifest.shipment_start_date = shipment_start_date;
  manifest.shipment_id = shipment_id;
  let saved;
  try {
    saved = await Shipments.findOneAsync(shipment_id);
    if (!saved) {
      const lane = await Lanes.findOneAsync(id);
      if (!lane) throw new Error(`Lane not found: ${id}`);
      await prepare_shipment_totals(id);
      await Shipments.upsertAsync({ _id: shipment_id }, { $setOnInsert: {
        start: shipment_start_date,
        actual: new Date(),
        lane: id,
        manifest: _.cloneDeep(manifest),
        stdin: [], stdout: {}, stderr: {}, active: true,
        dispatch: { pending },
      } });
      saved = await Shipments.findOneAsync(shipment_id);
    }
  }
  catch (error) {
    retry_shipment(shipment_id, 'dispatch');
    throw error;
  }
  if (saved.lane != id) throw new Error('Shipment belongs to another lane');
  return saved;
};

const start_shipment = async function (
  id, manifest, shipment_start_date, shipment_id = uuidv4(),
) {
  const saved = await prepare_shipment(
    id, manifest, shipment_start_date, shipment_id,
  );
  if (saved.dispatch?.pending === false && !saved.dispatch.started &&
    saved.dispatch.error) {
    throw new H.Error('lane-not-found', saved.dispatch.error);
  }
  if (!saved.dispatch || !saved.dispatch.pending) return shipment_result(saved);
  const dispatched = await run_shipment(shipment_id);
  if (dispatched) return dispatched.result;
  const current = await Shipments.findOneAsync(shipment_id);
  if (current.dispatch?.pending) {
    retry_shipment(shipment_id, 'dispatch', current.dispatch.until);
    throw new H.Error('shipment-pending',
      'Shipment return is pending; retry after dispatch settles');
  }
  return await shipment_result(current);
};

const next_shipment = (lane, exit_code) => {
  const failed = exit_code != 0;
  const kind = failed ? 'salvage_plan' : 'followup';
  const reference = lane[kind];
  if (!reference) return undefined;
  return {
    reference: typeof reference == 'object' ?
      _.pick(reference, ['_id', 'slug']) : reference,
    shipment_id: uuidv4(), start: H.start_date(),
  };
};

const resolve_next_shipment = async (next, failed) => {
  const reference = next.reference;
  const kind = failed ? 'salvage_plan' : 'followup';
  if (typeof reference != 'object' || (!reference._id && !reference.slug)) {
    throw new Error(`Invalid ${kind} reference: ${JSON.stringify(reference)}`);
  }
  const query = reference._id ?
    { _id: reference._id } : { slug: reference.slug };
  const target = await Lanes.findOneAsync(query);
  if (!target) {
    const label = failed ? 'Salvage plan' : 'Followup';
    throw new Error(`${label} lane not found: ${JSON.stringify(reference)}`);
  }
  const harbor = await Harbors.findOneAsync(target.type);
  if (!harbor || !harbor.lanes || !harbor.lanes[target._id] ||
    !harbor.lanes[target._id].manifest) {
    throw new Error('Harbor or lane manifest not found');
  }
  const next_manifest = _.cloneDeep(harbor.lanes[target._id].manifest);
  trim_manifest(next_manifest);
  return {
    lane: target._id,
    shipment_id: next.shipment_id,
    start: next.start,
    manifest: next_manifest,
  };
};

const prepare_next_shipment = async (next, parent_manifest, failed) => {
  if (typeof next.shipment_id != 'string' || !next.shipment_id) {
    throw new Error('Invalid next shipment id');
  }
  const saved = await Shipments.findOneAsync(next.shipment_id);
  if (saved) {
    const lane = next.lane || next.reference?._id;
    if (lane && saved.lane != lane) {
      throw new Error('Shipment belongs to another lane');
    }
    return saved;
  }
  const resolved = next.manifest ? next :
    await resolve_next_shipment(next, failed);
  const manifest = _.cloneDeep(resolved.manifest);
  manifest.prior_manifest = trim_manifest(parent_manifest);
  return await prepare_shipment(
    resolved.lane, manifest, resolved.start, resolved.shipment_id, false,
  );
};

const finish_shipment = async (shipment_id) => recoverable_shipment(
  shipment_id, 'completion', async (shipment, selector) => {
    await with_existing_lane(shipment.lane, async () => {
      await update_shipment_totals(shipment.lane, shipment.completion.failed);
      await update_shipment_history(shipment.lane);
    });
    const next = shipment.completion.next;
    const parent_manifest = {
      ..._.cloneDeep(shipment.manifest),
      stdout: shipment.stdout, stderr: shipment.stderr,
    };
    let result = parent_manifest;
    try {
      const recorded = shipment.completion.return_id &&
        await ShipmentReturns.findOneAsync(shipment.completion.return_id);
      if (recorded) result = recorded.value;
      else if (shipment.completion.has_result === false) result = undefined;
      else if (next) {
        const child = await prepare_next_shipment(
          next, parent_manifest, shipment.completion.failed,
        );
        const saved = await Shipments.updateAsync(selector, { $set: {
          'completion.next': {
            lane: child.lane, shipment_id: child._id, start: child.start,
          },
        }, $unset: { 'completion.error': '' } });
        if (!saved) return undefined;
        await Shipments.updateAsync({
          _id: child._id, active: true,
          'dispatch.pending': false,
          'dispatch.started': { $exists: false },
        }, { $set: { 'dispatch.pending': true } });
        /* istanbul ignore next */
        if (!H.isTest) console.log(
          'Starting shipment for', child.lane, 'as',
          shipment.completion.failed ? 'salvage run of' : 'followup of',
          shipment.manifest.lane_name,
        );
        const manifest = child.manifest && typeof child.manifest == 'object' ?
          child.manifest : {};
        result = await H.call('Lanes#start_shipment', child.lane,
          manifest, child.start, child._id);
      }
      const checkpoint = await checkpoint_return(
        shipment, selector, result, 'completion',
      );
      if (!checkpoint) return undefined;
      const completion = {
        failed: shipment.completion.failed, ...checkpoint.receipt,
      };
      const saved = await Shipments.updateAsync(selector, {
        $set: { completion },
      });
      if (!saved) return undefined;
      cancel_retry(recovery_key(shipment_id, 'completion'));
      return { result: checkpoint.result };
    }
    catch (error) {
      await Shipments.updateAsync({
        ...selector, 'completion.pending': true,
      }, { $set: { 'completion.error': error.toString() } });
      throw error;
    }
  },
);

const completion_step = async (shipment_id, work) => {
  try { return await work(); }
  catch (error) {
    retry_shipment(shipment_id, 'completion');
    if (error.error == 'shipment-pending') throw error;
    throw new H.Error('shipment-pending', error.message);
  }
};

const end_shipment = async function (
  lane, exit_code, manifest, dispatch_token,
) {
  if (
    !lane || typeof lane._id != 'string' ||
    (typeof exit_code != 'string' && typeof exit_code != 'number') ||
    !manifest || typeof manifest != 'object'
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
  const shipment_id = manifest.shipment_id;
  const selector = { _id: shipment_id };
  if (dispatch_token) selector['dispatch.token'] = dispatch_token;
  const shipment = await completion_step(
    shipment_id, () => Shipments.findOneAsync(selector),
  );
  if (!shipment) return manifest;
  if (shipment.lane != lane._id) {
    throw new Error('Shipment belongs to another lane');
  }
  return await completion_step(shipment_id, async () => {
    if (shipment.active) {
      const current_lane = await Lanes.findOneAsync(lane._id) || lane;
      await with_existing_lane(lane._id,
        () => prepare_shipment_totals(lane._id));
      manifest.lane_id = current_lane._id;
      manifest.lane_name = current_lane.name;
      manifest.lane_slug = current_lane.slug;
      const next = next_shipment(current_lane, exit_code);
      const completion = { pending: true, failed: exit_code != 0 };
      if (next) completion.next = next;
      const completed = await Shipments.updateAsync({
        ...selector, active: true,
      }, { $set: {
        finished: new Date(), exit_code, manifest, active: false, completion,
      }, $unset: { sleep_resume: '' } });
      if (!completed && dispatch_token) return manifest;
      manifest.stdout = shipment.stdout;
      manifest.stderr = shipment.stderr;
      /* istanbul ignore next */
      if (!H.isTest) console.log('Shipping completed for lane:', lane.name,
        'with shipment:', shipment_id, 'and exit code:', exit_code);
    }
    const finished = await finish_shipment(shipment_id);
    if (finished) return finished.result;
    const current = await Shipments.findOneAsync(shipment_id);
    if (current.completion?.pending) {
      retry_shipment(shipment_id, 'completion', current.completion.until);
      throw new H.Error('shipment-pending',
        'Shipment completion is pending; retry after it settles');
    }
    if (current.completion?.has_result !== undefined) {
      return await shipment_result(current, 'completion');
    }
    return manifest;
  });
};

const recover_shipments = async () => {
  const tasks = [];
  for (const stage of ['completion', 'dispatch']) {
    const shipments = await Shipments.find({
      [`${stage}.pending`]: true,
    }, { fields: { _id: 1 } }).fetchAsync();
    for (const shipment of shipments) {
      const task = recover_one(shipment._id, stage);
      task.then(at => {
        if (at) retry_shipment(shipment._id, stage, at);
      }).catch(error => {
        console.error(`Unable to recover shipment ${shipment._id}:`, error);
        retry_shipment(shipment._id, stage);
      });
      tasks.push(task.catch(() => undefined));
    }
  }
  return tasks;
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

  lane.last_shipment = await update_shipment_history(lane._id);

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

  lane.last_shipment = await update_shipment_history(lane._id);

  return lane;
};

const update_slug = async (lane) => {
  if (!lane || !lane._id) return false;
  await Lanes.updateAsync({ _id: lane._id }, { $set: { slug: lane.slug } });
  return true;
};

const require_idle_lane = async (lane_id) => {
  if (await Shipments.findOneAsync({ lane: lane_id, active: true }, {
    fields: { _id: 1 },
  })) {
    throw new H.Error('lane-active',
      'This lane has an active shipment. Reset it before deleting the lane.');
  }
  if (await Shipments.findOneAsync({ lane: lane_id, $or: [
    { 'dispatch.pending': true }, { 'completion.pending': true },
  ] }, { fields: { _id: 1 } })) {
    throw new H.Error('lane-pending',
      'This lane has pending shipment work. Wait for it to finish ' +
      'before deleting the lane.');
  }
};

const delete_lane = async function (lane) {
  if (!lane || !lane._id) throw new Error('Invalid lane');
  const current = await Lanes.findOneAsync(lane._id);
  if (current) {
    await require_idle_lane(current._id);
    const removed = await Lanes.removeAsync(lane_revision(current));
    if (!removed) {
      await require_idle_lane(current._id);
      throw new H.Error('lane-changed',
        'This lane changed while it was being deleted. Try again.');
    }
    lane = current;
  }
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
  if (!lane || typeof lane != 'object' || Array.isArray(lane)) {
    throw new TypeError('Invalid lane');
  }
  const { _id, slug, name } = lane;
  const fields = editable_lane_fields(lane);
  if (lane.type !== undefined) fields.type = lane.type;
  const initial = { shipment_count: 0, salvage_runs: 0 };

  // IMPORTANT:
  // Never query with undefined/empty values (e.g. { slug: undefined } matches
  // documents where slug is missing), which can cause accidental overwrites.
  const $or = [];
  if (_id) $or.push({ _id });
  if (typeof slug === 'string' && slug.length) $or.push({ slug });
  if (typeof name === 'string' && name.length) $or.push({ name });

  // If we have no identity fields, this must be a brand new lane. Insert it.
  if (!$or.length) {
    const insertedId = await Lanes.insertAsync({ ...fields, ...initial });
    return await Lanes.findOneAsync(insertedId);
  }

  const query = { $or };
  let current = await Lanes.findOneAsync(query);
  if (!current) {
    if (_id && await Shipments.findOneAsync({ lane: _id }, {
      fields: { _id: 1 },
    })) throw new Error('Cannot reuse a lane ID with shipment history');
    if (_id) initial._id = _id;
    await Lanes.upsertAsync(query, { $setOnInsert: { ...fields, ...initial } });
    current = await Lanes.findOneAsync(query);
  }
  await save_lane_fields(current, fields);
  return await Lanes.findOneAsync(current._id);
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
  delete lane.shipment_totals;
  delete lane.shipment_history;
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
  recover_shipments,
  reset_shipment,
  reset_all_active_shipments,
  update_slug,
  delete_lane,
  upsert,
  duplicate,
  download_charter_yaml,
  import_yaml,
};
