const db = require('../config/mysql');

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

    const result = await db.query(sql, [userID]);

    return result;
  };
};

module.exports = ChatService;