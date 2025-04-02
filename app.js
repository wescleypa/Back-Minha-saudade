const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sockets = require('./src/routes/socket');
const app = express();
const server = http.createServer(app);
const router = require('./src/routes/index');
const cors = require('cors');
const configureSockets = require('./src/sockets/index');

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
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});