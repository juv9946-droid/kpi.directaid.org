/*
 * البث اللحظي (Server-Sent Events)
 * كل متصفح مفتوح يحتفظ باتصال دائم بالخادم؛ وعند أي تعديل من أي مستخدم
 * يُدفع التغيير فورًا إلى بقية المستخدمين دون انتظار أو تحديث يدوي.
 */
const clients = new Set();

function addClient(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');
  clients.add(res);

  // نبضة حقيقية كـ data event (وليست تعليقًا) ليتحقّق العميل من حيوية الاتصال فعليًا
  const ping = setInterval(() => {
    send(res, { ping: true, ts: Date.now() });
  }, 15000);

  req.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
}

function send(res, payload) {
  try {
    res.write('data: ' + JSON.stringify(payload) + '\n\n');
  } catch (e) {
    clients.delete(res);
  }
}

function broadcast(payload, exclude) {
  for (const res of clients) {
    if (res === exclude) continue;
    send(res, payload);
  }
}

function count() { return clients.size; }

module.exports = { addClient, send, broadcast, count };
