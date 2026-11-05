const internal_fields = [
  '_id', 'last_shipment', 'shipment_count', 'salvage_runs',
  'shipment_totals', 'shipment_history',
];

const editable_lane_fields = (lane) => Object.fromEntries(
  Object.entries(lane).filter(([key, value]) =>
    value !== undefined && !internal_fields.includes(key.split('.')[0])),
);

export { editable_lane_fields };
