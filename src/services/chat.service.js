const db = require('../config/mysql');
const Config = require('../config/deepseek');
const ImageService = require('./image.service');
const { GoogleGenAI, Type } = require('@google/genai');
const { FormData } = require('openai/_shims/web-types.mjs');
const ai = new GoogleGenAI({
  apiKey: process.env.AI_KEY || "MY KEY"
});

class ChatService {
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
          JSON_OBJECT('id', message.id, 'text', message.message, 'sender', message.from, 'timestamp', message.created)
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

    empty: async (socketID) => {
      if (!this.activeChats[socketID]) {
        this.activeChats[socketID] = ai.chats.create({
          model: "gemini-2.0-flash",
          config: {
            systemInstruction: Config.initialMessage.empty(),
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
                }
              },
              required: ['shouldReply', 'reply'],

            },
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

    empty: async (message, socketID) => {
      const chat = await this.configure.empty(socketID);
      const result = await chat.sendMessage({ message });
      const parsedResponse = JSON.parse(result?.text);
      return parsedResponse;
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
    save: async (data) => {
      const { chatID, user, assistant } = data;

      const result = await db.query(
        'INSERT INTO chat_train (chat, user, assistant) VALUES (?, ?, ?)',
        [chatID, user, assistant]
      );

      return result?.insertId;
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
};

module.exports = ChatService;