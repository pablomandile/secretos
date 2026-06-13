/**
 * Reproduce el rebote al login: tras loguearse, GET /api/vault sin Origin ni
 * Referer (lo que hace el navegador en un GET same-origin con Referrer-Policy:
 * no-referrer) devuelve 401 → el interceptor rebota al login.
 *
 *   npx vite-node scripts/repro-login-bounce.ts
 */
import { toBase64 } from '../resources/js/crypto/encoding';
import { deriveMasterKey, DEFAULT_KDF_PARAMS } from '../resources/js/crypto/kdf';
import { deriveAuthVerifier, deriveWrappingKey, generateVaultKeyBytes, wrapVaultKey } from '../resources/js/crypto/keys';

const BASE = 'http://localhost:8000';
const cookies = new Map<string, string>();

function storeCookies(res: Response): void {
    for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
}

// headers: control fino de Origin/Referer para simular al navegador.
async function req(method: string, path: string, opts: { body?: unknown; origin?: boolean; referer?: string } = {}): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.origin) headers.Origin = BASE;
    if (opts.referer) headers.Referer = opts.referer;
    if (opts.body) headers['Content-Type'] = 'application/json';
    const xsrf = cookies.get('XSRF-TOKEN');
    if (xsrf) headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
    if (cookies.size) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(`${BASE}${path}`, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    storeCookies(res);
    return res;
}

async function main(): Promise<void> {
    const email = `repro-${Date.now()}@example.com`;
    const password = 'Clave-Repro-2026!';

    // El navegador manda Origin en GET del csrf-cookie? No (same-origin GET). Pero no está gateado.
    await req('GET', '/sanctum/csrf-cookie', { referer: `${BASE}/login` });

    const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
    const mk = await deriveMasterKey(password, salt, DEFAULT_KDF_PARAMS);
    const wrap = await deriveWrappingKey(mk);
    const protectedKey = await wrapVaultKey(wrap, generateVaultKeyBytes());

    // Registro y login: POST → el navegador SÍ manda Origin.
    await req('POST', '/api/auth/register', {
        origin: true,
        body: {
            email, name: 'Repro',
            kdf_type: DEFAULT_KDF_PARAMS.type, kdf_memory: DEFAULT_KDF_PARAMS.memory,
            kdf_iterations: DEFAULT_KDF_PARAMS.iterations, kdf_parallelism: DEFAULT_KDF_PARAMS.parallelism,
            kdf_salt: salt, verifier: await deriveAuthVerifier(mk), protected_key: protectedKey,
        },
    });

    // GET /api/vault de tres formas (sesión ya activa):
    const sinNada = await req('GET', '/api/vault', {});
    const conReferer = await req('GET', '/api/vault', { referer: `${BASE}/app` });
    const conOrigin = await req('GET', '/api/vault', { origin: true });

    console.log('GET /api/vault sin Origin ni Referer →', sinNada.status, '(navegador con no-referrer: el BUG)');
    console.log('GET /api/vault con Referer (same-origin) →', conReferer.status, '(lo que da Referrer-Policy: same-origin)');
    console.log('GET /api/vault con Origin →', conOrigin.status, '(control)');
}

main().catch((e) => { console.error(e); process.exit(1); });
