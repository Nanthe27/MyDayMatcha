/* My Day Matcha Loyalty — Service Worker v1.0.1 */
const CACHE = 'mdm-loyalty-v1.0.1';

const PRECACHE = [
    './',
    './index.html',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Quicksand:wght@700&display=swap',
    'https://unpkg.com/html5-qrcode',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

/* ── Install: pre-cache shell assets ── */
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(cache => {
            return Promise.allSettled(
                PRECACHE.map(url => cache.add(url).catch(() => {}))
            );
        }).then(() => self.skipWaiting())
    );
});

/* ── Activate: purge old caches ── */
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

/* ── Fetch: cache-first for static assets, network-first for API ── */
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    /* Always go network for Google Apps Script API calls */
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

    /* Cache-first for everything else (fonts, scripts, shell) */
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(res => {
                /* Only cache valid same-origin or whitelisted responses */
                if (!res || res.status !== 200) return res;
                const clone = res.clone();
                caches.open(CACHE).then(cache => cache.put(e.request, clone));
                return res;
            }).catch(() => {
                /* Offline fallback for navigation requests */
                if (e.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
