// Offline helper: always tries the network first (so updates show up straight away)
// and falls back to the last copy only when there's no connection.
const CACHE = 'kade-ondu-v5';
const SHELL = ['/', '/index.html', '/style.css', '/app.js', '/config.js', '/shared/game.js',
  '/fonts/inter-black-italic.woff', '/icons/icon-192.png', '/fx/mani.webp', '/fx/rangoli.svg', '/fx/evil-laugh.mp3',
  '/fx/reactions/nice_play.webp', '/fx/reactions/really.webp', '/fx/reactions/whats_next.webp',
  '/fx/reactions/oh_no.webp', '/fx/reactions/angry.webp', '/fx/reactions/evil.webp'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname === '/ws' || url.pathname === '/lobby' || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('/')))
  );
});
