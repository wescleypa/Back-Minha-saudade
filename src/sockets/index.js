const socketIO = require('socket.io');
const chatHandler = require('./handlers/chat.handler');
const AuthHandler = require('./handlers/auth.handler');
const AuthService = require('../services/auth.service');
const JwtService = require('../services/jwt.service');

function configureSockets(server) {
  const io = socketIO(server);

  // Middleware global
  //io.use(authMiddleware.authenticate);

  io.on('connection', (socket) => {
    console.log('Novo cliente conectado:', socket.id);
    
    // Registrar handlers
    chatHandler.register(io, socket);
    AuthHandler.register(io, socket, AuthService, JwtService);
    
    socket.on('disconnect', () => {
      console.log('Cliente desconectado:', socket.id);
    });
  });

  return io;
}

module.exports = configureSockets;