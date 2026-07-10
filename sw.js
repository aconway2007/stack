// Network-first: always serve the freshest version, fall back to cache offline
const CACHE = 'stack-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});

// Daily summary push: the page mirrors today's totals into the cache
// (./__stk-summary) since the SW can't read localStorage. Summary format
// mirrors buildDailySummary() in index.html.
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let body = 'Open Stack to see today\'s macros';
    try {
      const res = await caches.match('./__stk-summary');
      if (res) {
        const d = await res.json();
        const now = new Date();
        const p = n => String(n).padStart(2,'0');
        const today = `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}`;
        const cal = d.date === today ? d.cal : 0;
        const pro = d.date === today ? d.pro : 0;
        const proLeft = d.proGoal - pro;
        let status;
        if (cal > d.calGoal)   status = `${(cal-d.calGoal).toLocaleString()} cal over goal`;
        else if (proLeft <= 0) status = 'Protein goal hit 💪';
        else                   status = `${proLeft}g protein to go`;
        body = `${cal.toLocaleString()} / ${d.calGoal.toLocaleString()} cal · ${pro}g / ${d.proGoal}g protein\n${status}`;
      }
    } catch {}
    await self.registration.showNotification('Daily Summary', { body, tag: 'stk-daily' });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true })
      .then(cs => cs.length ? cs[0].focus() : clients.openWindow('./'))
  );
});
