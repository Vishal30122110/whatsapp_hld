const mongoose = require('mongoose');
const path = require('path');

const { mongoUri } = require(path.join(__dirname, '..', 'src', 'config'));
const Chat = require(path.join(__dirname, '..', 'src', 'models', 'chat'));

async function main() {
  if (!mongoUri) {
    console.error('MONGO_URI not set in src/config.js');
    process.exit(1);
  }
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;
  const coll = db.collection('chats');

  try {
    // drop any existing problematic index on memberIds if present
    const idxs = await coll.indexes();
    const old = idxs.find(i => i.name === 'memberIds_1_type_1' || (i.key && i.key.memberIds && i.key.type));
    if (old) {
      console.log('Dropping old index', old.name);
      await coll.dropIndex(old.name);
    }

    // populate memberKey for direct chats that don't have it
    const directChats = await Chat.find({ type: 'direct' });
    for (const c of directChats) {
      if (!c.memberKey) {
        const ids = (c.participants || []).map(p => String(p.userId)).sort();
        c.memberIds = ids;
        c.memberKey = ids.join('_');
        await c.save();
        console.log('updated chat', c._id.toString());
      }
    }

    // create new partial unique index on memberKey
    console.log('Creating unique index on memberKey for direct chats');
    await coll.createIndex({ memberKey: 1, type: 1 }, { unique: true, partialFilterExpression: { type: 'direct' }, name: 'memberKey_1_type_1' });

    console.log('Migration complete');
  } catch (err) {
    console.error('Migration failed', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
