const mysql = require('mysql2/promise');
let pool;

// Preparado para el Paso 5: no abre conexiones hasta ejecutar una consulta.
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      charset: 'utf8mb4',
      timezone: 'Z',
      connectionLimit: 5,
    });
  }
  return pool;
}

module.exports = { getPool };
