import { createRequire } from 'node:module';
import {
  plan_sleep_migration, apply_sleep_migration,
} from '../imports/api/shipments/sleep-migration.js';

const require = createRequire(import.meta.url);
const { MongoClient } = require(process.env.MONGO_DRIVER || 'mongodb');
const apply = process.argv.includes('--apply');
const acknowledge = process.argv.includes('--acknowledge-current-settings');
const client = new MongoClient(process.env.MONGO_URL);

try {
  await client.connect();
  const db = client.db();
  const lanes = await db.collection('Lanes').find({ type: 'sleep' }).toArray();
  const shipments = await db.collection('Shipments').find({
    lane: { $in: lanes.map(lane => lane._id) }, active: true,
  }).toArray();
  const harbor = await db.collection('Harbors').findOne({ _id: 'sleep' });
  const plan = plan_sleep_migration(shipments, harbor);
  console.log(JSON.stringify(plan.report, null, 2));
  if (apply) {
    if (!acknowledge && plan.report.some(record => record.estimated)) {
      throw new Error('Review current settings, then use ' +
        '--acknowledge-current-settings with the application stopped');
    }
    console.log(JSON.stringify(await apply_sleep_migration(
      db.collection('Shipments'), plan,
    )));
  }
}
finally {
  await client.close();
}
