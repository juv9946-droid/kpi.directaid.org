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

## أين تُحفظ البيانات؟
كل البيانات تُحفظ في **قاعدة MySQL السحابية فقط** (جدول `kpi_store`). المتصفح لا يُستخدم كمخزن دائم — يوجد فقط ذاكرة عرض مؤقتة تُعاد تعبئتها من القاعدة عند كل فتح، فلا شيء يضيع عند إعادة تشغيل الموقع، وأي تعديل يظهر لبقية الموظفين خلال ثوانٍ.

## النشر على Render — خطوة بخطوة (اضغط بالترتيب)

### أولًا: ارفع المشروع إلى GitHub
1. github.com ← **New repository** ← اسم مثل `kpi-system` ← **Create repository**.
2. **uploading an existing file** ← اسحب **كل محتويات مجلد `project`** (بما فيها `render.yaml` و`server/`) ← **Commit changes**.

### ثانيًا: جهّز قاعدة MySQL سحابية مجانية (مرة واحدة)
Render لا يوفّر MySQL، لذا ننشئها على **Railway** (الأسهل):
1. railway.app ← **New Project** ← **Provision MySQL**.
2. افتح خدمة MySQL ← تبويب **Variables** ← انسخ قيمة **`MYSQL_PUBLIC_URL`** (تبدأ بـ `mysql://...`).
   - إن وجدت `MYSQL_URL` الداخلي فقط، فعّل **Public Networking** من إعدادات MySQL للحصول على الرابط العام.

### ثالثًا: أنشئ الخدمة على Render
1. render.com ← **New +** ← **Web Service**.
2. **Build and deploy from a Git repository** ← **Connect** المستودع الذي رفعته.
3. Render يقرأ `render.yaml` تلقائيًا. تأكّد فقط من:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. في قسم **Environment / Environment Variables** ← **Add Environment Variable**:
   - **Key**: `MYSQL_URL`
   - **Value**: الرابط الذي نسخته من Railway (`mysql://...`).
5. اضغط **Create Web Service**.

### رابعًا: احصل على الرابط
- انتظر حتى تظهر حالة **Live** (بناء أول مرة ~دقيقتان).
- أعلى الصفحة يظهر رابط مثل `https://kpi-system.onrender.com` — هذا رابط النظام. افتحه، وشاركه مع الموظفين. يعمل من الكمبيوتر والجوال بالمتصفح فقط.
- للتأكد من القاعدة: افتح `الرابط/api/health` فيظهر `{"ok":true}`.

## التشغيل محليًا (اختياري للتجربة)
```bash
cd server
npm install
cp .env.example .env      # ثم املأ MYSQL_URL أو بيانات DB_*
npm start                 # ثم افتح http://localhost:3000
```

## ملاحظات
- لا يوجد تسجيل دخول أو أدوار — أي شخص لديه الرابط يضيف ويعدّل (حسب المطلوب).
- التحديث المباشر للجميع عبر استطلاع كل ٤ ثوانٍ.
- الخطة المجانية في Render قد تُنيم الخدمة عند الخمول؛ أول طلب بعد الخمول يستغرق ~٣٠ ثانية ثم تعمل طبيعيًا. للاستخدام الدائم اختر خطة مدفوعة صغيرة.
