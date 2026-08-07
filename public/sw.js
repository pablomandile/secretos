/**
 * Service worker mínimo de Secretos.
 *
 * Objetivos:
 *  - Habilitar la instalación como PWA (requiere un SW con handler de `fetch`).
 *  - Cachear SOLO los assets con hash de Vite (/build/…), que son inmutables.
 *
 * IMPORTANTE: no cacheamos ni el HTML ni las respuestas de /api. Es un gestor
 * de contraseñas: los datos sensibles nunca deben quedar en la caché del SW, y
 * el HTML lleva el CSRF token, que debe venir siempre fresco de la red.
 */
const CACHE = 'secretos-assets-v1';

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    // Solo los assets compilados de Vite (mismo origen, con hash → inmutables).
    if (url.origin === self.location.origin && url.pathname.startsWith('/build/')) {
        event.respondWith(
            caches.match(req).then(
                (hit) =>
                    hit ||
                    fetch(req).then((res) => {
                        if (res.ok) {
                            const copy = res.clone();
                            caches.open(CACHE).then((c) => c.put(req, copy));
                        }
                        return res;
                    }),
            ),
        );
    }
    // El resto (HTML, /api, etc.) sigue el comportamiento normal de red.
});
