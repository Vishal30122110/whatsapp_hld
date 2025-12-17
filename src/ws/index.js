const { Server } = require('socket.io');

const Message = require('../models/message');
const User = require('../models/user');
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

    // deliver undelivered messages for this user (messages where deliveredTo does not include user)
    (async () => {
      try {
        const chats = await Chat.find({ 'participants.userId': socket.userId }).select('_id');
        const chatIds = chats.map((c) => String(c._id));
        const pending = await Message.find({ chatId: { $in: chatIds }, deliveredTo: { $ne: socket.userId } }).sort({ createdAt: 1 });
        for (const m of pending) {
          io.to(uid).emit('message', {
            messageId: m.messageId,
            chatId: m.chatId,
            senderId: String(m.senderId),
            type: m.type,
            content: m.content,
            mentions: m.mentions,
            createdAt: m.createdAt
          });
          if (!m.deliveredTo.includes(socket.userId)) {
            m.deliveredTo.push(socket.userId);
            await m.save();
          }
        }
      } catch (err) {
        console.error('deliver pending error', err);
      }
    })();

    socket.on('join_chat', async (payload) => {
      try {
        const chatId = (typeof payload === 'string') ? payload : payload?.chatId;
        if (!chatId) return;
        socket.join(String(chatId));
        console.log(`socket ${socket.id} joined chat ${chatId}`);
      } catch (err) {
        console.error('join_chat error', err);
      }
    });

    socket.on('send_message', async (payload, cb) => {
      try {
        // payload: { clientMsgId, chatId, type, content }
        const clientMsgId = payload.clientMsgId || uuidv4();
        // dedupe via unique index
        const chat = await Chat.findById(payload.chatId);
        if (!chat) return cb && cb({ error: 'chat not found' });

        // detect @mentions in text messages (simple word-based regexp)
        let mentionIds = [];
        if (payload.type === 'text' && typeof payload.content === 'string') {
          const mentionNames = Array.from(new Set(payload.content.match(/@([a-zA-Z0-9_\-\.]+)/g) || [])).map((m) => m.slice(1));
          if (mentionNames.length) {
            const users = await User.find({ username: { $in: mentionNames } }).select('_id username');
            mentionIds = users.map((u) => u._id);
          }
        }

        const msg = await Message.create({
          messageId: clientMsgId,
          chatId: payload.chatId,
          senderId: socket.userId,
          type: payload.type || 'text',
          content: payload.content,
          mentions: mentionIds,
          serverReceivedAt: new Date()
        });

        // emit to chat room (if participants joined) and personal rooms as fallback
        try {
          const roomId = String(chat._id);
          io.to(roomId).emit('message', {
            messageId: msg.messageId,
            chatId: payload.chatId,
            senderId: String(socket.userId),
            type: msg.type,
            content: msg.content,
            mentions: msg.mentions,
            createdAt: msg.createdAt
          });
        } catch (err) {
          console.error('emit to room error', err);
        }

        const recipientIds = chat.participants.map((p) => String(p.userId));
        recipientIds.forEach((rid) => {
          try {
            io.to(rid).emit('message', {
              messageId: msg.messageId,
              chatId: payload.chatId,
              senderId: String(socket.userId),
              type: msg.type,
              content: msg.content,
              mentions: msg.mentions,
              createdAt: msg.createdAt
            });
          } catch (err) {
            console.error('emit to personal room error', err);
          }
        });

        // emit mention notifications to specifically mentioned users
        if (mentionIds && mentionIds.length) {
          mentionIds.forEach((mid) => {
            io.to(String(mid)).emit('mentioned', {
              messageId: msg.messageId,
              chatId: payload.chatId,
              from: String(socket.userId),
              at: msg.createdAt
            });
          });
        }

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
