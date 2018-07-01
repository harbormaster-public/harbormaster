import { Shipments } from '../../../../api/shipments';

const count = (lane = { _id: false }) => {
  return Shipments.find({ lane: lane._id }).count();
};

const history = (lane) => {
  return Shipments.find({ lane: lane._id }, { sort: { actual: -1 } });
};

export { count, history };
