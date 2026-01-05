export {
  lane,
  pretty_date,
  duration,
  shipment_history,
  has_work_output,
} from '../../pages/lanes/ship_lane/lib';

const is_ready = function () {
  const shipments_ready = this.$subReady && this.$subReady.Shipments;
  const lanes_ready = this.$subReady && this.$subReady.Lanes;
  /* istanbul ignore next */
  if (!H.isTest) {
    console.log(`Shipments sub ready? ${shipments_ready}`);
    console.log(`Lanes sub ready? ${lanes_ready}`);
  }
  return (
    shipments_ready &&
    lanes_ready
  );
};

export {
  is_ready,
};
