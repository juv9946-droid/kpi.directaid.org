/*
 * نظام مؤشرات الأداء — نقطة تشغيل الخادم (Backend)
 * Node.js + Express + MySQL  |  بنية MVC (routes / controllers / models / database)
 * يخدم الواجهة الأمامية (../) ويوفّر واجهة برمجية مركزية للبيانات.
 */
const path = require('path');
const express = require('express');
const compression = require('compression');
const { initDb } = require('./database/db');
const kpiRoutes = require('./routes/kpi');

const app = express();
app.use(compression());
app.use(express.json({ limit: '5mb' }));

// واجهة البرمجة
app.use('/api', kpiRoutes);

// الواجهة الأمامية (ملفات المشروع في المجلد الأب)
const ROOT = path.join(__dirname, '..');
app.use(express.static(ROOT, { extensions: ['html'] }));
app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));

const PORT = process.env.PORT || 3000;
initDb()
  .then(() => app.listen(PORT, () => console.log('✔ الخادم يعمل على المنفذ ' + PORT)))
  .catch((e) => {
    console.error('تعذّر الاتصال بقاعدة البيانات:', e.message);
    app.listen(PORT, () => console.log('⚠ الخادم يعمل على ' + PORT + ' (بلا قاعدة بيانات)'));
  });
