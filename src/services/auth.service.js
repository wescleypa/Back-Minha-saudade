const db = require('../config/mysql');
const UserService = require('./user.service');
const JwtService = require('./jwt.service');
require('dotenv').config();

class AuthService {

  static async login(userData) {
    try {
      return await db.executeTransaction(async (conn) => {
        var user = await UserService.findByCredentials(
          userData.email,
          userData.password
        );

        if (!user) throw new Error('Falha ao realizar login');

        const { token } = await JwtService.create(user, conn);

        user = Object.assign({}, user, { token });

        return user;
      });
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };
}

module.exports = AuthService;

/*
class AuthService {

  static enrichUserWithAdditionalData = async (user) => {
    const [banner, pic] = await Promise.all([
      this.getUserImage(user.id, 'banner'),
      this.getUserImage(user.id, 'pic')
    ]);

    user.banner = banner;
    user.pic = pic;
  };

  static getUserImage = async (userId, type) => {
    const imagePath = path.join('./src/users', type, `${userId}.jpg`);
    try {
      return await this.imageToBase64Async(imagePath);
    } catch (error) {
      console.error(`Error loading ${type} image:`, error);
      return null;
    }
  };

  static processUserSkills = (user) => {
    if (user.skills?.length > 0) {
      user.skills = user.skills.split(',');
    }
    return user;
  };

  // Métodos auxiliares privados
  static authenticateUser = async ({ email, password }) => {
    const columns = USER_COLUMNS.map(col => `u.${col}`).join(', ');

    const sql = `
      SELECT ${columns}, GROUP_CONCAT(skill.skill) AS skills
      FROM users u
      LEFT JOIN verify_codes code ON code.user = u.id
      LEFT JOIN user_skills skill ON skill.user = u.id
      WHERE u.email = ? AND u.password = ?
      GROUP BY u.id
    `;

    const [result] = await db.query(sql, [email, password]);
    if (!result) return null;

    return this.processUserSkills(result);
  };

  static login = async (userData) => {
    const USER_COLUMNS = [
      'id', 'name', 'email', 'title', 'bio', 'phone',
      'location', 'birthday', 'twitter', 'linkedin',
      'github', 'website', 'nPlataforma', 'nEmail', 'mCrud'
    ];

    try {
      const user = await this.authenticateUser(userData);
      if (!user) return null;

      await this.enrichUserWithAdditionalData(user);
      return user;

    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Falha no processo de login');
    }
  };














  /*
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

  static create = async (userData, verificationCode) => {
    return db.executeTransaction(async (conn) => {
      try {
        // 1. Insere o usuário
        const userSql = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;
        const userParams = [userData.name, userData.email, userData.password];
        const [userResult] = await conn.query(userSql, userParams);
        const userId = userResult.insertId;

        // 2. Insere o código de verificação
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 3); // mover para env

        const codeSql = `
          INSERT INTO verify_codes (user, code, expiry, action) 
          VALUES (?, ?, ?, 0)
        `;
        const codeParams = [userId, verificationCode, expiryDate];
        const [verification] = await conn.query(codeSql, codeParams);
        const id = verification.insertId;

        await Email.createAccount(verificationCode, userData?.email);

        return userId;
      } catch (err) {
        // Tratamento específico para email duplicado
        if (err.code === 'ER_DUP_ENTRY') {
          throw new Error('Email já cadastrado');
        }
        throw err;
      }
    });
  }

  static getUserById = async (id) => {
    const sql = `SELECT id, name, email FROM users WHERE id = ?`;
    const [user] = await db.query(sql, [id]);
    return user;
  }

  // Método adicional para buscar o código de verificação
  static getVerificationCode = async (userId, action = 0) => {
    const sql = `
      SELECT code, expiry 
      FROM verify_codes 
      WHERE user_id = ? AND action = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const [code] = await db.query(sql, [userId, action]);
    return code;
  };

  static login = async (userData) => {
    const columnsUser = [
      'id',
      'name',
      'email',
      'title',
      'bio',
      'phone',
      'location',
      'birthday',
      'twitter',
      'linkedin',
      'github',
      'website',
      'nPlataforma',
      'nEmail',
      'mCrud'
    ];

    const sql = `
      SELECT u.${columnsUser.join(', u.')},
      GROUP_CONCAT(skill.skill) AS skills
      FROM users u
      LEFT JOIN verify_codes code ON code.user = u.id
      LEFT JOIN user_skills skill ON skill.user = u.id
      WHERE u.email = ? AND u.password = ?
    `;

    var [result] = await db.query(sql, [userData?.email, userData?.password]);

    if (result?.skills?.length > 0) {
      result.skills = result?.skills?.split(',');
    }

    if (result) {
      const imagePath = path.join('./src/users/banner', `${result?.id}.jpg`);
      const base64 = await this.imageToBase64Async(imagePath);
      result.banner = base64;

      const picPath = path.join('./src/users/pic', `${result?.id}.jpg`);
      const base642 = await this.imageToBase64Async(picPath);
      result.pic = base642;
    }

    return result;
  };

  static verifyCode = async (email, code) => {
    const sql = `
      SELECT code.code, u.name, u.id FROM verify_codes code
      LEFT JOIN users u ON code.user = u.id
      WHERE u.email = ? AND code.code = ? AND code.expiry > NOW()
    `;
    const [result] = await db.query(sql, [email, code]);

    if (result) {
      await db.query(`DELETE FROM verify_codes WHERE code=?`, [code])
    } else {
      await Email.createAccount(code, email);
    }

    return result;
  };

  static saveToken = async (user, token, expiry) => {
    const sql = `INSERT INTO session_tokens (user, token, expiry) VALUES (?, ?, ?)`;
    const result = await db.query(sql, [user, token, expiry]);
    return result;
  };

  static verifyToken = async (user, token) => {
    const columnsUser = [
      'id',
      'name',
      'email',
      'title',
      'bio',
      'phone',
      'location',
      'birthday',
      'twitter',
      'linkedin',
      'github',
      'website',
      'nPlataforma',
      'nEmail',
      'mCrud'
    ];

    const sql = `
    SELECT u.${columnsUser.join(', u.')},
      GROUP_CONCAT(skill.skill) AS skills,
      session.token FROM session_tokens session
    LEFT JOIN users u ON u.id = session.user
    LEFT JOIN user_skills skill ON skill.user = u.id
    WHERE u.id = ? AND session.token = ? AND session.expiry > NOW()`;
    var [result] = await db.query(sql, [user, token]);

    if (result?.skills?.length > 0) {
      result.skills = result?.skills?.split(',');
    }

    if (result) {
      const imagePath = path.join('./src/users/banner', `${result?.id}.jpg`);
      const base64 = await this.imageToBase64Async(imagePath);
      result.banner = base64;

      const picPath = path.join('./src/users/pic', `${result?.id}.jpg`);
      const base642 = await this.imageToBase64Async(picPath);
      result.pic = base642;
    }

    return result;
  };

  static resetpassword = async (email, code) => {
    const sql1 = `SELECT * FROM users WHERE email = ?`;
    const sql2 = `INSERT INTO verify_codes (user, code, action) VALUES (?, ?, 1)`;

    const [result] = await db.query(sql1, [email]);

    if (result) {
      const inserted = await db.query(sql2, [result?.id, code]);

      if (inserted) {
        await Email.createAccount(code, email);
      }

      return inserted;
    } else {
      throw new Error('Usuário não registrado.');
    }
  };

  static updateProfile = async (user, input, value) => {
    try {
      if (input !== 'addSkill' && input !== 'removeSkill' && input !== 'nPlataforma' && input !== 'nEmail' && input !== 'mCrud' && input !== 'pic' && input !== 'banner') {
        const sql = `UPDATE users SET ${input} = ? WHERE id = ?`;
        const result = await db.query(sql, [value, user]);
        return result;
      } else {
        if (input === 'addSkill') {
          const sql = `INSERT INTO user_skills (user, skill) VALUES (?, ?)`;
          const result = await db.query(sql, [user, value]);
          return result;
        }
        if (input === 'removeSkill') {
          const sql = `DELETE FROM user_skills WHERE user = ? AND skill = ?`;
          const result = await db.query(sql, [user, value]);
          return result;
        }

        if (input === 'nPlataforma' || input === 'nEmail' || input === 'mCrud') {
          const sql = `UPDATE users SET ${input} = ? WHERE id = ?`;
          const result = await db.query(sql, [value, user]);
          return result;
        }

        async function removeExistingFiles(directory, username) {
          try {
            // Verifica se o diretório existe
            const exists = await UserService.directoryExists(directory);
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

        if (input === 'pic') {
          const exists = await this.directoryExists('./src/users/pic');
          if (!exists) {
            await fs.mkdir('./src/users/pic', { recursive: true });
          }

          const matches = value.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

          if (!matches || matches.length !== 3) {
            throw new Error('String Base64 inválida');
          }

          const type = matches[1]; // Ex: 'image/png'
          const data = matches[2]; // Dados em Base64
          const buffer = Buffer.from(data, 'base64');

          const filename = `${user}.jpg`;
          const fullPath = path.join('./src/users/pic', filename);

          await removeExistingFiles('./src/users/pic/', user);

          // Salva o arquivo
          await fs.writeFile(fullPath, buffer);

          return true;
        }

        if (input === 'banner') {
          const exists = await this.directoryExists('./src/users/pic');
          if (!exists) {
            await fs.mkdir('./src/users/pic', { recursive: true });
          }

          const matches = value.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

          if (!matches || matches.length !== 3) {
            throw new Error('String Base64 inválida');
          }

          const type = matches[1]; // Ex: 'image/png'
          const data = matches[2]; // Dados em Base64
          const buffer = Buffer.from(data, 'base64');

          const filename = `${user}.jpg`;
          const fullPath = path.join('./src/users/banner', filename);

          await removeExistingFiles(path.join('./src/users/banner'), user);

          // Salva o arquivo
          await fs.writeFile(fullPath, buffer);

          return true;
        }
      }
    } catch (err) {
      throw err;
    }
  };

  static changepw = async (user, actual, pass) => {
    try {
      const sql = `SELECT * FROM users WHERE id = ? AND password = ?`;
      const [result] = await db.query(sql, [user, actual]);

      if (!result || result?.length <= 0) {
        return { logout: true };
      }

      const response = await db.query('UPDATE users SET password = ? WHERE id = ?', [pass, user]);
      return response;
    } catch (err) {
      throw err;
    }
  };

  *
}*/

module.exports = AuthService;