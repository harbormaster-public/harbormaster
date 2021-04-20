
class ShipmentCollection extends Mongo.Collection { }

const Shipments = new ShipmentCollection('Shipments');

class LatestShipmentCollection extends Mongo.Collection { }

const LatestShipment = new LatestShipmentCollection('LatestShipment');

export { Shipments, LatestShipment, };
