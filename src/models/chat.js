const { Schema, model, Types } = require('mongoose');

const ParticipantSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User' },
  role: { type: String, default: 'member' },
  joinedAt: { type: Date, default: () => new Date() }
});

const ChatSchema = new Schema({
  type: { type: String, enum: ['direct', 'group'], required: true },
  participants: [ParticipantSchema],
  // canonical sorted member ids for quick direct-chat lookup (kept for compatibility)
  memberIds: [{ type: Types.ObjectId, ref: 'User' }],
  // string key built from sorted member ids (eg "id1_id2") used for unique direct-chat lookup
  memberKey: { type: String, index: true },
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
// unique index on memberKey for direct chats only (memberKey is a stable string)
ChatSchema.index({ memberKey: 1, type: 1 }, { unique: true, partialFilterExpression: { type: 'direct' } });

module.exports = model('Chat', ChatSchema);
