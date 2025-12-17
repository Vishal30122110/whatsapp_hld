const { Schema, model, Types } = require('mongoose');

const ParticipantSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User' },
  role: { type: String, default: 'member' },
  joinedAt: { type: Date, default: () => new Date() }
});

const ChatSchema = new Schema({
  type: { type: String, enum: ['direct', 'group'], required: true },
  participants: [ParticipantSchema],
  name: String,
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: Date,
  lastMessage: {
    messageId: String,
    text: String,
    timestamp: Date
  },
  seqCounter: { type: Number, default: 0 }
});

ChatSchema.index({ 'participants.userId': 1 });

module.exports = model('Chat', ChatSchema);
