const db = require('../config/mysql');

class UserService {
  static USER_COLUMNS = [
    'id', 'name', 'email', 'title', 'bio', 'phone',
    'location', 'birthday', 'twitter', 'linkedin',
    'github', 'website', 'nPlataforma', 'nEmail', 'mCrud'
  ];

  static async findByCredentials(email, password) {
    const columns = this.USER_COLUMNS.map(col => `u.${col}`).join(', ');

    const sql = `
      SELECT ${columns}, GROUP_CONCAT(skill.skill) AS skills
      FROM users u
      LEFT JOIN verify_codes code ON code.user = u.id
      LEFT JOIN user_skills skill ON skill.user = u.id
      WHERE u.email = ? AND u.password = ?
      GROUP BY u.id
    `;

    const [user] = await db.query(sql, [email, password]);
    
    if (!user) throw new Error('Dados inválidos ou usuário não cadastrado.');

    return this.processUser(user);
  };

  static async findByID(userID) {
    const columns = this.USER_COLUMNS.map(col => `u.${col}`).join(', ');

    const sql = `
      SELECT ${columns}, GROUP_CONCAT(skill.skill) AS skills
      FROM users u
      LEFT JOIN verify_codes code ON code.user = u.id
      LEFT JOIN user_skills skill ON skill.user = u.id
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
}

module.exports = UserService;