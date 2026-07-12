/* اتصال قاعدة البيانات MySQL (متوافق مع Aiven — SSL) + تهيئة الجداول تلقائيًا */
const mysql = require('mysql2/promise');

// Aiven يفرض اتصال SSL. نفعّله افتراضيًا مع أي اتصال بعيد،
// ويمكن إيقافه محليًا بضبط DB_SSL=false.
function sslOption() {
  const flag = String(process.env.DB_SSL || 'true').toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'off') return undefined;
  // rejectUnauthorized=false يقبل شهادة Aiven دون الحاجة لملف CA
  return { rejectUnauthorized: false };
}

function makePool() {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (url) {
    // نمرّر SSL برمجيًا (أكثر موثوقية من ملحق ?ssl-mode في رابط Aiven)
    return mysql.createPool({ uri: url, ssl: sslOption(), connectionLimit: 10, waitForConnections: true });
  }
  return mysql.createPool({
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'kpi',
    ssl: sslOption(),
    connectionLimit: 10,
    waitForConnections: true,
  });
}

const pool = makePool();

async function initDb() {
  // إنشاء الجداول تلقائيًا عند التشغيل الأول
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kpi_store (
      \`key\`       VARCHAR(191) NOT NULL PRIMARY KEY,
      \`value\`     JSON NOT NULL,
      updated_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✔ قاعدة البيانات جاهزة (kpi_store) — Aiven MySQL');
}

module.exports = { pool, initDb };
