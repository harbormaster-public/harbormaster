import { Lanes } from '..';
import { Shipments, LatestShipment } from '../../shipments';
import { v4 as uuidv4 } from 'uuid';

const claim_duration = 60000;

const claim_shipment = async (shipment_id, stage, work) => {
  const token = uuidv4();
  const selector = { _id: shipment_id, [`${stage}.token`]: token };
  const claimed = await Shipments.updateAsync({
    _id: shipment_id,
    [`${stage}.pending`]: true,
    $or: [
      { [`${stage}.token`]: { $exists: false } },
      { [`${stage}.until`]: { $lte: new Date() } },
    ],
  }, { $set: {
    [`${stage}.token`]: token,
    [`${stage}.until`]: new Date(Date.now() + claim_duration),
  } });
  if (!claimed) return undefined;

  const renew = setInterval(() => {
    Shipments.updateAsync(selector, { $set: {
      [`${stage}.until`]: new Date(Date.now() + claim_duration),
    } }).catch(error => console.error(
      'Unable to renew shipment claim:', error,
    ));
  }, claim_duration / 3);
  try {
    const shipment = await Shipments.findOneAsync(selector);
    if (!shipment) return undefined;
    return await work(shipment, selector);
  }
  finally {
    clearInterval(renew);
    await Shipments.updateAsync(selector, { $unset: {
      [`${stage}.token`]: '', [`${stage}.until`]: '',
    } });
  }
};

const prepare_shipment_totals = async (lane_id) => {
  const lane = await Lanes.findOneAsync(lane_id);
  if (!lane) throw new Error(`Lane not found: ${lane_id}`);
  if (lane.shipment_totals) return lane.shipment_totals;
  const existing = await Shipments.find({ lane: lane_id }).countAsync();
  const totals = {
    shipments: (lane.shipment_count ?? existing) - existing,
    salvage: lane.salvage_runs || 0,
  };
  await Lanes.updateAsync({
    _id: lane_id, shipment_totals: { $exists: false },
  }, { $set: { shipment_totals: totals } });
  return (await Lanes.findOneAsync(lane_id)).shipment_totals;
};

const update_shipment_totals = async (lane_id, failed = false) => {
  const totals = await prepare_shipment_totals(lane_id);
  const shipment_count = totals.shipments +
    await Shipments.find({ lane: lane_id }).countAsync();
  const maximum = { shipment_count };
  if (failed) {
    maximum.salvage_runs = totals.salvage + await Shipments.find({
      lane: lane_id, 'completion.failed': true,
    }).countAsync();
  }
  await Lanes.updateAsync(lane_id, { $max: maximum });
  return await Lanes.findOneAsync(lane_id, { fields: {
    shipment_count: 1, salvage_runs: 1,
  } });
};

const with_existing_lane = async (lane_id, update) => {
  try { return await update(); }
  catch (error) {
    if (await Lanes.findOneAsync(lane_id)) throw error;
    return undefined;
  }
};

// Compare compact revisions before writing either projection. A retry reads
// the source again, so an older completion cannot replace newer history.
const write_shipment_history = async (lane_id) => {
  for (;;) {
    const lane = await Lanes.findOneAsync(lane_id);
    if (!lane) throw new Error(`Lane not found: ${lane_id}`);
    const latest = await LatestShipment.findOneAsync(lane_id);
    const shipment = await Shipments.findOneAsync({ lane: lane_id }, {
      sort: { actual: -1, _id: -1 },
      fields: { completion: 0, dispatch: 0 },
    }) || { actual: 'Never', start: '' };
    const previous = lane.shipment_history === undefined ?
      { $exists: false } : lane.shipment_history;
    const updated = await Lanes.updateAsync({
      _id: lane_id, shipment_history: previous,
    }, {
      $set: { last_shipment: shipment }, $inc: { shipment_history: 1 },
    });
    if (!updated) continue;
    try {
      await LatestShipment.upsertAsync({
        _id: lane_id,
        shipment_history: latest && latest.shipment_history !== undefined ?
          latest.shipment_history : { $exists: false },
      }, { $set: { shipment }, $inc: { shipment_history: 1 } });
      return shipment;
    }
    catch (error) {
      if (error.code != 11000) throw error;
    }
  }
};

const history_updates = new Map();

// Serialize local projections per lane; revisions still fence other servers.
const update_shipment_history = (lane_id) => {
  const previous = history_updates.get(lane_id) || Promise.resolve();
  const update = previous.catch(() => undefined)
    .then(() => write_shipment_history(lane_id));
  history_updates.set(lane_id, update);
  return update.finally(() => {
    if (history_updates.get(lane_id) === update) {
      history_updates.delete(lane_id);
    }
  });
};

export {
  claim_shipment,
  prepare_shipment_totals,
  update_shipment_totals,
  update_shipment_history,
  with_existing_lane,
};
