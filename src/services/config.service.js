const db = require('../config/mysql');

class Config {
  static roles = {
    get: async () => {
      const sql = `
      SELECT 
        cat.name,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'description', roles.description
          )
        ) AS roles
      FROM 
        roles
      LEFT JOIN 
        categories_roles cat ON roles.category = cat.id
      GROUP BY 
        cat.name;`;
      const [rows] = await db.query(sql);

      return rows;
    }
  };
  static train = {
    get: async (limit = 5) => {
      const sql = `
      SELECT 
        type,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'user', user,
            'assistant', assistant
          )
        ) AS train
      FROM (
        SELECT 
          type, 
          user, 
          assistant,
          ROW_NUMBER() OVER (PARTITION BY type ORDER BY id) AS row_num
        FROM geral_train
      ) AS ranked
      WHERE row_num <= ${limit}
      GROUP BY type;`;
      const rows = await db.query(sql);

      return rows;
    },
  };
};

module.exports = Config;