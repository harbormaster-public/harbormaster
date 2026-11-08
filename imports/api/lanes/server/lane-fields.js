import { Lanes } from '..';

const internal_fields = [
  '_id', 'type', 'last_shipment', 'shipment_count', 'salvage_runs',
  'shipment_totals', 'shipment_history',
];

const editable_lane_fields = (lane) => Object.fromEntries(
  Object.entries(lane).filter(([key, value]) =>
    value !== undefined && !internal_fields.includes(key.split('.')[0])),
);

const save_lane_fields = async (lane, fields) => {
  if (lane.type && fields.type !== undefined && fields.type !== lane.type) {
    throw new Error(
      'A lane\'s harbor type cannot be changed; create a new lane',
    );
  }
  const saved = await Lanes.updateAsync({
    _id: lane._id,
    type: lane.type === undefined ? { $exists: false } : lane.type,
  }, { $set: fields });
  if (!saved) throw new Error('Lane changed; retry saving');
};

export { editable_lane_fields, save_lane_fields };
