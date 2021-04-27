import { Shipments } from '../../../api/shipments';
import { 
  history, 
  get_lane,
 } from '../../pages/lanes/lib/util';
 import {
   lane,
   pretty_date,
   duration,
 } from '../../pages/lanes/ship_lane/lib';

const shipment_history = function () {
  let shipments = history(get_lane(this.$route.params.slug), H.AMOUNT_SHOWN);
  return shipments;
};

const has_work_output = function () {
  let lane = get_lane(this.$route.params.slug);
  let date = this.$route.params.date;
  let shipment = Shipments.findOne({ lane: lane?._id, start: date });
  let any_shipment = Shipments.findOne({ lane: lane?._id });
  
  if (
    shipment && (
      Object.keys(shipment.stdout).length || 
      Object.keys(shipment.stderr).length || 
      shipment.exit_code == 0
      ) ||
    any_shipment
  ) {
    return true;
  }

  return false;
};

export {
  has_work_output,
  shipment_history,
  lane,
  pretty_date,
  duration,
}