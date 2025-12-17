const mongoose = require('mongoose');
const path = require('path');

// Load config from project src
const { mongoUri } = require(path.join(__dirname, '..', 'src', 'config'));

async function main() {
  if (!mongoUri) {
    console.error('MONGO_URI not set in src/config.js');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;
  const coll = db.collection('chats');

  try {
    console.log('Existing indexes:');
    const idxs = await coll.indexes();
    console.log(idxs.map(i => i.name));

    // drop any existing memberIds_1_type_1 index (could be older name)
    const existing = idxs.find(i => i.name === 'memberIds_1_type_1');
    if (existing) {
      console.log('Dropping index memberIds_1_type_1');
      await coll.dropIndex('memberIds_1_type_1');
    } else {
      // also try finding by keyPattern
      const byPattern = idxs.find(i => i.key && i.key.memberIds && i.key.type);
      if (byPattern) {
        console.log('Dropping index', byPattern.name);
        await coll.dropIndex(byPattern.name);
      }
    }

    console.log('Creating partial unique index for direct chats...');
    await coll.createIndex(
      { memberIds: 1, type: 1 },
      { unique: true, partialFilterExpression: { type: 'direct' }, name: 'memberIds_1_type_1' }
    );

    console.log('Index created successfully');
  } catch (err) {
    console.error('Failed to update indexes', err);
    process.exitCode = 2;
  } finally {
    await mongoose.disconnect();
  }
}

main();
