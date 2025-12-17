const express = require('express');
const http = require('http');
const cors = require('cors');
const { connect } = require('./db');
const { port } = require('./config');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const usersRoutes = require('./routes/users');
const { attachSocket } = require('./ws');

async function start() {
  await connect();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/users', usersRoutes);

  const server = http.createServer(app);
  attachSocket(server);

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${port} already in use. Another process is listening on this port.`);
      process.exit(1);
    }
    console.error('Server error', err);
    process.exit(1);
  });

  server.listen(port, () => console.log(`Server listening on ${port}`));
}

start().catch((err) => {
  console.error('Failed to start', err);
  process.exit(1);
});
