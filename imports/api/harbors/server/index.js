import { Harbors, HARBORS_COLLECTION_NAME } from '..';
import { Lanes } from '../../lanes';
import {
  update_harbor,
  render_input,
  render_work_preview,
  get_constraints,
  register,
  remove,
  add_harbor_to_depot,
} from './methods';

Meteor.publish(HARBORS_COLLECTION_NAME, function (view, slug) {
  // Synchronous publications must not return Promises. If we need async lookups
  // (e.g. lane-by-slug), we publish via observeChanges instead of returning a
  // cursor directly.
  if (view !== '/ship') return Harbors.find();

  const sub = this;
  void (async () => {
    try {
      const lane = await Lanes.findOneAsync({ slug });
      if (!lane?.type) {
        sub.ready();
        return;
      }

      // We can't `await` and then `return` a cursor from a publication handler,
      // so we publish manually via observeChanges.
      const cursor = Harbors.find({ _id: lane.type });
      const handle = cursor.observeChanges({
        added: (id, fields) => {
          sub.added(HARBORS_COLLECTION_NAME, id, fields);
        },
        changed: (id, fields) => {
          sub.changed(HARBORS_COLLECTION_NAME, id, fields);
        },
        removed: (id) => {
          sub.removed(HARBORS_COLLECTION_NAME, id);
        },
      });
      sub.onStop(() => {
        if (handle && typeof handle.stop === 'function') handle.stop();
      });
      sub.ready();
    }
    catch (e) {
      sub.error(e);
    }
  })();

  // Publication handlers must return a cursor (sync) or nothing. We publish
  // asynchronously via observeChanges above.
  return undefined;
});

Meteor.methods({
  'Harbors#update': update_harbor,
  'Harbors#render_input': render_input,
  'Harbors#render_work_preview': render_work_preview,
  'Harbors#get_constraints': get_constraints,
  'Harbors#register': register,
  'Harbors#space_avail': () => {
    return H.space_avail;
  },
  'Harbors#remove': remove,
  'Harbors#add_harbor_to_depot': add_harbor_to_depot,
});

