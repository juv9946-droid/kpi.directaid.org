# نظام مؤشرات الأداء KPI

نظام ويب مؤسسي لإدارة ومتابعة مؤشرات الأداء — واجهة عربية (RTL) تعمل على الكمبيوتر والجوال بالمتصفح فقط، مع خادم Node.js + Express وقاعدة بيانات MySQL مركزية. رابط واحد وحساب مشترك؛ تظهر تعديلات أي موظف للبقية خلال ثوانٍ.

## هيكل المشروع

```
project/
├── index.html            # واجهة النظام (الصفحة الرئيسية)
├── manifest.json         # بيانات تطبيق الويب
├── favicon.svg           # أيقونة الموقع
├── css/app.css           # أنماط أساسية عامة
├── js/
│   ├── support.js        # محرّك المكوّنات
│   └── cloud-sync.js     # طبقة المزامنة مع القاعدة المركزية
├── assets/               # ملفات عامة
├── images/               # الصور
├── fonts/                # الخطوط (تُحمّل حاليًا من Google Fonts)
└── server/               # الخادم (Backend)
    ├── app.js            # نقطة التشغيل
    ├── package.json
    ├── .env.example
    ├── routes/kpi.js
    ├── controllers/kpiController.js
    ├── models/kpiStore.js
    └── database/
        ├── db.js
        └── schema.sql
```

## واجهة البرمجة (API)

| الطريقة | المسار         | الوظيفة                         |
|--------|----------------|---------------------------------|
| GET    | `/api/state`   | جلب كل البيانات                 |
| GET    | `/api/since?ts=` | التغييرات منذ طابع زمني        |
| POST   | `/api/set`     | حفظ/تحديث مفتاح                 |
| POST   | `/api/bulk`    | حفظ دفعة مفاتيح                 |
| GET    | `/api/health`  | فحص التشغيل                     |

## التشغيل محليًا

```bash
cd server
npm install
cp .env.example .env      # ثم املأ بيانات MySQL
npm start
# افتح http://localhost:3000
```

## النشر على Render

1. **ارفع المشروع إلى GitHub**: أنشئ مستودعًا جديدًا وارفع محتوى مجلد `project` كاملًا.
2. **جهّز قاعدة MySQL**: أنشئ قاعدة MySQL (Railway أو Aiven أو PlanetScale) وانسخ رابط الاتصال `mysql://...`.
3. **أنشئ خدمة على Render**: New → Web Service → اربط المستودع.
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. **أضِف متغيّر البيئة**: `MYSQL_URL` = رابط الاتصال.
5. **Create Web Service** → بعد اكتمال البناء تحصل على رابط عام — هذا رابط النظام، شاركه مع الموظفين.

> Render لا يوفّر MySQL مباشرة، لذا نستخدم قاعدة MySQL خارجية عبر `MYSQL_URL`. بدائل: النشر على **Railway** الذي يوفّر MySQL مدمجًا (Root Directory = `server`, Start = `npm start`).

## ملاحظات
- لا يوجد نظام تسجيل دخول أو أدوار — أي شخص لديه الرابط يضيف ويعدّل (حسب المطلوب).
- التحديث المباشر عبر استطلاع كل ٤ ثوانٍ.
- عند فتح `index.html` بدون خادم يعمل النظام بوضع محلي دون مزامنة.
