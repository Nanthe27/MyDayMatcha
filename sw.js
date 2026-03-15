/* My Day Matcha — Root Service Worker v5.0.9 */
const CACHE = 'mdm-root-v5.0.9';

const PRECACHE = [
    './',
    './index.html',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Quicksand:wght@700&family=Courier+Prime&display=swap'
];

/* ── Install: pre-cache shell assets ── */
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(cache =>
            Promise.allSettled(PRECACHE.map(url => cache.add(url).catch(() => {})))
        ).then(() => self.skipWaiting())
    );
});

/* ── Activate: purge old caches ── */
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

/* ── Fetch: cache-first for static, network-first for API ── */
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    /* Always network for Google Apps Script API calls */
    if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') {
        e.respondWith(
            fetch(e.request).catch(() =>
                new Response(JSON.stringify({ success: false, error: 'Offline' }), {
                    headers: { 'Content-Type': 'application/json' }
                })
            )
        );
        return;
    }

    /* Cache-first for everything else */
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(res => {
                if (!res || res.status !== 200) return res;
                const clone = res.clone();
                caches.open(CACHE).then(cache => cache.put(e.request, clone));
                return res;
            }).catch(() => {
                if (e.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
