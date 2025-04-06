const db = require('../config/mysql');
const Config = require('../config/deepseek');
const ConfigApp = require('./config.service');
const ImageService = require('./image.service');
const { GoogleGenAI, Type } = require('@google/genai');
const { getTrain, ignoreMessage } = require('../utils/functions.chat');
const ai = new GoogleGenAI({
  apiKey: process.env.AI_KEY || "MY KEY"
});

var roles = [];
var train = [];

class ChatService {
  static configureRoles = (r) => roles = r;
  static configureTrain = (t) => train = t;

  static columnsConfig = [
    'config.role',
    'config.bio',
    'config.objetivo_conversa',
    'config.estilo_comunicacao',
    'config.sensibilidade',
    'config.empatia',
    'config.referencias_culturais',
    'config.humor',
    'config.nascimento',
    'config.idade',
    'config.relacao',
    'config.aspecto',
    'config.tempo_saudade',
    'config.lembranca',
    'config.history',
    'config.extrals'
  ];

  static getAllChats = async (userID) => {

    if (!userID) throw new Error('Invalid params');

    const sql = `
    SELECT 
      chat.id AS id,
      chat.*,
      ${this.columnsConfig.join(',')},
      CASE 
        WHEN COUNT(message.id) = 0 THEN JSON_ARRAY()
        ELSE JSON_ARRAYAGG(
          JSON_OBJECT('id', message.id, 'text', message.message, 'sender', message.from, 'time', message.created)
        )
      END AS messages
    FROM chats chat
      LEFT JOIN chat_messages message ON chat.id = message.chat
      LEFT JOIN chat_config config ON config.chat = chat.id
    WHERE chat.user = ?
    GROUP BY chat.id
    ORDER BY id DESC`;

    var result = await db.query(sql, [userID]);

    return result;
  };

  static getChatById = async (conn, chatID) => {
    const connection = conn || db;
    if (!chatID) throw new Error('Invalid params');

    const sql = `
    SELECT 
  chat.id AS id,
  chat.*,
  ${this.columnsConfig.join(',')},
  CASE 
    WHEN (
      SELECT COUNT(*) 
      FROM chat_messages 
      WHERE chat_messages.chat = chat.id
    ) = 0 THEN JSON_ARRAY()
    ELSE (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'id', chat_messages.id, 
          'text', chat_messages.message, 
          'sender', chat_messages.from, 
          'timestamp', chat_messages.created
        )
      )
      FROM chat_messages
      WHERE chat_messages.chat = chat.id
      ORDER BY chat_messages.id DESC
    )
  END AS messages
FROM chats chat
LEFT JOIN chat_config config ON config.chat = chat.id
WHERE chat.id = ?
GROUP BY chat.id
ORDER BY id DESC`;

    var [result] = await connection.query(sql, [chatID]);

    return result;
  };

  static activeChats = {};
  static configure = {
    user: async (chatID, userData, chat = []) => {
      try {

        if (!this.activeChats[chatID]) {
          this.activeChats[chatID] = ai.chats.create({
            model: "gemini-2.0-flash",
            //history: this._formatHistory(history) //histórico de importação
            config: {
              systemInstruction: Config.initialMessage.user(chat[0]?.messages || [], userData?.name, chat),
              maxOutputTokens: 300,
              temperature: 0.7,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  'shouldReply': {
                    type: Type.BOOLEAN,
                    description: 'Enviar resposta ?',
                    nullable: false,
                  },
                  'reply': {
                    type: Type.STRING,
                    description: 'Sua resposta',
                    nullable: false,
                  },
                  'reason': {
                    type: Type.STRING,
                    description: 'Motivo de não enviar a resposta',
                    nullable: true,
                  },
                  'name': {
                    type: Type.STRING,
                    description: "Se identificar o nome da 'saudade' do usuário, retorne o nome para salvar no bd, mas retorne apenas na msg atual, assim evita retornar toda hora.",
                    nullable: true
                  }
                },
                required: ['shouldReply', 'reply'],

              },
            }
          });
        }

        return this.activeChats[chatID];
      } catch (error) {
        console.error(error);
        throw new Error('Falha ao configurar chat, tente novamente ou contate o suporte.');
      }
    },

    empty: async (socketID, context, aditional = null) => {
      if (!this.activeChats[socketID]) {
        this.activeChats[socketID] = ai.chats.create({
          model: "gemini-2.0-flash",
          config: {
            systemInstruction: `${Config.initialMessage.empty(roles, train, context)}\n\n${aditional}`,
            maxOutputTokens: 300,
            temperature: 0.7,
            tools: [{
              functionDeclarations: [getTrain, ignoreMessage]
            }],
            toolConfig: {
              functionCallingConfig: {
                mode: 'AUTO'
              }
            }
          }
        });
      }

      return this.activeChats[socketID];
    }
  }

  static create = async (conn, userData, name) => {
    try {
      const connection = conn || db;
      const [result] = await connection.query('INSERT INTO chats (user, name, viewed) VALUES (?, ?, 1)', [userData?.id, name]);
      await this.configure.user(result?.insertId, userData);

      return result?.insertId;
    } catch (error) {
      console.error(error);
      throw new Error('Falha ao criar chat, tente novamente ou contate o suporte.');
    }
  };

  static Send = {
    user: async (chatData, userData, input) => {
      try {
        const chat = await this.configure.user(chatData?.id, userData, chatData);

        const result = await chat.sendMessage({ message: input });
        const parsedResponse = JSON.parse(result?.text);

        return parsedResponse;
      } catch (err) {
        console.error(err);
        throw new Error('Falha ao enviar mensagem para IA, tente novamente ou contate o suporte.');
      }
    },

    empty: async (message, socketID, context = []) => {
      var chat = await this.configure.empty(socketID, this.formatContext(context));
      var response = await chat.sendMessage({ message });

      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0]; // Assuming one function call

        if (functionCall?.name === 'get_train') {
          const train = await ConfigApp.train.get(functionCall?.args?.limit);
          this.deleteChat.empty(socketID);
          chat = await this.configure.empty(
            socketID, this.formatContext(context),
            `Você solicitou treinamento, aqui está o resultado: \n ${train}\n\n msg anterior do usuário a seguir.`
          );

          response = await chat.sendMessage({ message });
          console.log(response);

          return response;
        }

        console.log(`Function to call: ${functionCall.name}`);
        console.log(`Arguments: ${JSON.stringify(functionCall.args)}`);
        // In a real app, you would call your actual function here:
        // const result = await scheduleMeeting(functionCall.args);
      } else {
        console.log("No function call found in the response.");
        console.log(response.text);

        return response;
      }
    }
  }

  static saveMessage = async (conn, chatID, message, role) => {
    try {
      const connection = conn || db;
      const sql = 'INSERT INTO chat_messages (chat, message, `from`) VALUES (?, ?, ?)';
      const result = await connection.query(sql, [chatID, message, role]);

      return result;
    } catch (err) {
      console.error(err);
      throw new Error('Falha ao registrar mensagem, tente novamente ou contate o suporte.');
    }
  };

  static update = async (conn = null, chatID, column, value, userData, chatData = []) => {
    try {
      const connection = conn || db;
      const sql = `UPDATE chats SET ${column} = ? WHERE id = ?`;

      const result = await connection.query(sql, [value, chatID]);

      delete this.activeChats[chatID];
      await this.configure.user(chatID, userData, chatData);

      return result;
    } catch (err) {
      console.error(err);
      throw new Error('Falha ao atualizar chat, atualize a página ou contate o suporte.');
    }
  };

  static updateConfig = async (conn = null, chatID, column, value, userData, chatData = []) => {
    try {
      const connection = conn || db;
      const sql = `
      INSERT INTO chat_config (chat, ${column})
        VALUES (?, ${column === 'extrals' && Array.isArray(value) ? 'JSON_ARRAY(?)' : '?'})
      ON DUPLICATE KEY UPDATE
        ${column} = ${column === 'extrals' && Array.isArray(value) ? 'JSON_ARRAY(?)' : '?'}`;

      const valUse = column === 'extrals' && Array.isArray(value) ? value.join(',') : value;
      const result = await connection.query(sql, [chatID, valUse, valUse]);

      delete await this.activeChats[chatID];
      await this.configure.user(chatID, userData, chatData);

      return result;
    } catch (err) {
      console.error(err);
      throw new Error('Falha ao atualizar chat, atualize a página ou contate o suporte.');
    }
  };

  static uploadAvatar = async (chatID, value, userData, chatData) => {
    try {
      await ImageService.uploadImage(chatID, './src/chats/pic', value);
      delete await this.activeChats[chatID];
      await this.configure.user(chatID, userData, chatData);
      return true;
    } catch (err) {
      console.error(err);
      throw new Error('Falha ao atualizar chat, atualize a página ou contate o suporte.');
    }
  };

  static changeView = async (chatID, value = 1) => {
    try {
      const sql = `UPDATE chats SET viewed = ? WHERE id = ?`;
      const result = await db.query(sql, [value, chatID]);
      return result;
    } catch (err) {
      console.error(err);
      throw new Error('Falha ao atualizar chat, atualize a página ou contate o suporte.');
    }
  };

  static Train = {
    save: {
      user: async (data) => {
        const { chatID, user, assistant } = data;

        const result = await db.query(
          'INSERT INTO chat_train (chat, user, assistant) VALUES (?, ?, ?)',
          [chatID, user, assistant]
        );

        return result?.insertId;
      },
      empty: async (user, assistant, type) => {
        const result = await db.query(
          'INSERT INTO geral_train (user, assistant, type) VALUES (?, ?, ?)',
          [user, assistant, type]
        );

        return result;
      }
    },

    update: async (data) => {
      const { pairId, user, assistant } = data;

      await db.query(
        'UPDATE chat_train SET user = ?, assistant = ? WHERE id = ?',
        [user, assistant, pairId]
      );

      return { success: true };
    },

    delete: async (pairId) => {
      await db.query('DELETE FROM chat_train WHERE id = ?', [pairId]);
      return { success: true };
    }
  };

  static deleteChat = {
    empty: (socketID) => delete this.activeChats[socketID],
  }

  static formatContext = (context = []) => {
    if (!context || context.length === 0) return [];

    const formatted = [];
    const pendingUserMessages = [];

    for (const msg of context) {
      if (msg.sender === 'user') {
        // Armazena mensagens do usuário em uma fila
        pendingUserMessages.push(msg.text);
      }
      else if (msg.sender === 'assistant') {
        // Pega a última mensagem do usuário não respondida (se existir)
        const lastUserMsg = pendingUserMessages.pop();

        formatted.push(
          `User: ${lastUserMsg || "(sem contexto)"} | Assistant: ${msg.text}`
        );
      }
    }

    // Adiciona mensagens do usuário sem resposta
    pendingUserMessages.forEach(userMsg => {
      formatted.push(`User: ${userMsg} | Assistant: (sem resposta)`);
    });

    return formatted;
  };
};

module.exports = ChatService;