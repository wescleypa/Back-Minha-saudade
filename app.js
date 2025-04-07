const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const router = require('./src/routes/index');
const cors = require('cors');
const configureSockets = require('./src/sockets/index');
const Config = require('./src/services/config.service');
const ChatService = require('./src/services/chat.service');
const WPP = require('./src/controllers/wppController');

// Middleware to parse JSON
app.use(express.json());

// Enable CORS for POST and GET requests
app.use(cors({
  methods: ['GET', 'POST']
}));

// Example route
app.use(router);

const io = configureSockets(server);

// Start Server
const PORT = 3000;
server.listen(PORT, async () => {
  const roles = await Config.roles.get();
  const train = await Config.train.get();

  await ChatService.configureRoles(roles);
  await ChatService.configureTrain(train);

  await WPP.start();
  WPP.SetIO(io);

  console.log(`Server is running on http://localhost:${PORT}`);
});