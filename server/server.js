/*
 * نظام مؤشرات الأداء — الخادم (Backend)
 * Node.js + Express + MySQL
 *
 * يقدّم واجهة برمجية (API) لتخزين بيانات النظام في قاعدة بيانات مركزية،
 * ويستضيف ملفات الواجهة الأمامية (HTML) في نفس الوقت — رابط واحد للجميع.
 */

const path = require('path');
const express = require('express');
const compression = require('compression');
const mysql = require('mysql2/promise');

const app = express();
app.use(compression());
app.use(express.json({ limit: '5mb' }));

// ================== قاعدة البيانات ==================
// يقبل إمّا رابط اتصال كامل (MYSQL_URL / DATABASE_URL) أو متغيّرات منفصلة.
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
  console.log('✔ قاعدة البيانات جاهزة (جدول kpi_store)');
}

// ================== واجهة برمجية (API) ==================

// كل الحالة الحالية (كل المفاتيح)
app.get('/api/state', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT `key`, `value`, updated_at FROM kpi_store');
    const out = {};
    let max = 0;
    for (const r of rows) {
      out[r.key] = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
      if (r.updated_at > max) max = r.updated_at;
    }
    res.json({ ok: true, data: out, ts: max });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// التغييرات منذ طابع زمني (للتحديث المباشر عبر الاستطلاع)
app.get('/api/since', async (req, res) => {
  try {
    const ts = Number(req.query.ts || 0);
    const [rows] = await pool.query(
      'SELECT `key`, `value`, updated_at FROM kpi_store WHERE updated_at > ?',
      [ts]
    );
    const out = {};
    let max = ts;
    for (const r of rows) {
      out[r.key] = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
      if (r.updated_at > max) max = r.updated_at;
    }
    res.json({ ok: true, data: out, ts: max });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// حفظ / تحديث مفتاح واحد
app.post('/api/set', async (req, res) => {
  try {
    const { key, value } = req.body || {};
    if (!key) return res.status(400).json({ ok: false, error: 'missing key' });
    const now = Date.now();
    await pool.query(
      'INSERT INTO kpi_store (`key`,`value`,updated_at) VALUES (?,?,?) ' +
        'ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), updated_at=VALUES(updated_at)',
      [key, JSON.stringify(value), now]
    );
    res.json({ ok: true, ts: now });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// حفظ دفعة من المفاتيح مرة واحدة
app.post('/api/bulk', async (req, res) => {
  try {
    const items = (req.body && req.body.items) || [];
    const now = Date.now();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const it of items) {
        if (!it || !it.key) continue;
        await conn.query(
          'INSERT INTO kpi_store (`key`,`value`,updated_at) VALUES (?,?,?) ' +
            'ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), updated_at=VALUES(updated_at)',
          [it.key, JSON.stringify(it.value), now]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    res.json({ ok: true, ts: now });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ================== الواجهة الأمامية (Static) ==================
// تُخدم ملفات المشروع (HTML + JS) من المجلد الأب.
const ROOT = path.join(__dirname, '..');
app.use(express.static(ROOT, { extensions: ['html'] }));

// الصفحة الرئيسية: ملف النظام
const INDEX_FILE = 'نظام KPI - تصميم Hi-Fi.dc.html';
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, INDEX_FILE));
});

const PORT = process.env.PORT || 3000;
initDb()
  .then(() => {
    app.listen(PORT, () => console.log('✔ الخادم يعمل على المنفذ ' + PORT));
  })
  .catch((e) => {
    console.error('فشل تهيئة قاعدة البيانات:', e);
    // نُشغّل الخادم مع ذلك لخدمة الواجهة، وتظهر أخطاء الـ API عند الطلب
    app.listen(PORT, () => console.log('⚠ الخادم يعمل على المنفذ ' + PORT + ' (قاعدة البيانات غير متصلة)'));
  });
