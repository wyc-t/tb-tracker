const CACHE_NAME = 'tb-tracker-v7';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/idb@8/build/umd.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      return resp;
    })).catch(() => caches.match('./index.html'))
  );
});

// Bring app to foreground when the user taps the 2-min notification
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('./');
    })
  );
});

// Schedule a notification from the page even when it is backgrounded.
// event.waitUntil() keeps the SW alive for the duration of the promise.
let _scheduledTimer = null;
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_SW_NOTIF') {
    // Cancel any previously scheduled notification first
    if (_scheduledTimer) { clearTimeout(_scheduledTimer); _scheduledTimer = null; }
    const delay = e.data.delay;
    e.waitUntil(
      new Promise(resolve => {
        _scheduledTimer = setTimeout(async () => {
          _scheduledTimer = null;
          await self.registration.showNotification('⏱ 2 minutes — rest up', {
            body: 'Stopwatch hit 2:00. Time to get back to it.',
            icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><rect width='512' height='512' rx='96' fill='%230a0a0f'/><text x='256' y='340' font-size='280' font-family='system-ui' font-weight='900' fill='%23e8c547' text-anchor='middle'>TB</text></svg>",
            tag: 'tb-stopwatch-2min',
            renotify: false,
          });
          resolve();
        }, delay);
      })
    );
  }

  if (e.data?.type === 'CANCEL_SW_NOTIF') {
    if (_scheduledTimer) { clearTimeout(_scheduledTimer); _scheduledTimer = null; }
  }
});
