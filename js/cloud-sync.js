/*
 * طبقة المزامنة السحابية لنظام مؤشرات الأداء
 * تربط تخزين المتصفح (localStorage) بقاعدة البيانات المركزية عبر الخادم.
 *
 * - عند الفتح: تسحب كل البيانات من الخادم وتضعها في المتصفح.
 * - عند أي تعديل: تدفعه فورًا إلى الخادم ليراه بقية الموظفين.
 * - كل بضع ثوانٍ: تسحب تغييرات الآخرين وتحدّث الشاشة.
 *
 * إذا فُتح الملف بدون خادم (كملف محلي)، يعمل النظام بوضع محلي دون مزامنة.
 */
(function () {
  var PREFIX = 'kpi_';                 // نُزامن فقط مفاتيح النظام
  var API = '';                        // نفس النطاق (الخادم يخدم الواجهة)
  var POLL_MS = 4000;                  // فترة سحب تغييرات الآخرين
  var lastTs = 0;
  var online = false;
  var pushTimer = null;
  var pending = {};                    // مفاتيح بانتظار الدفع

  var origSet = localStorage.setItem.bind(localStorage);
  var origRemove = localStorage.removeItem.bind(localStorage);

  function isKpiKey(k) { return typeof k === 'string' && k.indexOf(PREFIX) === 0; }

  function api(path, opts) {
    return fetch(API + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts))
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
  }

  // ——— دفع التغييرات إلى الخادم ———
  function schedulePush(key) {
    if (!online) return;
    pending[key] = true;
    if (pushTimer) return;
    pushTimer = setTimeout(flushPush, 400);
  }
  function flushPush() {
    pushTimer = null;
    var keys = Object.keys(pending);
    pending = {};
    if (!keys.length) return;
    var items = keys.map(function (k) {
      var raw = localStorage.getItem(k);
      var val = null;
      try { val = raw == null ? null : JSON.parse(raw); } catch (e) { val = raw; }
      return { key: k, value: val };
    });
    api('/api/bulk', { method: 'POST', body: JSON.stringify({ items: items }) })
      .then(function (res) { if (res && res.ts) lastTs = Math.max(lastTs, res.ts); })
      .catch(function () { /* يُعاد المحاولة في الدورة التالية */ keys.forEach(function (k) { pending[k] = true; }); });
  }

  // اعتراض الكتابة المحلية لدفعها للخادم
  localStorage.setItem = function (k, v) {
    origSet(k, v);
    if (isKpiKey(k)) schedulePush(k);
  };
  localStorage.removeItem = function (k) {
    origRemove(k);
    if (isKpiKey(k)) schedulePush(k); // القيمة أصبحت غير موجودة → تُدفع كـ null
  };

  // ——— سحب تغييرات الآخرين ———
  function applyRemote(data) {
    var changed = false;
    var editing = isEditing();
    Object.keys(data).forEach(function (k) {
      if (!isKpiKey(k)) return;
      var incoming = JSON.stringify(data[k]);
      if (localStorage.getItem(k) !== incoming) {
        origSet(k, incoming);
        changed = true;
      }
    });
    // لا نُحدّث الشاشة أثناء إدخال المستخدم لئلا نُفقده ما يكتب
    if (changed && !editing) softRefresh();
    return changed;
  }

  function isEditing() {
    var el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
  }

  function softRefresh() {
    // أبسط طريقة موثوقة لعكس بيانات الآخرين: إعادة تحميل خفيفة
    location.reload();
  }

  function poll() {
    if (!online) return;
    api('/api/since?ts=' + lastTs)
      .then(function (res) {
        if (res && res.data) { applyRemote(res.data); if (res.ts) lastTs = Math.max(lastTs, res.ts); }
      })
      .catch(function () {})
      .then(function () { setTimeout(poll, POLL_MS); });
  }

  function banner(msg, color) {
    var id = '__kpi_conn_banner';
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;padding:8px 14px;font-family:system-ui,sans-serif;font-size:13px;text-align:center;color:#fff';
      document.body.appendChild(el);
    }
    el.style.background = color;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }

  // ——— الإقلاع: القاعدة السحابية هي المصدر الوحيد للبيانات ———
  function boot() {
    api('/api/state')
      .then(function (res) {
        online = true;
        lastTs = res.ts || 0;
        var changed = applyRemote(res.data || {});
        window.__KPI_CLOUD__ = { online: true };
        banner('', '');
        if (!changed) setTimeout(poll, POLL_MS);
      })
      .catch(function () {
        online = false;
        window.__KPI_CLOUD__ = { online: false };
        // القاعدة غير متصلة: لا نعمل بوضع محلي — ننبّه ونعيد المحاولة حتى الاتصال
        banner('⏳ جارٍ الاتصال بقاعدة البيانات السحابية…', '#B45309');
        setTimeout(boot, 3000);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
