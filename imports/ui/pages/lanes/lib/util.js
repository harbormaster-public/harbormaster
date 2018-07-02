import { Shipments } from '../../../../api/shipments';
import { Lanes } from '../../../../api/lanes';

const count = (lane = { _id: false }) => {
  return Shipments.find({ lane: lane._id }).count();
};

const history = (lane) => {
  return Shipments.find({ lane: lane._id }, { sort: { actual: -1 } });
};

const get_lane = (string) => {
  return Lanes.findOne({ $or: [{ name: string }, { slug: string }] });
};

export { count, history, get_lane };
