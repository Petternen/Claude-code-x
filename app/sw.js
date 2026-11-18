// Offline-støtte. Egne filer: nettet først (nye versjoner vises med en gang),
// lagret kopi brukes bare når nettet ikke svarer. Skrifttyper: lagret kopi først.
const CACHE = 'stjerneskolen-v3';
const ASSETS = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/main.js', 'js/data.js', 'js/state.js', 'js/speech.js', 'js/fx.js', 'js/sfx.js', 'js/math.js', 'js/write.js',
  'js/content.js', 'js/listen.js', 'js/read.js', 'js/shop.js', 'js/memory.js', 'js/draw.js', 'js/screentime.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];
const NET_TIMEOUT = 4000;

self.addEventListener('install', e => {
  // cache: 'reload' går forbi nettleserens HTTP-buffer, så vi aldri lagrer en gammel fil
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function fromNetwork(req, cache) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), NET_TIMEOUT);
    fetch(req, { cache: 'no-cache' }).then(res => {
      clearTimeout(t);
      if (res && res.ok) cache.put(req, res.clone());
      resolve(res);
    }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  e.respondWith(caches.open(CACHE).then(async cache => {
    if (sameOrigin) {
      try { return await fromNetwork(req, cache); }
      catch { return (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? cache.match('index.html') : Response.error()); }
    }
    // Andre domener (skrifttyper): lagret kopi først, oppdater i bakgrunnen
    const hit = await cache.match(req);
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
