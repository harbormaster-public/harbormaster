import { Shipments } from '../../../../api/shipments';
import { Lanes } from '../../../../api/lanes';
import H from '../../../../startup/config/namespace';

const count = (lane = { _id: '' }) => {
  return Shipments.find({ lane: lane._id }).count();
};

const history = function (lane, limit = H.AMOUNT_SHOWN, skip) {
  return lane?._id ?
    Shipments.find(
      { lane: lane._id },
      {
        sort: { actual: -1 },
        limit,
        skip,
      }
    ) :
    false
  ;
};

const get_lane = (string) => {
  let lane;

  if (string) lane = Lanes.findOne({
    $or: [{ name: string }, { slug: string }],
  });
  if (!lane) lane = H.Session.get('lane');
  if (lane && (
    lane.name == string || lane.slug == string || lane._id == string
  )) return lane;
  if (lane && !string || lane?.name) return lane;
  return {};
};

export { count, history, get_lane };
