import { Shipments } from '../../../../api/shipments';
import { Lanes } from '../../../../api/lanes';

const count = (lane = { _id: false }) => {
  return Shipments.find({ lane: lane._id }).count();
};

const history = (lane, limit) => {
  return lane ? 
    Shipments.find({ lane: lane._id }, { sort: { actual: -1 }, limit }) :
    false;
};

const get_lane = (string) => {
  const lane =  Lanes.findOne({ $or: [{ name: string }, { slug: string }] });
  return lane;
};

export { count, history, get_lane };
