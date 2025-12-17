const { Server } = require('socket.io');

const Message = require('../models/message');
const Chat = require('../models/chat');
const { v4: uuidv4 } = require('uuid');

const userSockets = new Map();

function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  io.use((socket, next) => {

    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Unauthorized'));    
    socket.userId = token;
    next();
  });

  io.on('connection', (socket) => {
    const uid = String(socket.userId);
    if (!userSockets.has(uid)) userSockets.set(uid, new Set());
    userSockets.get(uid).add(socket.id);

    socket.join(uid); // join personal room

    socket.on('send_message', async (payload, cb) => {
      try {
        // payload: { clientMsgId, chatId, type, content }
        const clientMsgId = payload.clientMsgId || uuidv4();
        // dedupe via unique index
        const chat = await Chat.findById(payload.chatId);
        if (!chat) return cb && cb({ error: 'chat not found' });

        const msg = await Message.create({
          messageId: clientMsgId,
          chatId: payload.chatId,
          senderId: socket.userId,
          type: payload.type || 'text',
          content: payload.content,
          serverReceivedAt: new Date()
        });

        // simple fan-out to chat participants (works for small groups)
        const recipientIds = chat.participants.map((p) => String(p.userId));
        recipientIds.forEach((rid) => {
          io.to(rid).emit('message', {
            messageId: msg.messageId,
            chatId: payload.chatId,
            senderId: String(socket.userId),
            type: msg.type,
            content: msg.content,
            createdAt: msg.createdAt
          });
        });

        cb && cb({ ok: true, messageId: msg.messageId });
      } catch (err) {
        console.error('send_message error', err);
        cb && cb({ error: 'server error' });
      }
    });

    socket.on('ack', async (payload) => {
      // payload: { messageId, chatId, ackType: 'delivered'|'read' }
      try {
        const m = await Message.findOne({ chatId: payload.chatId, messageId: payload.messageId });
        if (!m) return;
        if (payload.ackType === 'delivered') {
          if (!m.deliveredTo.includes(socket.userId)) {
            m.deliveredTo.push(socket.userId);
            await m.save();
          }
        } else if (payload.ackType === 'read') {
          if (!m.readBy.includes(socket.userId)) {
            m.readBy.push(socket.userId);
            await m.save();
          }
        }
        // notify sender (assumes sender subscribed to their personal room)
        io.to(String(m.senderId)).emit('message_status', {
          messageId: m.messageId,
          chatId: payload.chatId,
          userId: socket.userId,
          status: payload.ackType,
          at: new Date()
        });
      } catch (err) {
        console.error('ack error', err);
      }
    });

    socket.on('typing', (payload) => {
      // broadcast to chat participants
      Chat.findById(payload.chatId).then((chat) => {
        if (!chat) return;
        chat.participants.forEach((p) => {
          io.to(String(p.userId)).emit('typing', { fromUserId: String(socket.userId), chatId: payload.chatId, state: payload.state });
        });
      });
    });

    socket.on('disconnect', () => {
      const s = userSockets.get(uid);
      if (s) {
        s.delete(socket.id);
        if (s.size === 0) userSockets.delete(uid);
      }
    });
  });

  return io;
}

module.exports = { attachSocket };
