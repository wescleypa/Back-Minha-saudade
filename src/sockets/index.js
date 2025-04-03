const socketIO = require('socket.io');
const chatHandler = require('./handlers/chat.handler');
const AuthHandler = require('./handlers/auth.handler');
const AuthService = require('../services/auth.service');
const JwtService = require('../services/jwt.service');
const UserService = require('../services/user.service');
const ChatService = require('../services/chat.service');
const EmailService = require('../services/email.service');

function configureSockets(server) {
  const io = socketIO(server);

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (token) {
      JwtService.verifyTokenCache(token)
        .then(async ({ valid, payload }) => {
          if (valid) {
            socket.userToken = token;
            socket.userID = payload.userID;
            next();
          } else {
            await socket.emit('logout');
            next(new Error('Invalid token'));
          }
        })
        .catch(err => next(err));
    } else {
      next();
    }
  });

  // Middleware global
  //io.use(authMiddleware.authenticate);

  io.on('connection', (socket) => {
    console.log('Novo cliente conectado:', socket.id);

    // Registrar handlers
    chatHandler.register(io, socket);
    AuthHandler.register(io, socket, AuthService, JwtService, UserService, ChatService, EmailService);

    socket.on('disconnect', () => {
      console.log('Cliente desconectado:', socket.id);
    });
  });

  return io;
}

module.exports = configureSockets;