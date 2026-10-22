/* Si-MAKO service worker — aplikasi tetap terbuka saat sinyal putus (data dari IndexedDB).
   API (script.google.com) TIDAK pernah di-cache di sini. */
const VER = 'simako-1.0.0';
const SHELL = ['./', 'index.html', 'config.js', 'config.js?v=1.0.0', 'css/app.css?v=1.0.0', 'js/icons.js?v=1.0.0', 'js/core.js?v=1.0.0', 'js/ui.js?v=1.0.0',
  'js/pages/beranda.js?v=1.0.0', 'js/pages/pesanan.js?v=1.0.0', 'js/pages/form-pesanan.js?v=1.0.0', 'js/pages/detail.js?v=1.0.0', 'js/pages/nota.js?v=1.0.0',
  'js/pages/pelanggan.js?v=1.0.0', 'js/pages/lainnya.js?v=1.0.0', 'js/pages/manajemen.js?v=1.0.0', 'js/app.js?v=1.0.0', 'icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;           // API & CDN lewat jaringan biasa
  const isConfig = u.pathname.endsWith('/config.js');
  e.respondWith(
    (isConfig || e.request.mode === 'navigate')
      ? fetch(e.request).then(r => { const c = r.clone(); caches.open(VER).then(ca => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
      : caches.match(e.request).then(r => r || fetch(e.request).then(res => { const c = res.clone(); caches.open(VER).then(ca => ca.put(e.request, c)); return res; }))
  );
});
