
class ShipmentCollection extends Mongo.Collection {}

export const SHIPMENTS_COLLECTION_NAME = 'Shipments';
const Shipments = new ShipmentCollection(SHIPMENTS_COLLECTION_NAME);

class LatestShipmentCollection extends Mongo.Collection {}

const LatestShipment = new LatestShipmentCollection('LatestShipment');

export { Shipments, LatestShipment };
