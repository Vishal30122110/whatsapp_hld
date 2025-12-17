const { Schema, model } = require('mongoose');

const DeviceSchema = new Schema({
  deviceId: String,
  pushToken: String,
  lastActiveAt: Date
});

const UserSchema = new Schema({
  username: { type: String },
  phoneNumber: { type: String, index: true, unique: true, sparse: true },
  passwordHash: { type: String },
  createdAt: { type: Date, default: () => new Date() },
  lastSeen: Date,
  devices: [DeviceSchema]
});

module.exports = model('User', UserSchema);
