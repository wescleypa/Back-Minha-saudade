const db = require('../config/mysql');
const fs = require('fs').promises;
const path = require('path');
const GoogleIA = require('../services/deepseek');

class Chats {
  static directoryExists = async (directoryPath) => {
    try {
      await fs.access(directoryPath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false; // Diretório não existe
      }
      throw error; // Outro tipo de erro
    }
  }

  static imageToBase64Async = async (filePath) => {
    try {
      try {
        await fs.access(filePath);
      } catch {
        return null;
      }

      const fileBuffer = await fs.readFile(filePath);
      return `data:image/jpeg;base64,${fileBuffer.toString('base64')}`;
    } catch (error) {
      console.error('Erro ao converter imagem:', error);
      return null;
    }
  }

  static rename = async (user, id, name, avatar) => {
    var sql = '', params = [];

    if (id === -1) {
      sql = `INSERT INTO chats (user, name, avatar) VALUES (?, ?, ?)`;
      params = [user, name, avatar];
    } else {
      sql = `UPDATE chats SET name = ?, avatar = ? WHERE user = ? AND id = ?`;
      params = [name, avatar ?? '', user, id];
    }

    const result = await db.query(sql, params);

    return result;
  };

  static addMessage = async (chat, message, from) => {
    const sql = 'INSERT INTO chat_messages (chat, message, `from`) VALUES (?, ?, ?)';

    const result = await db.query(sql, [chat, message, from]);
    return result;
  };

  static getAllChats = async (user) => {
    const columnsConfig = [
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

    const sql = `
    SELECT 
      chat.id AS id,
      chat.*,
      ${columnsConfig.join(',')},
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

    var result = await db.query(sql, [user]);

    if (result?.length > 0) {
      // Usar Promise.all para operações assíncronas em array
      result = await Promise.all(result.map(async (i) => {
        const imagePath = path.join('./src/chats/pic', `${i.id}.jpg`);

        try {
          // Verifica se o arquivo realmente existe
          if (await this.directoryExists(imagePath)) {
            const base64 = await this.imageToBase64Async(imagePath);
            return { ...i, avatar: base64 };
          }
          return i; // Retorna sem alteração se não existir imagem
        } catch (error) {
          console.error(`Erro ao processar imagem para ${i.id}:`, error);
          return i; // Retorna o item original em caso de erro
        }
      }));
    }

    return result;
  };

  static updateConfig = async (userID, chatID, column, value) => {
   
    if (!chatID || !column || !value || !userID) throw new Error('Campos obrigatórios faltando.');
    var sql = '', params = [];

    async function removeExistingFiles(directory, username) {
      try {
        // Verifica se o diretório existe
        const exists = await Chats.directoryExists(directory);
        if (!exists) {
          return;
        }

        // Lê todos os arquivos do diretório
        const files = await fs.readdir(directory);
        let removedCount = 0;

        files.forEach(async file => {
          // Extrai o nome do arquivo sem extensão
          const fileWithoutExt = path.parse(file).name;

          // Verifica se o arquivo pertence ao usuário
          if (fileWithoutExt?.toString() === username?.toString()) {
            try {
              await fs.unlink(path.join(directory, file));
              removedCount++;
            } catch (err) {
              console.error(`Erro ao remover ${file}:`, err);
            }
          }
        });

        return removedCount;
      } catch (err) {
        console.error('Erro geral em removeExistingFiles:', err);
        throw err;
      }
    }


    if (column === 'name') {
      sql = `UPDATE chats chat
      LEFT JOIN users u ON u.id = chat.user
      SET chat.name = ? WHERE chat.id = ? AND chat.user = ?`;
      params = [value, chatID, userID]
    }
    else if (column === 'avatar') {
      const exists = await this.directoryExists('./src/chats/pic');
      if (!exists) {
        await fs.mkdir('./src/chats/pic', { recursive: true });
      }

      const matches = value.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

      if (!matches || matches.length !== 3) {
        throw new Error('String Base64 inválida');
      }

      const type = matches[1]; // Ex: 'image/png'
      const data = matches[2]; // Dados em Base64
      const buffer = Buffer.from(data, 'base64');

      const filename = `${chatID}.jpg`;
      const fullPath = path.join('./src/chats/pic', filename);

      await removeExistingFiles('./src/chats/pic/', chatID);

      // Salva o arquivo
      await fs.writeFile(fullPath, buffer);

      return true;
    } else {
      const [results] = await db.query(
        `SELECT * FROM chat_config config
        LEFT JOIN chats chat ON chat.id = config.chat
        LEFT JOIN users u ON u.id = chat.user
        WHERE config.chat = ? AND chat.user = ?`,
        [chatID, userID]);

      if (results && results?.id > 0) {
        if (column === 'extrals' && Array.isArray(value)) {
          sql = `UPDATE chat_config config
          LEFT JOIN chats chat ON chat.id = config.chat
          SET config.extrals = JSON_ARRAY(?) WHERE config.chat = ? AND chat.user = ?`;
          params = [value.join(','), chatID, userID];
        } else {
          sql = `UPDATE chat_config config
          LEFT JOIN chats chat ON chat.id = config.chat
          SET config.${column} = ? WHERE config.chat = ? AND chat.user = ?`;
          params = [value, chatID, userID];
        }
      } else {
        if (column === 'extrals' && Array.isArray(value)) {
          sql = `INSERT INTO chat_config (extrals, chat) VALUES (JSON_ARRAY(?), ?)`;
          params = [value, join(','), chatID];
        } else {
          sql = `INSERT INTO chat_config (${column}, chat) VALUES (?, ?)`;
          params = [value, chatID];
        }
      }

    }

    const result = await db.query(sql, [value, chatID, userID]);

    if (result) {
      await GoogleIA.clearChat(chatID);
    }

    return result;
  };

};

module.exports = Chats;