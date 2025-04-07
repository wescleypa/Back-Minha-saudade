const db = require('../config/mysql');

class UserService {
  static USER_COLUMNS = [
    'id', 'name', 'email', 'bio', 'phone',
    'phone_verified', 'created'
  ];

  static USER_CONFIG_COLUMN = [
    'notification_app', 'notification_email', 'crud',
    'two_factor_enabled', 'two_factor_type', 'theme'
  ];

  static async findByCredentials(email, password) {
    const columns = this.USER_COLUMNS.map(col => `u.${col}`).join(', ');
    const columnsconfig = this.USER_CONFIG_COLUMN.map(col => `config.${col}`).join(', ');

    const sql = `
      SELECT ${columns}, ${columnsconfig}
      FROM users u
      LEFT JOIN user_config config ON config.user = u.id
      WHERE u.email = ? AND u.password = ?
      GROUP BY u.id
    `;

    const [user] = await db.query(sql, [email, password]);

    if (!user) throw new Error('Dados inválidos ou usuário não cadastrado.');

    return this.processUser(user);
  };

  static async findByID(userID) {
    const columns = this.USER_COLUMNS.map(col => `u.${col}`).join(', ');
    const columnsconfig = this.USER_CONFIG_COLUMN.map(col => `config.${col}`).join(', ');

    const sql = `
      SELECT ${columns}, ${columnsconfig}
      FROM users u
      LEFT JOIN user_config config ON config.user = u.id
      WHERE u.id = ?
      GROUP BY u.id
    `;

    const [user] = await db.query(sql, [userID]);
    if (!user) throw new Error('Dados inválidos ou usuário não cadastrado.');

    return this.processUser(user);
  }

  static processUser(user) {
    if (user.skills?.length > 0) {
      user.skills = user.skills.split(',');
    }
    return user;
  }

  static async updateByID(userID, column, value) {
    if (!userID || !column || !value) throw new Error('Invalid params');

    const result = await db.query(`UPDATE users SET ${column} = ? WHERE id = ?`, [value, userID]);

    return result;
  }

  static get = {
    user: {
      byEmail: async (email) => {
        const result = await db.query(`SELECT name, email, bio, phone, phone_verified, created FROM users WHERE email = ?`, [email]);

        return result;
      }
    }
  };

  static update = {
    config: async (userID, column, value) => {
      const result = await db.query(
        `INSERT INTO user_config (user, ${column}) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE ${column} = VALUES(${column})`,
        [userID, value]
      );
      return result;
    },
    user: async (userID, column, value) => {
      const result = await db.query(
        `UPDATE users SET ${column} = ? WHERE id = ?`,
        [value, userID]
      );
      return result;
    }
  };

  static verifyCode = {
    save: async (userID, type, relation, code, expiry) => {
      const [verifications] = await db.query(
        `SELECT count(id) as qtd FROM verify_codes 
          WHERE action = ? 
            AND user = ? 
            AND created >= NOW() - INTERVAL 1 HOUR
          ORDER BY created DESC`,
        [type, userID]
      );

      if (verifications?.qtd && verifications?.qtd >= 3) throw new Error('Muitos códigos de verificação foram gerados recentemente, tente novamente mais tarde.');

      const result = await db.query(
        `INSERT INTO verify_codes (user, code, action, expiry, relation) VALUES (?, ?, ?, ?, ?)`,
        [userID, code, type, expiry, relation]
      );

      return result;
    },
    confirm: async (code, type, relation) => {
      const [rows] = await db.query(
        `SELECT user FROM verify_codes 
         WHERE code = ? AND action = ? AND relation = ? AND expiry >= NOW()`,
        [code, type, relation]
      );

      if (!rows || rows.length === 0) return { success: false, message: 'Código de verificação inválido ou expirado.' };

      const userId = rows?.user;

      await db.query(
        `DELETE FROM verify_codes WHERE user = ? AND action = ?`,
        [userId, type]
      );

      await this.update.user(userId, 'phone', relation);
      await this.update.user(userId, 'phone_verified', true);

      return { success: true, message: 'Código confirmado e verificado.', userID: userId };
    }
  };
}

module.exports = UserService;