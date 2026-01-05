import {
  Shipments,
  LatestShipment,
} from '..';
import { Lanes } from '../../lanes';

const publish_shipments = async function publish_shipments (
  lanes,
  options = {},
) {
  let query = {};
  if (lanes && lanes.length > 0 && lanes instanceof Array) {
    query.lane = { $in: lanes.map((item) => item._id) };
  }
  else {
    if (lanes?._id) query.lane = lanes._id;
    if (lanes?.slug) {
      const laneBySlug = await Lanes.findOneAsync({ slug: lanes.slug });
      query.lane = laneBySlug?._id;
      if (!lanes?.date) {
        options.fields = {
          stdin: 0,
          stdout: 0,
          stderr: 0,
          manifest: 0,
        };
      }
    }
    if (lanes?.date) query.start = lanes.date;
  }
  // Publish functions must return cursors
  return Shipments.find(query, options);
};

const get_total_shipments = async function () {
  /* istanbul ignore next */
  if (!H.isTest) this.unblock();
  let now = Date.now();
  let interval = 86400000; // 24 hours
  let yesterday = new Date(now - interval);
  const total_shipments = await Shipments.find({
    actual: { $gte: yesterday },
  }).countAsync();

  return total_shipments;
};

const last_shipped = async function (lane = { _id: null }) {
  /* istanbul ignore next */
  if (!H.isTest) this.unblock();
  const latest = await LatestShipment.findOneAsync(lane._id);
  const query = lane._id ? { lane: lane._id } : {};
  return latest ? latest.shipment : await Shipments.findOneAsync(query, {
    sort: { actual: -1 },
    limit: 1,
  });
};

const total_completed_shipments = async function (
  lane = { _id: null },
) {
  /* istanbul ignore next */
  if (!H.isTest) this.unblock();
  // When a lane is provided, include "global" shipments (those without a
  // lane) in addition to shipments for the specified lane. Tests expect
  // both to count.
  const query = lane._id ? {
    $and: [
      { exit_code: 0 },
      { $or: [
        { lane: lane._id },
        { lane: { $exists: false } },
        { lane: null },
      ] },
    ],
  } : { exit_code: 0 };
  return await Shipments.find(query).countAsync();
};

const total_salvage_runs = async function (
  lane = { _id: null },
) {
  /* istanbul ignore next */
  if (!H.isTest) this.unblock();
  // When a lane is provided, include "global" shipments (those without a
  // lane) in addition to shipments for the specified lane. Tests expect
  // both to count.
  const query = lane._id ? {
    $and: [
      { exit_code: { $ne: 0 } },
      { $or: [
        { lane: lane._id },
        { lane: { $exists: false } },
        { lane: null },
      ] },
    ],
  } : { exit_code: { $ne: 0 } };
  return await Shipments.find(query).countAsync();
};

const get_latest_date = async function () {
  /* istanbul ignore next */
  if (!H.isTest) this.unblock();
  let lane;

  const formatLocale = (value) => {
    if (!value) return '';
    if (typeof value.toLocaleString === 'function') {
      return value.toLocaleString();
    }
    return String(value);
  };

  let latest_shipment = await Shipments.findOneAsync(
    {},
    { sort: { finished: -1 } },
  );
  if (latest_shipment && latest_shipment.lane) {
    lane = await Lanes.findOneAsync({
      $or: [
        { slug: latest_shipment.lane },
        { _id: latest_shipment.lane },
        { name: latest_shipment.lane },
      ],
    });
  }

  const recordedAt = (
    formatLocale(latest_shipment && latest_shipment.finished) ||
    formatLocale(latest_shipment && latest_shipment.start) ||
    'unknown'
  );

  if (latest_shipment && lane) return {
    lane: lane.slug || lane.name,
    date: latest_shipment.start,
    locale: recordedAt,
  };

  if (latest_shipment) return {
    lane: '',
    date: '',
    locale: `recorded at ${recordedAt}, ` +
      `<b><i>and is orphaned (no lane found to match it).</b></i>`,
  };

  return {
    lane: '',
    date: '',
    locale: 'never',
  };
};

const log_shipment_totals = async function () {
  console.log('Collecting shipment totals for each lane...');
  const lanes = await Lanes.rawCollection().find({}).toArray();
  for (const lane of lanes) {
    console.log(`Counting shipments for ${lane.name}...`);
    const shipment_count = await Shipments.rawCollection()
      .countDocuments({ lane: lane._id }) || 0;
    const salvage_count = await Shipments.rawCollection().countDocuments({
      lane: lane._id,
      exit_code: { $exists: true, $nin: [0, null] },
    }) || 0;

    console.log(
      `${lane.name} counted:
    \tShipments: ${shipment_count}
    \tSalvage Runs: ${salvage_count}`,
    );
  }
  console.log('Done collecting shipment totals.');
};

export {
  publish_shipments,
  get_total_shipments,
  last_shipped,
  total_completed_shipments,
  total_salvage_runs,
  get_latest_date,
  log_shipment_totals,
};
