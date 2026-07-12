/* نموذج البيانات — كل عمليات قاعدة البيانات لمخزن المفاتيح */
const { pool } = require('../database/db');

async function getAll() {
  const [rows] = await pool.query('SELECT `key`,`value`,updated_at FROM kpi_store');
  return rows;
}

async function getSince(ts) {
  const [rows] = await pool.query(
    'SELECT `key`,`value`,updated_at FROM kpi_store WHERE updated_at > ?',
    [ts]
  );
  return rows;
}

async function upsert(key, value, ts) {
  await pool.query(
    'INSERT INTO kpi_store (`key`,`value`,updated_at) VALUES (?,?,?) ' +
      'ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), updated_at=VALUES(updated_at)',
    [key, JSON.stringify(value), ts]
  );
}

async function bulkUpsert(items, ts) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const it of items) {
      if (!it || !it.key) continue;
      await conn.query(
        'INSERT INTO kpi_store (`key`,`value`,updated_at) VALUES (?,?,?) ' +
          'ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), updated_at=VALUES(updated_at)',
        [it.key, JSON.stringify(it.value), ts]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

function toObject(rows) {
  const out = {};
  let max = 0;
  for (const r of rows) {
    out[r.key] = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
    if (r.updated_at > max) max = r.updated_at;
  }
  return { data: out, ts: max };
}

module.exports = { getAll, getSince, upsert, bulkUpsert, toObject };
