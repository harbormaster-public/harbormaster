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
    return await work(await Shipments.findOneAsync(shipment_id), selector);
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
};

// Compare the old snapshots before writing either projection. A retry reads
// the source again, so an older completion cannot replace newer history.
const update_shipment_history = async (lane_id) => {
  for (;;) {
    const lane = await Lanes.findOneAsync(lane_id);
    if (!lane) throw new Error(`Lane not found: ${lane_id}`);
    const latest = await LatestShipment.findOneAsync(lane_id);
    const shipment = await Shipments.findOneAsync({ lane: lane_id }, {
      sort: { actual: -1, _id: -1 },
      fields: { completion: 0, dispatch: 0 },
    }) || { actual: 'Never', start: '' };
    const previous = lane.last_shipment === undefined ?
      { $exists: false } : lane.last_shipment;
    const updated = await Lanes.updateAsync({
      _id: lane_id, last_shipment: previous,
    }, { $set: { last_shipment: shipment } });
    if (!updated) continue;
    try {
      await LatestShipment.upsertAsync({
        _id: lane_id,
        shipment: latest ? latest.shipment : { $exists: false },
      }, { $set: { shipment } });
      return shipment;
    }
    catch (error) {
      if (error.code != 11000) throw error;
    }
  }
};

export {
  claim_shipment,
  prepare_shipment_totals,
  update_shipment_totals,
  update_shipment_history,
};
