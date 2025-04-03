const JwtService = require('../../services/jwt.service');
const db = require('../../config/mysql');
const ChatService = require('../../services/chat.service');

function registerChatHandlers(io, socket) {
  socket.on('message:send', async (data, callback) => {
    try {
      return await db.executeTransaction(async (conn) => {
        var { input, chat, user, chatID } = data;
        if (!socket?.userToken || !input || !chat || user?.token !== socket?.userToken) throw new Error('Invalid params.');
        const token = socket?.userToken;

        const { valid, payload } = await JwtService.verifyTokenCache(token);
        if (!valid || payload?.userID === undefined) {
          await socket.emit('logout');
          throw new Error('Sessão inválida ou expirada, faça login novamente.');
        }

        //Verifica se é um novo chat
        if (!chat || chat?.length <= 0) {
          isNewChat = chatID;
          const permanentChatID = await ChatService.create(conn, user, '');
          const responseIA = await ChatService.send({ id: permanentChatID }, user, input);

          if (responseIA?.name) {
            await ChatService.update(conn, permanentChatID, 'name', responseIA?.name, user, []);
          }

          await Promise.all([
            ChatService.saveMessage(conn, permanentChatID, input, 'user'),
            ChatService.saveMessage(conn, permanentChatID, responseIA.reply, 'assistant')
          ]);

          return callback({
            status: 'success',
            reply: responseIA.reply,
            permanentChatID, // ID definitivo
            tempChatID: chatID, // ID temporário do front
            chatName: responseIA?.name ?? null
          });
        }

        const responseIA = await ChatService.send(chat, user, input);
        if (responseIA?.shouldReply) {
          await Promise.all([
            ChatService.saveMessage(conn, chatID, input, 'user'),
            ChatService.saveMessage(conn, chatID, responseIA?.reply, 'assistant'),
          ]);
        }

        if (responseIA?.name) {
          console.log('chat before ', chat);
          await ChatService.update(conn, chatID, 'name', responseIA?.name, user, chat);
        }

        var retorno = {
          status: 'success',
          permanentChatID: chatID,
          chatName: responseIA?.name ?? null
        };

        if (responseIA?.shouldReply) {
          retorno['reply'] = responseIA?.reply;
        }

        return callback(retorno);
      });
    } catch (err) {
      console.error(err?.message);
      return callback({
        status: 'error',
        error: err?.message ?? 'Erro desconhecido'
      });
      //HANDLE ERRO WITH CALLBACK
    }
  });

  socket.on('chat:update', async (data, callback) => {
    try {
      const { chatID, column, value, user, chat } = data;
      if (!chatID || !column || !value || !user || !chat) throw new Error("Invalid params.");
      if (!socket?.userToken) {
        await socket.emit('logout');
        throw new Error('Sessão inválida ou expirada, faça login novamente.');
      }

      var result = null;

      if (column === 'name') {
        result = await ChatService.update(null, chatID, 'name', value, user, chat);
      } else if (column === 'avatar') {
        result = await ChatService.uploadAvatar(chatID, value, user, chat);
      }
      else {
        result = await ChatService.updateConfig(null, chatID, column, value, user, chat);
      }

      return callback({
        status: 'success',
        data: result
      });
    } catch (err) {
      console.error(err?.message);
      return callback({
        status: 'error',
        error: err?.message ?? 'Erro desconhecido'
      });
    }
  });

  socket.on('message:delete', (messageId) => {
    // Lógica para deletar mensagem
    socket.broadcast.emit('message:removed', messageId);
  });
}

module.exports = {
  register: registerChatHandlers
};