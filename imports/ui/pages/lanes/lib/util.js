import { Shipments } from '../../../../api/shipments';
import { Lanes } from '../../../../api/lanes';
import H from '../../../../startup/config/namespace';

const count = (lane = { _id: '' }) => {
  return Shipments.find({ lane: lane._id }).count();
};

const history = (lane, limit = H.AMOUNT_SHOWN) => {
  return lane?._id ?
    Shipments.find({ lane: lane._id }, { sort: { actual: -1 }, limit }) :
    false;
};

const get_lane = (string) => {
  let lane;

  if (string) lane = Lanes.findOne({
    $or: [{ name: string }, { slug: string }],
  });
  if (!lane) lane = Session.get('lane');
  if (lane && (
    lane.name == string || lane.slug == string || lane._id == string
  )) return lane;
  if (lane && !string) return lane;
  return {};
  // if (lane && string && lane.name != string && lane.slug != string) return {};
  // return lane ? lane : {};
};

export { count, history, get_lane };
