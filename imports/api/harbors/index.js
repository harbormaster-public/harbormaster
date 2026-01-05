class HarborCollection extends Mongo.Collection { }

export { HarborCollection };
export const HARBORS_COLLECTION_NAME = 'Harbors';
export const Harbors = new HarborCollection(HARBORS_COLLECTION_NAME);

