/**
 * Service worker de Secretos: instalable + uso SIN CONEXIÓN de solo lectura.
 *
 * Qué se guarda (y por qué es seguro):
 *  - /build/…        bundle compilado (hash en el nombre → inmutable). Se precachea
 *                    entero desde /build/manifest.json para que todas las pantallas
 *                    abran sin red.
 *  - HTML de la SPA  un único "shell": toda ruta del cliente sirve el mismo HTML.
 *                    La app no usa el <meta csrf-token>: el token viaja por cookie.
 *  - JSON de la API  SOLO lecturas de la bóveda (session, vault, trash, versiones).
 *                    Son ciphertext: título, usuario, clave, notas y carpetas ya
 *                    salen cifrados con la vaultKey, que nunca toca el servidor ni
 *                    el disco. Sin la contraseña maestra no se lee nada.
 *
 * Reglas de seguridad:
 *  - Network-first: con red SIEMPRE manda lo del servidor. La copia solo se usa si
 *    el pedido falla por red (no ante un 401/500).
 *  - Un 401 borra lo guardado (la sesión murió).
 *  - La app manda `borrar-datos` al cerrar sesión / iniciar otra, y se borra todo.
 *  - Las escrituras (POST/PUT/PATCH/DELETE) nunca se encolan: sin red fallan y la
 *    app avisa que la acción necesita conexión.
 */
const CACHE = 'secretos-assets-v2'; // bundle + shell HTML
const DATOS = 'secretos-datos-v1'; // JSON de lectura de la API (ciphertext)
const SHELL = '/__shell';

// Lecturas de la API que se guardan para uso sin conexión.
const API_GUARDABLE = /^\/api\/(auth\/session|vault|trash|entries\/[^/]+\/versions(\/[^/]+)?)$/;
// Navegaciones que NO son la SPA (redirecciones de Google, tablero de tests).
const NO_SHELL = /^\/(auth\/google|test-report)/;

async function precachearBundle() {
    const cache = await caches.open(CACHE);
    try {
        const res = await fetch('/build/manifest.json', { cache: 'no-store' });
        if (!res.ok) return;
        const manifest = await res.json();
        const urls = new Set();
        for (const item of Object.values(manifest)) {
            if (item.file) urls.add('/build/' + item.file);
            (item.css || []).forEach((f) => urls.add('/build/' + f));
            (item.assets || []).forEach((f) => urls.add('/build/' + f));
        }
        // De a una: si falla alguna, el resto igual queda guardado.
        for (const url of urls) {
            if (await cache.match(url)) continue;
            try {
                const r = await fetch(url);
                if (r.ok) await cache.put(url, r);
            } catch {
                /* sin red a mitad del precacheo: se completa en la próxima visita */
            }
        }
    } catch {
        /* sin manifest o sin red: el cache-first de /build/ va llenándolo igual */
    }
}

async function guardarShell() {
    try {
        const res = await fetch('/app', { credentials: 'same-origin', cache: 'no-store' });
        const tipo = res.headers.get('content-type') || '';
        if (res.ok && !res.redirected && tipo.includes('text/html')) {
            await (await caches.open(CACHE)).put(SHELL, res);
        }
    } catch {
        /* sin red */
    }
}

async function borrarDatos() {
    await caches.delete(DATOS);
}

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(Promise.all([precachearBundle(), guardarShell()]));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== DATOS).map((k) => caches.delete(k))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('message', (event) => {
    if (event.data === 'borrar-datos') {
        event.waitUntil(borrarDatos());
    } else if (event.data === 'guardar-shell') {
        event.waitUntil(Promise.all([precachearBundle(), guardarShell()]));
    }
});

/** Respuesta guardada de la API, marcada para que la app sepa que es una copia. */
async function copiaDeLaApi(req) {
    const hit = await (await caches.open(DATOS)).match(req, { ignoreVary: true });
    if (!hit) {
        return new Response(JSON.stringify({ message: 'Sin conexión y sin datos guardados.' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'X-Sin-Conexion': '1' },
        });
    }
    const headers = new Headers(hit.headers);
    headers.set('X-Sin-Conexion', '1');
    return new Response(hit.body, { status: 200, headers });
}

async function apiNetworkFirst(req) {
    try {
        const res = await fetch(req);
        const cache = await caches.open(DATOS);
        if (res.ok) {
            const headers = new Headers(res.headers);
            headers.set('X-Guardado-En', new Date().toISOString());
            const body = await res.clone().blob();
            await cache.put(req, new Response(body, { status: 200, headers }));
        } else if (res.status === 401) {
            // La sesión murió: nada de lo guardado debe seguir disponible.
            await borrarDatos();
        }
        return res;
    } catch {
        return copiaDeLaApi(req);
    }
}

async function navegacion(req) {
    const cache = await caches.open(CACHE);
    try {
        const res = await fetch(req);
        const tipo = res.headers.get('content-type') || '';
        // Solo HTML de la SPA, sin redirecciones (un login no puede quedar de shell).
        if (res.ok && !res.redirected && tipo.includes('text/html')) {
            cache.put(SHELL, res.clone());
        }
        return res;
    } catch {
        const shell = await cache.match(SHELL);
        if (shell) return shell;
        return new Response(
            '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
                '<title>Sin conexión</title><body style="font-family:sans-serif;max-width:32rem;margin:4rem auto;padding:1rem">' +
                '<h1>Sin conexión</h1><p>Todavía no hay nada guardado en este dispositivo. ' +
                'Abrí Secretos una vez con conexión para poder usarlo sin red.</p></body>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        );
    }
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    // Bundle compilado: cache-first.
    if (url.pathname.startsWith('/build/')) {
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
        return;
    }

    // Lecturas de la bóveda: network-first con copia para cuando no hay red.
    if (API_GUARDABLE.test(url.pathname)) {
        event.respondWith(apiNetworkFirst(req));
        return;
    }

    // Abrir la app: red; sin red, el shell guardado.
    if (req.mode === 'navigate' && !NO_SHELL.test(url.pathname)) {
        event.respondWith(navegacion(req));
    }
    // El resto (otra /api, sanctum, etc.) sigue el comportamiento normal de red.
});
