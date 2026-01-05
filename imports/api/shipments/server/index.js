import { Shipments, SHIPMENTS_COLLECTION_NAME } from '..';
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
  { _id: 1, active: 1 }, { background: true },
);
Shipments.rawCollection().createIndex(
  { lane: 1 }, { background: true },
);
Shipments.rawCollection().createIndex(
  { lane: 1, active: 1 }, { background: true },
);
Shipments.rawCollection().createIndex(
  { lane: 1, exit_code: 1 }, { background: true },
);
Shipments.rawCollection().createIndex(
  { exit_code: 1 }, { background: true },
);
Shipments.rawCollection().createIndex(
  { active: 1, exit_code: 1 }, { background: true },
);
Shipments.rawCollection().createIndex(
  { actual: 1 }, { background: true },
);
Shipments.rawCollection().createIndex(
  { finished: 1 }, { background: true },
);
Shipments.rawCollection().createIndex(
  { start: 1, lane: 1 }, { background: true },
);

log_shipment_totals();

const publishCursor = (sub, collectionName, cursor) => {
  if (!collectionName || typeof cursor?.observeChanges !== 'function') {
    sub.ready();
    return undefined;
  }
  const handle = cursor.observeChanges({
    added: (id, fields) => sub.added(collectionName, id, fields),
    changed: (id, fields) => sub.changed(collectionName, id, fields),
    removed: (id) => sub.removed(collectionName, id),
  });
  sub.onStop(() => {
    // Some test/runtime environments may not return a standard observe handle.
    // Avoid throwing from onStop callbacks (DDP will log these loudly).
    if (handle && typeof handle.stop === 'function') handle.stop();
  });
  sub.ready();
  return handle;
};

H.publish(SHIPMENTS_COLLECTION_NAME, function (lanes, options = {}) {
  const sub = this;
  void (async () => {
    try {
      const cursor = await publish_shipments(lanes, options);
      publishCursor(sub, SHIPMENTS_COLLECTION_NAME, cursor);
    }
    catch (e) {
      sub.error(e);
    }
  })();
});

H.methods({
  'Shipments#get_total': get_total_shipments,
  'Shipments#last_shipped': last_shipped,
  'Shipments#total_completed_shipments': total_completed_shipments,
  'Shipments#total_salvage_runs': total_salvage_runs,
  'Shipments#get_latest_date': get_latest_date,
});
