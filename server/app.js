/*
 * نظام مؤشرات الأداء — نقطة تشغيل الخادم (Backend)
 * Node.js + Express + MySQL  |  بنية MVC (routes / controllers / models / database)
 * يخدم الواجهة الأمامية (../) ويوفّر واجهة برمجية مركزية + بث لحظي للتعديلات.
 */
const path = require('path');
const express = require('express');
const compression = require('compression');
const { initDb } = require('./database/db');
const kpiRoutes = require('./routes/kpi');

const app = express();
app.set('trust proxy', 1);

// الضغط مُعطّل على مسار البث اللحظي لأنه يمنع الدفع الفوري
app.use(compression({
  filter: (req, res) => req.path !== '/api/stream' && compression.filter(req, res),
}));
app.use(express.json({ limit: '5mb' }));

// واجهة البرمجة
app.use('/api', kpiRoutes);

// الواجهة الأمامية (ملفات المشروع في المجلد الأب)
const ROOT = path.join(__dirname, '..');
app.use(express.static(ROOT, { extensions: ['html'], setHeaders: (res, p) => {
  if (/\.(html|js|css)$/.test(p)) res.setHeader('Cache-Control', 'no-cache');
} }));
app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));

const PORT = process.env.PORT || 3000;
const server = require('http').createServer(app);
server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;

initDb()
  .then(() => server.listen(PORT, () => console.log('✔ الخادم يعمل على المنفذ ' + PORT)))
  .catch((e) => {
    console.error('تعذّر الاتصال بقاعدة البيانات:', e.message);
    server.listen(PORT, () => console.log('⚠ الخادم يعمل على ' + PORT + ' (بلا قاعدة بيانات)'));
  });
