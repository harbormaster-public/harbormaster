import { Shipments } from '../../../../api/shipments';

const count = (lane) => {
  return Shipments.find({ lane: lane._id }).count();
};

const history = (lane) => {
  return Shipments.find({ lane: lane._id });
};

export { count, history };
