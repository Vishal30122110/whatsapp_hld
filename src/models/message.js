const { Schema, model, Types } = require('mongoose');

const MessageSchema = new Schema({
  messageId: { type: String, required: true }, 
  chatId: { type: Types.ObjectId, ref: 'Chat', index: true },
  senderId: { type: Types.ObjectId, ref: 'User' },
  type: { type: String, default: 'text' },
  content: Schema.Types.Mixed,
  mentions: [{ type: Types.ObjectId, ref: 'User' }],
  attachments: [Schema.Types.Mixed],
  createdAt: { type: Date, default: () => new Date() },
  serverReceivedAt: Date,
  seqNum: Number,
  deliveredTo: [{ type: Types.ObjectId, ref: 'User' }],
  readBy: [{ type: Types.ObjectId, ref: 'User' }]
});

MessageSchema.index({ chatId: 1, seqNum: 1 });
MessageSchema.index({ chatId: 1, messageId: 1 }, { unique: true, sparse: true });

module.exports = model('Message', MessageSchema);
