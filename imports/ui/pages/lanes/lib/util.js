import { Shipments } from '../../../../api/shipments';
import { Lanes } from '../../../../api/lanes';
import H from '../../../../startup/config/namespace';

const count = async (lane = { _id: '' }) => {
  const cursor = Shipments.find({ lane: lane._id });
  return await cursor.countAsync();
};

const history = function (lane, limit = H.AMOUNT_SHOWN, skip) {
  if (!lane?._id) return false;

  const result = Shipments.find(
    { lane: lane._id },
    {
      sort: { actual: -1 },
      limit,
      skip,
    }
  );
  return result;
};

const get_lane = (string) => {
  // The edit route uses /lanes/new/edit for unsaved lanes; never treat the
  // previous Session lane as the "new" lane.
  if (string === 'new' || string === 'New') return {};

  let found = Lanes.findOne({ $or: [
    { name: string },
    { slug: string },
    { _id: string },
  ] });
  if (found) return found;

  const lane = H.Session.get('lane');
  // Only fall back to Session lane if it matches the requested identifier,
  // otherwise callers can accidentally mutate the last edited lane.
  if (lane) {
    if (!string) return lane;
    if (
      lane._id === string ||
      lane.slug === string ||
      lane.name === string
    ) return lane;
  }

  return {};
};

export { count, history, get_lane };
