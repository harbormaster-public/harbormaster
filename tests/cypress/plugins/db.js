const { MongoClient } = require('mongodb');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EJSON } = require('bson');

const requireMongoUrl = function (mongoUrl) {
  if (!mongoUrl) {
    throw new Error(
      [
        'Mongo URL is required for Cypress DB tasks.',
        'Set MONGO_URL or CYPRESS_MONGO_URL in the environment, or set',
        'config.env.MONGO_URL in cypress config.',
      ].join(' ')
    );
  }
  return mongoUrl;
};

const tryGetMeteorEmbeddedMongoUrl = function () {
  // When running `meteor run` without MONGO_URL, Meteor starts an embedded
  // mongod.
  // The port is written to `.meteor/local/db/METEOR-PORT`.
  try {
    const port = fs
      .readFileSync('.meteor/local/db/METEOR-PORT', 'utf8')
      .trim();
    if (!port) return null;
    // Default embedded db name is `meteor`
    return `mongodb://127.0.0.1:${port}/meteor`;
  }
  catch (e) {
    console.error(e, 'Error getting Meteor embedded Mongo URL');
    return null;
  }
};

const withDb = async function (mongoUrl, fn) {
  const client = new MongoClient(requireMongoUrl(mongoUrl));
  await client.connect();
  try {
    // The db name is taken from the connection string path.
    const db = client.db();
    return await fn(db);
  }
  finally {
    await client.close();
  }
};

const parseBool = function (value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') return value;
  const s = String(value).toLowerCase().trim();
  if (['1', 'true', 'yes', 'y', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(s)) return false;
  return defaultValue;
};

const resetDb = async function (mongoUrl) {
  return await withDb(mongoUrl, async (db) => {
    // Collections used by the current E2E suite:
    // - Meteor accounts: 'users'
    // - App collections: 'Users', 'Harbors', 'Lanes', 'Shipments',
    //   'LatestShipment'
    const collectionsToClear = [
      'users',
      'Users',
      'Harbors',
      'Lanes',
      'Shipments',
      'LatestShipment',
    ];

    for (const name of collectionsToClear) {
      // deleteMany works whether or not the collection exists yet.
      await db.collection(name).deleteMany({});
    }

    return true;
  });
};

const listNonSystemCollections = async function (db) {
  const cols = await db.listCollections({}, { nameOnly: true }).toArray();
  return cols
    .map((c) => c.name)
    .filter((name) => name && !name.startsWith('system.'));
};

const snapshotDbToFile = async function (mongoUrl, snapshotFile) {
  return await withDb(mongoUrl, async (db) => {
    const collections = await listNonSystemCollections(db);
    const snapshot = {
      createdAt: new Date().toISOString(),
      dbName: db.databaseName,
      collections: {},
    };

    for (const name of collections) {
      const docs = await db.collection(name).find({}).toArray();
      snapshot.collections[name] = docs;
    }

    fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
    fs.writeFileSync(snapshotFile, EJSON.stringify(snapshot), 'utf8');
    return { snapshotFile, collections: collections.length };
  });
};

const restoreDbFromFile = async function (mongoUrl, snapshotFile) {
  if (!fs.existsSync(snapshotFile)) {
    throw new Error(`DB snapshot file not found: ${snapshotFile}`);
  }
  const raw = fs.readFileSync(snapshotFile, 'utf8');
  const snapshot = EJSON.parse(raw);

  return await withDb(mongoUrl, async (db) => {
    const snapshotCollections = Object.keys(snapshot?.collections || {});
    const currentCollections = await listNonSystemCollections(db);

    // Drop collections created during the run that weren't present before.
    for (const name of currentCollections) {
      if (!snapshotCollections.includes(name)) {
        await db.collection(name).drop().catch(() => {});
      }
    }

    // Restore collections that existed before the run.
    for (const name of snapshotCollections) {
      const docs = snapshot.collections[name] || [];
      const col = db.collection(name);
      await col.deleteMany({});
      if (docs.length) {
        // Keep existing _id values to match pre-run state.
        await col.insertMany(docs, { ordered: false });
      }
    }

    return { restoredCollections: snapshotCollections.length };
  });
};

const registerDbTasks = function (on, config) {
  let mongoUrl =
    config?.env?.MONGO_URL ||
    process.env.MONGO_URL ||
    process.env.CYPRESS_MONGO_URL;

  // If Meteor is using embedded dev mongo, auto-detect it from METEOR-PORT.
  if (!mongoUrl) {
    mongoUrl = tryGetMeteorEmbeddedMongoUrl();
  }

  // Default: preserve local dev DB state (but avoid slowing CI unless
  // explicitly enabled).
  const preserveDb = parseBool(
    config?.env?.PRESERVE_DB ?? process.env.CYPRESS_PRESERVE_DB,
    !process.env.CI
  );

  const snapshotFile =
    process.env.CYPRESS_DB_SNAPSHOT_FILE ||
    path.join(
      os.tmpdir(),
      `harbormaster-cypress-db-snapshot-${process.pid}.json`
    );

  let snapshotTaken = false;

  const snapshotIfEnabled = async function () {
    if (!preserveDb) return false;
    if (snapshotTaken) return true;
    await snapshotDbToFile(mongoUrl, snapshotFile);
    snapshotTaken = true;
    return true;
  };

  const restoreIfEnabled = async function () {
    if (!preserveDb) return false;
    if (!snapshotTaken) return false;
    await restoreDbFromFile(mongoUrl, snapshotFile);
    return true;
  };

  on('task', {
    'db:reset': () => resetDb(mongoUrl),
    // Optional manual controls (useful for debugging locally).
    'db:snapshot': () => snapshotIfEnabled(),
    'db:restore': () => restoreIfEnabled(),
  });

  return { snapshotIfEnabled, restoreIfEnabled };
};

module.exports = {
  registerDbTasks,
};


