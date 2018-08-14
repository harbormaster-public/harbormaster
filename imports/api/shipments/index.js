
class ShipmentCollection extends Mongo.Collection { }

const Shipments = new ShipmentCollection('Shipments');

class LatestShipmentCollection extends Mongo.Collection { }

const LatestShipment = new LatestShipmentCollection('LatestShipment');

class ShipmentCountCollection extends Mongo.Collection { }

const ShipmentCount = new ShipmentCountCollection('ShipmentCount');

class SalvageCountCollection extends Mongo.Collection { }

const SalvageCount = new SalvageCountCollection('SalvageCount');

export { Shipments, LatestShipment, ShipmentCount, SalvageCount };
