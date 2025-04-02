const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const DEFAULT_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Badkill1!',
  database: process.env.DB_NAME || 'Camila',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10, // Número máximo de conexões no pool
  queueLimit: 0, // 0 = sem limite de fila
  enableKeepAlive: true, // Mantém a conexão ativa
  keepAliveInitialDelay: 0, // Delay inicial para keep-alive
};

class Database {
  constructor() {
    this.pool = null;
  }

  static initialize = async () => {
    if (!this.pool) {
      this.pool = mysql.createPool(DEFAULT_CONFIG);

      // Testa a conexão imediatamente
      try {
        const conn = await this.pool.getConnection();
        console.log('✅ Conexão com MySQL estabelecida com sucesso');
        conn.release(); // Libera a conexão de volta para o pool
      } catch (err) {
        console.error('❌ Erro ao conectar ao MySQL:', err.message);
        throw err;
      }
    }
    return this.pool;
  }

  static query = async (sql, params) => {
    if (!this.pool) await this.initialize();

    try {
      const [rows] = await this.pool.query(sql, params);
      return rows;
    } catch (err) {
      console.error('Erro na query:', { sql, params }, err.message);
      throw err;
    }
  }

  // Para transações
  static executeTransaction = async (callback) => {
    if (!this.pool) await this.initialize();
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = Database;