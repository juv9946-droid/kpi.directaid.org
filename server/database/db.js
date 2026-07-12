/* اتصال قاعدة البيانات MySQL + تهيئة الجدول */
const mysql = require('mysql2/promise');

function makePool() {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (url) {
    return mysql.createPool(url + (url.includes('?') ? '&' : '?') + 'connectionLimit=10');
  }
  return mysql.createPool({
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'kpi',
    connectionLimit: 10,
    waitForConnections: true,
  });
}

const pool = makePool();

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kpi_store (
      \`key\`       VARCHAR(191) NOT NULL PRIMARY KEY,
      \`value\`     JSON NOT NULL,
      updated_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✔ قاعدة البيانات جاهزة (kpi_store)');
}

module.exports = { pool, initDb };
