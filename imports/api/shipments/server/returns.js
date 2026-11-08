import { Mongo } from 'meteor/mongo';
import { v4 as uuidv4 } from 'uuid';
import { Shipments } from '..';

const ShipmentReturns = new Mongo.Collection('ShipmentReturns', {
  defineMutationMethods: false,
});

const return_value = async (return_id) => {
  const saved = await ShipmentReturns.findOneAsync(return_id);
  if (!saved) throw new Error('Shipment return was not saved');
  return saved.value;
};

const shipment_result = async (shipment, stage = 'dispatch') => {
  const receipt = shipment[stage];
  if (receipt?.has_result === false) return undefined;
  if (!receipt?.return_id) return shipment.manifest;
  if (receipt.pending === false) throw new Error(receipt.error);
  return await return_value(receipt.return_id);
};

const checkpoint_return = async (
  shipment, selector, result, stage = 'dispatch',
) => {
  const owned = await Shipments.findOneAsync(selector, { fields: { _id: 1 } });
  if (!owned) return undefined;
  const has_result = result !== undefined;
  let value = result;
  let return_id = shipment[stage].return_id;
  if (has_result) {
    if (!return_id) {
      return_id = uuidv4();
      const reserved = await Shipments.updateAsync(selector, { $set: {
        [`${stage}.return_id`]: return_id,
      } });
      if (!reserved) return undefined;
    }
    await ShipmentReturns.upsertAsync(return_id, {
      $setOnInsert: { value: result },
    });
    value = await return_value(return_id);
  }
  const update = { $set: {
    [`${stage}.returned`]: true, [`${stage}.has_result`]: has_result,
  } };
  if (!has_result) update.$unset = { [`${stage}.return_id`]: '' };
  const saved = await Shipments.updateAsync(selector, update);
  if (!saved) return undefined;
  const receipt = has_result ? { has_result, return_id } : { has_result };
  return { receipt, result: value };
};

export { ShipmentReturns, shipment_result, checkpoint_return };
