function registerChatHandlers(io, socket) {
  socket.on('message:send', (data) => {
    // Lógica de negócio aqui
    io.emit('message:receive', data);
  });

  socket.on('message:delete', (messageId) => {
    // Lógica para deletar mensagem
    socket.broadcast.emit('message:removed', messageId);
  });
}

module.exports = {
  register: registerChatHandlers
};