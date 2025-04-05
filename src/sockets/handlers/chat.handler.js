const JwtService = require('../../services/jwt.service');
const db = require('../../config/mysql');
const ChatService = require('../../services/chat.service');
const UserService = require('../../services/user.service');

function registerChatHandlers(io, socket) {
  socket.on('message:send', async (data, callback) => {
    var permanentChatID = null;
    try {
      return await db.executeTransaction(async (conn) => {
        var { chatID, input } = data;
        if (!socket?.userToken || !input) throw new Error('Invalid params.');
        const token = socket?.userToken;

        const { valid, payload } = await JwtService.verifyTokenCache(token);
        if (!valid || payload?.userID === undefined) {
          await socket.emit('logout');
          throw new Error('Sessão inválida ou expirada, faça login novamente.');
        }

        const chat = await ChatService.getChatById(conn, chatID);
        console.log(chat, payload);
        if ((chat && chat?.length > 0) && chat[0]?.user !== payload?.userID) {
          await socket.emit('logout');
          throw new Error('Sessão inválida ou expirada, faça login novamente.');
        }

        const user = await UserService.findByID(payload?.userID);

        if (!chat || chat?.length <= 0) {
          permanentChatID = await ChatService.create(conn, user, '');
          const responseIA = await ChatService.Send.user({ id: permanentChatID }, user, input);

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

        const responseIA = await ChatService.Send.user(chat, user, input);
        if (responseIA?.shouldReply) {
          await Promise.all([
            ChatService.saveMessage(conn, chatID, input, 'user'),
            ChatService.saveMessage(conn, chatID, responseIA?.reply, 'assistant'),
          ]);
        }

        if (responseIA?.name) {
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
        permanentChatID: permanentChatID || data?.chatID,
        error: err?.message ?? 'Erro desconhecido'
      });
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

  socket.on('chat:train:save', async (data, callback) => {
    try {
      const { chatID, pairId, userMessage, assistantMessage } = data;
      if (!pairId || !userMessage || !assistantMessage || !chatID) throw new Error("Invalid params.");
      if (!socket?.userToken) {
        await socket.emit('logout');
        throw new Error('Sessão inválida ou expirada, faça login novamente.');
      }

      const object = {
        chatID,
        user: userMessage,
        assistant: assistantMessage
      };

      const id = await ChatService.Train.save(object);

      return callback({
        success: true,
        status: 'success',
        data: object,
        tempID: pairId,
        permanentID: id
      });
    } catch (err) {
      console.error(err?.message);
      return callback({
        success: false,
        status: 'error',
        error: err?.message ?? 'Erro desconhecido'
      });
    }
  });

  socket.on('chat:train:update', async (data, callback) => {
    try {
      console.log(data)
      const { chatID, pairId, userMessage, assistantMessage } = data;
      if (!pairId || !userMessage || !assistantMessage || !chatID) throw new Error("Invalid params.");
      if (!socket?.userToken) {
        await socket.emit('logout');
        throw new Error('Sessão inválida ou expirada, faça login novamente.');
      }

      const object = {
        chatID,
        pairId,
        user: userMessage,
        assistant: assistantMessage
      };

      await ChatService.Train.update(object);

      return callback({
        success: true,
        status: 'success',
        data: object
      });
    } catch (err) {
      console.error(err?.message);
      return callback({
        success: false,
        status: 'error',
        error: err?.message ?? 'Erro desconhecido'
      });
    }
  });

  socket.on('chat:train:delete', async (data, callback) => {
    try {
      const { pairId } = data;
      if (!pairId) throw new Error("Invalid params.");
      if (!socket?.userToken) {
        await socket.emit('logout');
        throw new Error('Sessão inválida ou expirada, faça login novamente.');
      }

      await ChatService.Train.delete(pairId);

      return callback({
        success: true,
        status: 'success',
        data: {}
      });
    } catch (err) {
      console.error(err?.message);
      return callback({
        success: false,
        status: 'error',
        error: err?.message ?? 'Erro desconhecido'
      });
    }
  });

  socket.on('message:empty:send', async (data, callback) => {
    try {
      const { message, pairId } = data;
      if (!message) throw new Error("Invalid params.");
      if (!pairId) throw new Error("Invalid params.");

      const responseIA = await ChatService.Send.empty(message, socket.id);

      return callback({
        success: true,
        message: responseIA?.reply,
        pairId: message?.id,
        shouldReply: responseIA?.shouldReply
      });
    } catch (err) {
      console.error(err);
      return callback({
        success: false,
        error: err?.message ?? 'Erro desconhecido'
      });
    }
  });

  socket.on('message:empty:like', async (data, callback) => {
    try {
      const { user, assistant } = data;
      if (!user) throw new Error("Invalid params.");
      if (!assistant) throw new Error("Invalid params.");

      return callback({ success: true });
    } catch (err) {
      console.error(err);
      return callback({
        success: false,
        error: err?.message ?? 'Erro desconhecido'
      });
    }
  });

  socket.on('message:empty:unlike', async (data, callback) => {
    try {
      const { user, assistant } = data;
      if (!user) throw new Error("Invalid params.");
      if (!assistant) throw new Error("Invalid params.");

      return callback({ success: true });
    } catch (err) {
      console.error(err);
      return callback({
        success: false,
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