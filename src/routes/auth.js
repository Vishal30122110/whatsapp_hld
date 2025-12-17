const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/user');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { phoneNumber, username, password } = req.body;
  if (!phoneNumber || !password) return res.status(400).json({ error: 'phoneNumber and password required' });
  const existing = await User.findOne({ phoneNumber });
  if (existing) return res.status(400).json({ error: 'Phone number already registered' });
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ phoneNumber, username, passwordHash: hash });

  const token = String(user._id);
  res.json({ user: { id: user._id, phoneNumber, username }, token });
});

router.post('/login', async (req, res) => {
  const { phoneNumber, password } = req.body;
  if (!phoneNumber || !password) return res.status(400).json({ error: 'phoneNumber and password required' });
  const user = await User.findOne({ phoneNumber });
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
  const token = String(user._id);
  res.json({ user: { id: user._id, phoneNumber: user.phoneNumber, username: user.username }, token });
});

module.exports = router;
