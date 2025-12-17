const express = require('express');
const Chat = require('../models/chat');
const auth = require('../middlewares/auth');

const router = express.Router();

// List chats for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chats = await Chat.find({ 'participants.userId': userId }).sort({ updatedAt: -1 }).populate('participants.userId', 'username phoneNumber');
    res.json({ chats });
  } catch (err) {
    console.error('list chats error', err);
    res.status(500).json({ error: 'server error' });
  }
});

// Create or get a direct chat between the authenticated user and another user
router.post('/direct', auth, async (req, res) => {
  try {
    const userId = String(req.user._id);
    const otherId = String(req.body.otherUserId);
    if (!otherId) return res.status(400).json({ error: 'otherUserId required' });
    const mongoose = require('mongoose');
    const members = [String(userId), String(otherId)].sort();
    const memberKey = members.join('_');
    console.log('direct chat memberKey:', memberKey);
    let chat = await Chat.findOne({ memberKey, type: 'direct' });
    if (!chat) {
      chat = await Chat.create({ type: 'direct', participants: [{ userId }, { userId: otherId }], memberIds: members, memberKey });
    }
    res.json({ chatId: chat._id });
  } catch (err) {
    console.error('direct chat error', err);
    res.status(500).json({ error: 'server error' });
  }
});

// Create a group chat
router.post('/group', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, participantIds } = req.body; // participantIds optional array of user ids
    // normalize participant ids and dedupe
    const mongoose = require('mongoose');
    const participants = [{ userId }];
    if (Array.isArray(participantIds)) {
      const seen = new Set([String(userId)]);
      participantIds.forEach((pid) => {
        const pidStr = String(pid);
        if (pidStr === String(userId)) return;
        if (!seen.has(pidStr)) {
          seen.add(pidStr);
          participants.push({ userId: new mongoose.Types.ObjectId(pidStr) });
        }
      });
    }
    console.log('creating group', { name, participants });
    const chat = await Chat.create({ type: 'group', name: name || 'New Group', participants });
    res.json({ chatId: chat._id });
  } catch (err) {
    console.error('create group error', err);
    res.status(500).json({ error: 'server error' });
  }
});

// Create a simple demo chat for the authenticated user and return its id
router.post('/demo', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const members = [String(userId)];
    const chat = await Chat.create({ type: 'direct', participants: [{ userId }], memberIds: members });
    res.json({ chatId: chat._id });
  } catch (err) {
    console.error('create demo chat error', err);
    res.status(500).json({ error: 'server error' });
  }
});

// Fetch messages for a chat
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const chatId = req.params.id;
    const Message = require('../models/message');
    const messages = await Message.find({ chatId }).sort({ createdAt: 1 }).lean();
    res.json({ messages });
  } catch (err) {
    console.error('fetch messages error', err);
    res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;

