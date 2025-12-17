const express = require('express');
const User = require('../models/user');
const auth = require('../middlewares/auth');

const router = express.Router();
router.get('/search', auth, async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.json({ users: [] });
    const regex = new RegExp(q, 'i');
    const users = await User.find({ $or: [{ phoneNumber: regex }, { username: regex }] }).select('_id username phoneNumber');
    const filtered = users.filter((u) => String(u._id) !== String(req.user._id));
    res.json({ users: filtered });
  } catch (err) {
    console.error('user search error', err);
    res.status(500).json({ error: 'server error' });
  }
});
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find({}).select('_id username phoneNumber createdAt');
    const filtered = users.filter((u) => String(u._id) !== String(req.user._id));
    res.json({ users: filtered });
  } catch (err) {
    console.error('list users error', err);
    res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
