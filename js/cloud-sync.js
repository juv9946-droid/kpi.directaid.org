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
  var POLL_MS = 2500;                  // فترة سحب تغييرات الآخرين
  var lastTs = 0;
  var online = false;
  var pushTimer = null;
  var pending = {};                    // مفاتيح بانتظار الدفع
  var booting = false;                 // أثناء التحميل الأول لا نُسجّل إشعارات

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

  var pendingReload = false;

  // ——— سجل النشاط (إشعارات تغييرات الآخرين) ———
  function deptLabel(k) {
    if (k.indexOf('kpi_pr_') === 0 || k.indexOf('kpi_pr') === 0) return 'العلاقات العامة والإعلام';
    if (k.indexOf('kpi_emkt') === 0) return 'التسويق الإلكتروني';
    if (k.indexOf('kpi_vol') === 0) return 'شئون المتطوعين';
    if (k.indexOf('kpi_mkt') === 0) return 'التسويق';
    if (k.indexOf('kpi_years') === 0) return 'السنوات';
    return 'النظام';
  }
  function loadActivity() { try { return JSON.parse(localStorage.getItem('__kpi_activity') || '[]'); } catch (e) { return []; } }
  function saveActivity(a) { try { origSet('__kpi_activity', JSON.stringify(a.slice(0, 40))); } catch (e) {} }
  function logActivity(keys) {
    if (booting) return; // لا نُسجّل التحميل الأول كإشعارات
    var labels = {};
    keys.forEach(function (k) { labels[deptLabel(k)] = true; });
    var now = Date.now();
    var list = loadActivity();
    Object.keys(labels).forEach(function (lab) {
      list.unshift({ t: now, msg: 'تم تحديث بيانات: ' + lab });
    });
    saveActivity(list);
    renderBell();
  }
  function timeAgo(t) {
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'قبل ثوانٍ';
    if (s < 3600) return 'قبل ' + Math.round(s / 60) + ' دقيقة';
    if (s < 86400) return 'قبل ' + Math.round(s / 3600) + ' ساعة';
    return new Date(t).toLocaleDateString('ar-EG-u-nu-latn');
  }

  // ——— سحب تغييرات الآخرين ———
  function applyRemote(data) {
    var changed = false;
    var changedKeys = [];
    Object.keys(data).forEach(function (k) {
      if (!isKpiKey(k)) return;
      var incoming = JSON.stringify(data[k]);
      if (localStorage.getItem(k) !== incoming) {
        origSet(k, incoming);
        changed = true;
        changedKeys.push(k);
      }
    });
    if (changed) { pendingReload = true; logActivity(changedKeys); }
    // إن لم يكن المستخدم يكتب الآن، اعكس التغييرات فورًا؛ وإلا انتظر حتى يتوقف
    if (pendingReload && !isEditing() && Object.keys(pending).length === 0) softRefresh();
    return changed;
  }

  function isEditing() {
    var el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
  }

  function softRefresh() {
    location.reload();
  }

  // متى ما توقّف المستخدم عن الكتابة، اعكس تغييرات الآخرين المعلّقة
  document.addEventListener('focusout', function () {
    setTimeout(function () {
      if (pendingReload && !isEditing() && Object.keys(pending).length === 0) softRefresh();
    }, 300);
  });

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

  var retries = 0;

  // ——— زر التحديث اليدوي (يسحب أحدث البيانات من القاعدة ويعيد العرض) ———
  function forceSync() {
    var btn = document.getElementById('__kpi_refresh_btn');
    if (btn) { btn.classList.add('__spin'); btn.style.opacity = '0.6'; }
    return api('/api/state')
      .then(function (res) {
        online = true;
        lastTs = res.ts || 0;
        var changed = applyRemote(res.data || {});
        if (!changed) { if (btn) { btn.classList.remove('__spin'); btn.style.opacity = '1'; } }
        // إن تغيّرت البيانات ستُعاد الصفحة تلقائيًا داخل applyRemote
      })
      .catch(function () {
        if (btn) { btn.classList.remove('__spin'); btn.style.opacity = '1'; }
        alert('تعذّر الاتصال بقاعدة البيانات. تأكد من نشر الخادم وربط MYSQL_URL.');
      });
  }

  function mountRefreshButton() {
    if (document.getElementById('__kpi_refresh_btn')) return;
    var style = document.createElement('style');
    style.textContent = '@keyframes __kpispin{to{transform:rotate(360deg)}}#__kpi_refresh_btn.__spin svg{animation:__kpispin .8s linear infinite}';
    document.head.appendChild(style);
    var b = document.createElement('button');
    b.id = '__kpi_refresh_btn';
    b.title = 'تحديث البيانات';
    b.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:99998;width:52px;height:52px;border:none;border-radius:50%;background:#1D4ED8;color:#fff;box-shadow:0 6px 18px rgba(29,78,216,.4);cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif';
    b.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-8-5"/><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 8 5"/><path d="M21 4v4h-4"/><path d="M3 20v-4h4"/></svg>';
    b.onclick = forceSync;
    document.body.appendChild(b);
  }

  // ——— جرس إشعارات النشاط ———
  function mountBell() {
    if (document.getElementById('__kpi_bell_btn')) return;
    var b = document.createElement('button');
    b.id = '__kpi_bell_btn';
    b.title = 'إشعارات التحديثات';
    b.style.cssText = 'position:fixed;bottom:82px;left:20px;z-index:99998;width:52px;height:52px;border:none;border-radius:50%;background:#0E1A33;color:#fff;box-shadow:0 6px 18px rgba(14,26,51,.4);cursor:pointer;display:flex;align-items:center;justify-content:center';
    b.innerHTML = '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg><span id="__kpi_bell_badge" style="position:absolute;top:6px;right:8px;min-width:17px;height:17px;padding:0 3px;background:#DC2626;color:#fff;font-size:10px;font-weight:700;border-radius:9px;display:none;align-items:center;justify-content:center;font-family:system-ui"></span>';
    var panel = document.createElement('div');
    panel.id = '__kpi_bell_panel';
    panel.style.cssText = 'position:fixed;bottom:82px;left:82px;z-index:99999;width:300px;max-height:60vh;overflow-y:auto;background:#fff;border:1px solid #E5EAF1;border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.18);display:none;direction:rtl;font-family:system-ui,sans-serif';
    document.body.appendChild(panel);
    b.onclick = function () {
      var open = panel.style.display === 'block';
      panel.style.display = open ? 'none' : 'block';
      if (!open) { seen = loadActivity().length; try { origSet('__kpi_seen', String(seen)); } catch (e) {} renderBell(); }
    };
    document.body.appendChild(b);
    renderBell();
  }
  var seen = 0;
  try { seen = Number(localStorage.getItem('__kpi_seen') || 0); } catch (e) {}
  function renderBell() {
    var badge = document.getElementById('__kpi_bell_badge');
    var panel = document.getElementById('__kpi_bell_panel');
    if (!badge || !panel) return;
    var list = loadActivity();
    var unseen = Math.max(0, list.length - seen);
    if (unseen > 0) { badge.style.display = 'flex'; badge.textContent = unseen > 99 ? '99+' : unseen; }
    else badge.style.display = 'none';
    var head = '<div style="padding:13px 16px;border-bottom:1px solid #EEF2F7;font-weight:700;color:#0F172A;font-size:14px">إشعارات التحديثات</div>';
    if (!list.length) { panel.innerHTML = head + '<div style="padding:18px;text-align:center;color:#94A3B8;font-size:13px">لا توجد تحديثات بعد</div>'; return; }
    panel.innerHTML = head + list.map(function (n) {
      return '<div style="display:flex;gap:10px;align-items:flex-start;padding:11px 16px;border-bottom:1px solid #F1F5F9">' +
        '<span style="width:8px;height:8px;border-radius:50%;background:#2563EB;margin-top:5px;flex-shrink:0"></span>' +
        '<div style="flex:1"><div style="font-size:12.5px;color:#0F172A">' + n.msg + '</div>' +
        '<div style="font-size:11px;color:#94A3B8;margin-top:2px">' + timeAgo(n.t) + '</div></div></div>';
    }).join('');
  }

  // ——— الإقلاع: القاعدة السحابية هي المصدر الوحيد للبيانات ———
  function boot() {
    mountRefreshButton();
    mountBell();
    api('/api/state')
      .then(function (res) {
        online = true;
        lastTs = res.ts || 0;
        booting = true;
        var changed = applyRemote(res.data || {});
        booting = false;
        window.__KPI_CLOUD__ = { online: true };
        banner('', '');
        if (!changed) setTimeout(poll, POLL_MS);
      })
      .catch(function () {
        online = false;
        retries++;
        window.__KPI_CLOUD__ = { online: false };
        // بعد عدة محاولات فاشلة نفترض أن الخادم غير مُشغّل (وضع معاينة قبل النشر)
        if (retries >= 3) {
          banner('', '');
        } else {
          banner('⏳ جارٍ الاتصال بقاعدة البيانات السحابية…', '#B45309');
        }
        setTimeout(boot, 3000);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
