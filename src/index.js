const express = require('express');
const http = require('http');
const cors = require('cors');
const { connect } = require('./db');
const { port } = require('./config');
const authRoutes = require('./routes/auth');
const { attachSocket } = require('./ws');

async function start() {
  await connect();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);

  const server = http.createServer(app);
  attachSocket(server);

  server.listen(port, () => console.log(`Server listening on ${port}`));
}

start().catch((err) => {
  console.error('Failed to start', err);
  process.exit(1);
});
