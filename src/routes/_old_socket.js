const ia = require('../services/deepseek');
const User = require('../controllers/auth');
const Chats = require('../services/chats');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Um cliente se conectou:', socket.id);

    socket.on('send', async (data, callback) => {
      try {
        const { context = [], input, token, chatID: tempChatID, chat = [] } = data;
     
        // Novo chat
        if (context.length === 0) {
          const userPayload = await User.verifyTokenCache(token);
          if (!userPayload?.valid) {
            await socket.emit('logout');
            return callback({ status: 'error', error: 'Token inválido' });
          }

          const newChat = await Chats.rename(
            userPayload?.payload?.id,
            -1,
            'Pessoa desconhecida',
            null
          );

          if (!newChat?.insertId) throw new Error('Falha ao criar chat');

          const iaResponse = await ia.send(newChat?.insertId, input, [], token);
          const parsedResponse = JSON.parse(iaResponse);

          await Promise.all([
            Chats.addMessage(newChat?.insertId, input, 'user'),
            Chats.addMessage(newChat?.insertId, parsedResponse.reply, 'assistant')
          ]);

          // ⭐ Retorna o ID REAL do banco + ID temporário (se existir)
          return callback({
            status: 'success',
            reply: parsedResponse.reply,
            permanentChatID: newChat?.insertId, // ID definitivo
            tempChatID, // ID temporário do front
            chatName: parsedResponse?.name ?? null
          });
        }

        // Chat existente
        const iaResponse = await ia.send(data?.chatID, input, context, token, data?.chat);
        const parsedResponse = JSON.parse(iaResponse);

        if (parsedResponse?.shouldReply) {
          await Promise.all([
            Chats.addMessage(data.chatID, input, 'user'),
            Chats.addMessage(data.chatID, parsedResponse.reply, 'assistant')
          ]);
        }

        var retorno = {
          status: 'success',
          permanentChatID: data?.chatID,
          chatName: parsedResponse?.name ?? null
        };

        if (parsedResponse?.shouldReply) {
          retorno['reply'] = parsedResponse?.reply;
        }

        callback(retorno);

      } catch (error) {
        console.error('Erro no socket:', error);
        callback({
          status: 'error',
          error: error.message,
          code: 'INTERNAL_ERROR'
        });
      }
    });

    socket.on('sendEmpty', async (data, callback) => {
      try {
        const { input, context } = data;

        const iaResponse = await ia.sendEmpty(socket?.id, input, context);
        const parsedResponse = JSON.parse(iaResponse);

        var retorno = {
          status: 'success'
        };

        if (parsedResponse?.shouldReply) {
          retorno['reply'] = parsedResponse?.reply;
        }

        callback(retorno);
      } catch (error) {
        console.error('Erro no socket:', error);
        callback({
          status: 'error',
          error: error.message,
          code: 'INTERNAL_ERROR'
        });
      }
    });

    socket.on('register', async (data, callback) => {
      try {
        const result = await User.create(data);

        return callback(result);
      } catch (err) {
        console.error(err);
        return callback({
          status: 'error',
          error: err.message || 'Erro desconhecido no registro, contate o suporte.'
        });
      }
    });

    socket.on('login', async (data, callback) => {
      try {
        const result = await User.login(data);
        return callback(result);
      } catch (err) {
        console.error(err);
        return callback({
          status: 'error',
          error: err.message || 'Erro desconhecido no login, contate o suporte.'
        });
      }
    });

    socket.on('verifycode', async (data, callback) => {
      try {
        const result = await User.verifyCode(data);
        return callback(result);
      } catch (err) {
        console.error(err);
        return callback({
          status: 'error',
          error: err.message || 'Erro desconhecido na verificação do código, contate o suporte.'
        });
      }
    });

    socket.on('verifyToken', async (data, callback) => {
      try {
        const result = await User.verifyToken(data);
        return callback(result);
      } catch (err) {
        console.error(err);
        return callback({
          status: 'error',
          error: err.message || 'Erro desconhecido na verificação da sessão, faça login novamente.'
        });
      }
    });

    socket.on('resetpassword', async (email, callback) => {
      try {
        const result = await User.resetpassword(email);
        return callback(result);
      } catch (err) {
        console.error(err);
        return callback({
          status: 'error',
          error: err.message || 'Erro desconhecido na redefinição de senha, tente novamente.'
        });
      }
    });

    socket.on('updateprofile', async (data, callback) => {
      try {
        const result = await User.updateProfile(data);

        if (result?.status === 'error' && result?.logout) {
          await socket.emit('logout');
        }

        return callback(result);
      } catch (err) {
        console.error(err);
        return callback({
          status: 'error',
          error: err.message || 'Erro desconhecido na atualização do perfil, tente novamente.'
        });
      }
    });

    socket.on('changepw', async (data, callback) => {
      try {
        const result = await User.changepw(data, socket);

        if (result?.status === 'error' && result?.logout) {
          await socket.emit('logout');
        }

        return callback(result);
      } catch (err) {
        console.error(err);
        return callback({
          status: 'error',
          error: err.message || 'Erro desconhecido na redefinição de senha, tente novamente.'
        });
      }
    });

    socket.on('updateChatConfig', async (data, callback) => {
      try {
        const { token, chatID, column, value } = data;
       
        const userPayload = await User.verifyTokenCache(token);
        if (!userPayload?.valid) {
          await socket.emit('logout');
          return callback({ status: 'error', error: 'Token inválido' });
        }

        const userID = userPayload?.payload?.id;
        const result = await Chats.updateConfig(userID, chatID, column, value);
        
        if (result) {
          return callback({ status: 'success', data: result });
        } else {
          return callback({ status: 'error', error: 'Falha ao verificar atualização' });
        }
      } catch (err) {
        console.error(err);
        return callback({
          status: 'error',
          error: err.message || 'Erro desconhecido na atualização, tente novamente.'
        });
      }
    });

  });
}