const mongoose = require('mongoose');
const { mongoUri } = require('./config');

async function connect() {
  if (!mongoUri) {
    throw new Error('MONGO_URI is not set');
  }
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  console.log('MongoDB connected');
}

module.exports = { connect, mongoose };
