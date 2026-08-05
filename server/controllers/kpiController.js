/* المتحكّمات — منطق معالجة طلبات الواجهة البرمجية */
const store = require('../models/kpiStore');
const rt = require('../realtime');

exports.state = async (req, res) => {
  try {
    const { data, ts } = store.toObject(await store.getAll());
    res.json({ ok: true, data, ts });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

exports.since = async (req, res) => {
  try {
    const from = Number(req.query.ts || 0);
    const { data, ts } = store.toObject(await store.getSince(from));
    res.json({ ok: true, data, ts: Math.max(ts, from) });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

exports.set = async (req, res) => {
  try {
    const { key, value } = req.body || {};
    if (!key) return res.status(400).json({ ok: false, error: 'missing key' });
    const ts = Date.now();
    await store.upsert(key, value, ts);
    rt.broadcast({ ts, data: { [key]: value }, src: req.headers['x-kpi-client'] || null });
    res.json({ ok: true, ts });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

exports.bulk = async (req, res) => {
  try {
    const items = (req.body && req.body.items) || [];
    const ts = Date.now();
    await store.bulkUpsert(items, ts);
    const data = {};
    for (const it of items) if (it && it.key) data[it.key] = it.value;
    rt.broadcast({ ts, data, src: req.headers['x-kpi-client'] || null });
    res.json({ ok: true, ts });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
};

/* اتصال البث اللحظي: يُبقى مفتوحًا ويستقبل كل تعديل لحظة حدوثه */
exports.stream = async (req, res) => {
  rt.addClient(req, res);
  try {
    const from = Number(req.query.ts || 0);
    if (from > 0) {
      const { data, ts } = store.toObject(await store.getSince(from));
      if (Object.keys(data).length) rt.send(res, { ts, data });
    }
  } catch (e) { /* ignored */ }
};

exports.health = (req, res) => res.json({ ok: true, live: rt.count() });
