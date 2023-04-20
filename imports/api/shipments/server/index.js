import {Shipments} from '..';
import {
  publish_shipments,
  get_total_shipments,
  last_shipped,
  total_completed_shipments,
  total_salvage_runs,
  get_latest_date,
  log_shipment_totals,
} from './methods';

Shipments.rawCollection().createIndex(
  { _id: 1, active: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { lane: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { lane: 1, active: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { lane: 1, exit_code: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { exit_code: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { active: 1, exit_code: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { actual: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { finished: 1 }, { background: true }
);
Shipments.rawCollection().createIndex(
  { start: 1, lane: 1 }, { background: true }
);

log_shipment_totals();

H.publish('Shipments', publish_shipments);

H.methods({
  'Shipments#get_total': get_total_shipments,
  'Shipments#last_shipped': last_shipped,
  'Shipments#total_completed_shipments': total_completed_shipments,
  'Shipments#total_salvage_runs': total_salvage_runs,
  'Shipments#get_latest_date': get_latest_date,
});
