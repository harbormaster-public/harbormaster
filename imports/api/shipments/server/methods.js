import {
  Shipments,
  LatestShipment,
} from '..';
import { Lanes } from '../../lanes';

const publish_shipments = function publish_shipments (lanes, options = {}) {
  let query = {};
  if (lanes?._id) query.lane = lanes._id;
  if (lanes?.date) query.start = lanes.date;
  else if (lanes && lanes.length > 0 && lanes instanceof Array) {
    query = { lane: { $in: lanes.map((item) => item._id) } };
  }
  else if (lanes?.slug) {
    query.lane = Lanes.findOne({ slug: lanes.slug })?._id;
    options.fields = {
      stdin: 0,
      stdout: 0,
      stderr: 0,
      manifest: 0,
    };
  }
  const shipments = Shipments.find(query, options);

  return shipments;
};

const get_total_shipments = function () {
  /* istanbul ignore next */
  if (!H.isTest) this.unblock();
  let now = Date.now();
  let interval = 86400000; // 24 hours
  let yesterday = new Date(now - interval);
  let total_shipments = Shipments.find({
    actual: {
      $gte: yesterday,
    },
  }).count();

  return total_shipments;
};

const last_shipped = function (lane = { _id: null }) {
  /* istanbul ignore next */
  if (!H.isTest) this.unblock();
  const latest = LatestShipment.findOne(lane._id);
  const query = lane._id ? { lane: lane._id } : {};
  return latest ? latest.shipment : Shipments.findOne(query, {
    sort: { actual: -1 },
    limit: 1,
  });
};

const total_completed_shipments = function (lane = { _id: null }) {
  /* istanbul ignore next */
  if (!H.isTest) this.unblock();
  const query = lane._id ? { lane: lane._id, exit_code: 0 } : { exit_code: 0 };
  return Shipments.find(query).count();
};

const total_salvage_runs = function (lane = { _id: null }) {
  /* istanbul ignore next */
  if (!H.isTest) this.unblock();
  const query = lane._id ?
    { lane: lane._id, exit_code: { $ne: 0 } } :
    { exit_code: { $ne: 0 } }
    ;
  return Shipments.find(query).count();
};

const get_latest_date = function () {
  /* istanbul ignore next */
  if (!H.isTest) this.unblock();
  let lane;

  let latest_shipment = Shipments.findOne({}, { sort: { finished: -1 } });
  if (latest_shipment) lane = Lanes.findOne(latest_shipment.lane);

  if (latest_shipment && lane) return {
    lane: lane.slug || lane.name,
    date: latest_shipment.start,
    locale: latest_shipment.finished.toLocaleString(),
  };

  if (latest_shipment) return {
    lane: '',
    date: '',
    locale: `recorded at ${latest_shipment.finished.toLocaleString()
    }, <b><i>and is orphaned (no lane found to match it).</b></i>`,
  };

  return {
    lane: '',
    date: '',
    locale: 'never',
  };
};

const log_shipment_totals = function () {
  console.log('Collecting shipment totals for each lane...');
  Lanes.find().forEach((lane) => {
    console.log(`Counting shipments for ${lane.name}...`);
    const shipments = Shipments.find({ lane: lane._id });
    const salvage = Shipments.find({
      lane: lane._id,
      exit_code: { $exists: true, $nin: [0, null] },
    });
    let shipment_count = shipments.count() || 0;
    let salvage_count = salvage.count() || 0;

    console.log(
      `${lane.name} counted:
    \tShipments: ${shipment_count}
    \tSalvage Runs: ${salvage_count}`
    );
  });
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
