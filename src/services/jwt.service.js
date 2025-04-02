const jwt = require('jsonwebtoken');
const db = require('../config/mysql');

require('dotenv').config();

class JwtService {

  static tokenBlocklist = [];

  static save = async (userID, token, expiry, conn) => {
    const connection = conn || db;

    if (!userID || !token || !expiry) throw new Error('Invalid credentials');

    const sql = `INSERT INTO session_tokens (user, token, expiry) VALUES (?, ?, ?)`;

    return await connection.query(sql, [userID, token, expiry]);
  };


  static create = async (userData, conn = null) => {

    const payload = {
      userID: userData?.id,
      email: userData?.email,
      name: userData?.name,
    };

    const token = jwt.sign(payload, process.env.SECRET_JWT, {
      expiresIn: process.env.EXPIRY_JWT,
      algorithm: 'HS256'
    });

    // Decodificar para obter a expiração
    const decoded = jwt.decode(token);
    const expiry = new Date(decoded.exp * 1000);
    await this.save(userData?.id, token, expiry, conn);

    return { token, expiry };
  };

  static verifyTokenCache = async (token) => {
    try {
      if (this.tokenBlocklist.includes(token)) return { valid: false, reason: 'Token expirado' };
      const decoded = jwt.verify(token, process.env.SECRET_JWT);
      
      // Verifica se o token expirou
      const currentTime = Math.floor(Date.now() / 1000); // Tempo atual em segundos
      if (decoded.exp && decoded.exp < currentTime) {
        return { valid: false, reason: 'Token expirado' };
      }

      return { valid: true, payload: decoded };
    } catch (error) {
      console.error(error);
      // Diferencia os tipos de erro
      if (error.name === 'TokenExpiredError') {
        return { valid: false, reason: 'Token expirado' };
      } else if (error.name === 'JsonWebTokenError') {
        return { valid: false, reason: 'Token inválido' };
      } else {
        return { valid: false, reason: 'Erro ao verificar token' };
      }
    }
  };

  static verifyToken = async (token) => {
    try {
      if (this.tokenBlocklist.includes(token)) throw new Error('Sessão expirada, faça login novamente.');
      const { valid, payload } = await this.verifyTokenCache(token);

      if (!valid || !payload?.userID) throw new Error('Sessão expirada, faça login novamente.');

      const sql = `SELECT id FROM session_tokens WHERE token = ? AND user = ? AND now() > expiry`;
      const result = await db.query(sql, [token, payload?.userID]);

      if (result) return payload?.userID;
      else throw new Error('Sessão expirada, faça login novamente.');
    } catch (error) {
      const sql = `DELETE FROM session_tokens WHERE token = ?`;
      await db.query(sql, [token]);
      console.error(error);
      throw new Error('Sessão expirada, faça login novamente.');
    }

  };

  static delete = async (token) => this.tokenBlocklist.push(token);
};

module.exports = JwtService;