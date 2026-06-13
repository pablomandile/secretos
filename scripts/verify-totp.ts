/**
 * Verificación e2e de TOTP: guarda un secreto otpauth:// como campo type=3
 * (cifrado), lo relee desde /vault, lo descifra y genera el código.
 *
 *   npx vite-node scripts/verify-totp.ts
 */
import { toBase64 } from '../resources/js/crypto/encoding';
import { deriveMasterKey, DEFAULT_KDF_PARAMS } from '../resources/js/crypto/kdf';
import { deriveAuthVerifier, deriveWrappingKey, generateVaultKeyBytes, importVaultKey, wrapVaultKey } from '../resources/js/crypto/keys';
import { decryptString, encryptString } from '../resources/js/crypto/cipher';
import { generateTotp, normalizeTotpInput } from '../resources/js/crypto/totp';

const BASE = 'http://localhost:8000';
const cookies = new Map<string, string>();

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

async function main(): Promise<void> {
    const email = `totp-${Date.now()}@example.com`;
    const password = 'Clave-TOTP-2026!';
    // otpauth con el seed del RFC 6238.
    const otpauth = 'otpauth://totp/Demo:pablo?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Demo';

    await req('GET', '/sanctum/csrf-cookie');
    const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
    const mk = await deriveMasterKey(password, salt, DEFAULT_KDF_PARAMS);
    const wrap = await deriveWrappingKey(mk);
    const vaultBytes = generateVaultKeyBytes();
    const protectedKey = await wrapVaultKey(wrap, vaultBytes);
    const vaultKey = await importVaultKey(vaultBytes);
    const enc = (s: string) => encryptString(vaultKey, s);
    const dec = (s: string) => decryptString(vaultKey, s);

    await req('POST', '/api/auth/register', {
        email, name: 'TOTP',
        kdf_type: DEFAULT_KDF_PARAMS.type, kdf_memory: DEFAULT_KDF_PARAMS.memory,
        kdf_iterations: DEFAULT_KDF_PARAMS.iterations, kdf_parallelism: DEFAULT_KDF_PARAMS.parallelism,
        kdf_salt: salt, verifier: await deriveAuthVerifier(mk), protected_key: protectedKey,
    });

    await req('POST', '/api/entries', {
        type: 1,
        title: await enc('Cuenta con 2FA'),
        username: null, password: null, url: null, notes: null, favorite: false,
        custom_fields: [{ label: await enc('TOTP'), value: await enc(otpauth), type: 3, protected: true, position: 0 }],
        tag_ids: [],
    });

    const vault = await (await req('GET', '/api/vault')).json();
    const field = vault.entries[0].custom_fields.find((f: any) => f.type === 3);
    const recovered = await dec(field.value);
    const cfg = normalizeTotpInput(recovered);
    const code = await generateTotp(cfg.secret, { period: cfg.period, digits: cfg.digits, algorithm: cfg.algorithm });

    console.log('otpauth recuperado intacto →', recovered === otpauth);
    console.log('código TOTP generado →', code, '(' + (/^\d{6}$/.test(code) ? '6 dígitos OK' : 'FORMATO INVÁLIDO') + ')');
    // Comprobación contra el vector RFC (T=59): el mismo secreto a T=59 da 287082 (6 dígitos).
    const rfc = await generateTotp(cfg.secret, { timestamp: 59000, period: 30, digits: 6 });
    console.log('vector RFC T=59 (6 díg) →', rfc, '(esperado 287082) →', rfc === '287082');
}

main().catch((e) => { console.error(e); process.exit(1); });
