/**
 * Verificación del cambio de clave maestra contra la API viva.
 *   registro (clave A) + item → cambio A→B → login con A falla → login con B OK
 *   y el item sigue descifrable (la vaultKey es la misma, solo re-envuelta).
 *
 *   npx vite-node scripts/verify-password-change.ts
 */
import { toBase64 } from '../resources/js/crypto/encoding';
import { deriveMasterKey, DEFAULT_KDF_PARAMS } from '../resources/js/crypto/kdf';
import {
    deriveAuthVerifier,
    deriveWrappingKey,
    generateVaultKeyBytes,
    importVaultKey,
    unwrapVaultKey,
    wrapVaultKey,
} from '../resources/js/crypto/keys';
import { decryptBytes, decryptString, encryptString } from '../resources/js/crypto/cipher';

const BASE = 'http://localhost:8000';
let cookies = new Map<string, string>();

function storeCookies(res: Response): void {
    for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
}

async function req(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json', Origin: BASE };
    if (body) headers['Content-Type'] = 'application/json';
    const xsrf = cookies.get('XSRF-TOKEN');
    if (xsrf) headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
    if (cookies.size) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    storeCookies(res);
    return res;
}

const kdfBody = (salt: string) => ({
    kdf_type: DEFAULT_KDF_PARAMS.type,
    kdf_memory: DEFAULT_KDF_PARAMS.memory,
    kdf_iterations: DEFAULT_KDF_PARAMS.iterations,
    kdf_parallelism: DEFAULT_KDF_PARAMS.parallelism,
    kdf_salt: salt,
});

async function main(): Promise<void> {
    const email = `pwchange-${Date.now()}@example.com`;
    const passA = 'Clave-Vieja-A-2026!';
    const passB = 'Clave-Nueva-B-2026!';

    await req('GET', '/sanctum/csrf-cookie');

    // Registro con clave A
    const saltA = toBase64(crypto.getRandomValues(new Uint8Array(16)));
    const mkA = await deriveMasterKey(passA, saltA, DEFAULT_KDF_PARAMS);
    const wrapA = await deriveWrappingKey(mkA);
    const vaultBytes = generateVaultKeyBytes();
    const protectedA = await wrapVaultKey(wrapA, vaultBytes);
    const vaultKey = await importVaultKey(vaultBytes);
    await req('POST', '/api/auth/register', {
        email,
        name: 'PwChange',
        ...kdfBody(saltA),
        verifier: await deriveAuthVerifier(mkA),
        protected_key: protectedA,
    });

    const itemCipher = await encryptString(vaultKey, 'mi-secreto-importante');
    // (no hace falta persistir el item para esta prueba; alcanza con re-descifrarlo)

    // Cambio A → B (re-envuelve la MISMA vaultKey)
    const rawVault = await decryptBytes(wrapA, protectedA);
    const saltB = toBase64(crypto.getRandomValues(new Uint8Array(16)));
    const mkB = await deriveMasterKey(passB, saltB, DEFAULT_KDF_PARAMS);
    const wrapB = await deriveWrappingKey(mkB);
    const protectedB = await wrapVaultKey(wrapB, rawVault);
    const change = await req('PUT', '/api/account/master-password', {
        current_verifier: await deriveAuthVerifier(mkA),
        verifier: await deriveAuthVerifier(mkB),
        ...kdfBody(saltB),
        protected_key: protectedB,
    });
    console.log('cambio de clave →', change.status === 200 ? 'OK' : await change.text());

    // Login con clave VIEJA (debe fallar)
    cookies = new Map();
    await req('GET', '/sanctum/csrf-cookie');
    const preOld = await (await req('POST', '/api/auth/prelogin', { email })).json();
    const mkOld = await deriveMasterKey(passA, preOld.kdf_salt, {
        type: preOld.kdf_type, memory: preOld.kdf_memory, iterations: preOld.kdf_iterations, parallelism: preOld.kdf_parallelism,
    });
    const loginOld = await req('POST', '/api/auth/login', { email, verifier: await deriveAuthVerifier(mkOld) });
    console.log('login con clave vieja →', loginOld.status === 422 ? 'RECHAZADO (correcto)' : `INESPERADO ${loginOld.status}`);

    // Login con clave NUEVA (debe funcionar y descifrar el item)
    cookies = new Map();
    await req('GET', '/sanctum/csrf-cookie');
    const preNew = await (await req('POST', '/api/auth/prelogin', { email })).json();
    const mkNew = await deriveMasterKey(passB, preNew.kdf_salt, {
        type: preNew.kdf_type, memory: preNew.kdf_memory, iterations: preNew.kdf_iterations, parallelism: preNew.kdf_parallelism,
    });
    const loginNew = await (await req('POST', '/api/auth/login', { email, verifier: await deriveAuthVerifier(mkNew) })).json();
    const wrapNew = await deriveWrappingKey(mkNew);
    const vaultKey2 = await unwrapVaultKey(wrapNew, loginNew.protected_key);
    const recovered = await decryptString(vaultKey2, itemCipher);
    console.log('login con clave nueva → OK; item descifrado →', JSON.stringify(recovered));
    console.log('item intacto →', recovered === 'mi-secreto-importante');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
