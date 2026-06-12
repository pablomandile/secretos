/**
 * Verificación end-to-end de la ceremonia zero-knowledge contra la API viva.
 * Usa los MISMOS módulos crypto que el navegador (hash-wasm + WebCrypto corren
 * en Node 22) y maneja a mano el flujo de cookie CSRF de Sanctum.
 *
 * Ejecutar con la app sirviendo en http://localhost:8000:
 *   npx vite-node scripts/verify-ceremony.ts
 */
import { toBase64, zero } from '../resources/js/crypto/encoding';
import { deriveMasterKey, DEFAULT_KDF_PARAMS } from '../resources/js/crypto/kdf';
import {
    deriveAuthVerifier,
    deriveWrappingKey,
    generateVaultKeyBytes,
    unwrapVaultKey,
    wrapVaultKey,
} from '../resources/js/crypto/keys';
import { decryptString, encryptString } from '../resources/js/crypto/cipher';
import { importVaultKey } from '../resources/js/crypto/keys';

const BASE = 'http://localhost:8000';
const ORIGIN = 'http://localhost:8000';

const cookies = new Map<string, string>();

function cookieHeader(): string {
    return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function storeCookies(res: Response): void {
    for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
}

async function req(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        Origin: ORIGIN,
    };
    if (body) headers['Content-Type'] = 'application/json';
    const xsrf = cookies.get('XSRF-TOKEN');
    if (xsrf) headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
    if (cookies.size) headers.Cookie = cookieHeader();

    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    storeCookies(res);
    return res;
}

async function main(): Promise<void> {
    const email = `verify-${Date.now()}@example.com`;
    const password = 'Una-Clave-Maestra-Muy-Larga-2026!';

    // 0) cookie CSRF
    await req('GET', '/sanctum/csrf-cookie');

    // 1) ceremonia de registro (idéntica al navegador)
    const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
    const kdf = DEFAULT_KDF_PARAMS;
    const masterKey = await deriveMasterKey(password, salt, kdf);
    const verifier = await deriveAuthVerifier(masterKey);
    const wrappingKey = await deriveWrappingKey(masterKey);
    const vaultBytes = generateVaultKeyBytes();
    const protectedKey = await wrapVaultKey(wrappingKey, vaultBytes);
    const vaultKey = await importVaultKey(vaultBytes);
    zero(vaultBytes);

    // Un "item" cifrado de ejemplo, como guardaría la bóveda.
    const itemCipher = await encryptString(vaultKey, 'mi-password-de-github');

    const reg = await req('POST', '/api/auth/register', {
        email,
        name: 'Verificación',
        kdf_type: kdf.type,
        kdf_memory: kdf.memory,
        kdf_iterations: kdf.iterations,
        kdf_parallelism: kdf.parallelism,
        kdf_salt: salt,
        verifier,
        protected_key: protectedKey,
    });
    console.log('register →', reg.status, reg.status === 201 ? 'OK' : await reg.text());

    // 2) login en limpio: re-derivar desde la contraseña y desenvolver la bóveda
    cookies.clear();
    await req('GET', '/sanctum/csrf-cookie');
    const pre = await (await req('POST', '/api/auth/prelogin', { email })).json();
    const mk2 = await deriveMasterKey(password, pre.kdf_salt, {
        type: pre.kdf_type,
        memory: pre.kdf_memory,
        iterations: pre.kdf_iterations,
        parallelism: pre.kdf_parallelism,
    });
    const verifier2 = await deriveAuthVerifier(mk2);
    const login = await req('POST', '/api/auth/login', { email, verifier: verifier2 });
    const loginData = await login.json();
    console.log('login    →', login.status, login.status === 200 ? 'OK' : JSON.stringify(loginData));

    const wrappingKey2 = await deriveWrappingKey(mk2);
    const vaultKey2 = await unwrapVaultKey(wrappingKey2, loginData.protected_key);
    const recovered = await decryptString(vaultKey2, itemCipher);
    console.log('item descifrado tras login →', JSON.stringify(recovered));
    console.log('coincide con el original  →', recovered === 'mi-password-de-github');

    console.log('\nEMAIL DE PRUEBA:', email);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
