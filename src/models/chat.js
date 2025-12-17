const { Schema, model, Types } = require('mongoose');

const ParticipantSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User' },
  role: { type: String, default: 'member' },
  joinedAt: { type: Date, default: () => new Date() }
});

const ChatSchema = new Schema({
  type: { type: String, enum: ['direct', 'group'], required: true },
  participants: [ParticipantSchema],
  // canonical sorted member ids for quick direct-chat lookup
  memberIds: [{ type: Types.ObjectId, ref: 'User' }],
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

// index for membership lookup
ChatSchema.index({ 'participants.userId': 1 });
// unique index for direct chats by sorted memberIds and type only applies to direct chats
// use a partial index so groups (which don't set memberIds) won't collide on undefined
ChatSchema.index(
  { memberIds: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'direct' } }
);

module.exports = model('Chat', ChatSchema);
