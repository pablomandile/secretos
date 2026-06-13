/**
 * Verificación e2e de la importación KeePass CSV: parsea un CSV realista
 * (coma en contraseña, salto de línea en notas, TOTP), crea carpetas+entradas
 * cifradas vía la API real, relee /vault y valida que todo llegó intacto.
 *
 *   npx vite-node scripts/verify-import.ts
 */
import { toBase64 } from '../resources/js/crypto/encoding';
import { deriveMasterKey, DEFAULT_KDF_PARAMS } from '../resources/js/crypto/kdf';
import { deriveAuthVerifier, deriveWrappingKey, generateVaultKeyBytes, importVaultKey, wrapVaultKey } from '../resources/js/crypto/keys';
import { decryptString, encryptString } from '../resources/js/crypto/cipher';
import { parseKeepassCsv } from '../resources/js/services/keepassImport';

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

// CSV de KeePass 2.x con casos difíciles: coma en password, salto de línea en notas, TOTP.
const CSV = `"Group","Title","Username","Password","URL","Notes","TOTP"
"Trabajo","GitHub","pablo","gh-pass","https://github.com","nota simple",""
"Trabajo","GitLab","pablo2","gl-pass","https://gitlab.com","",""
"Personal","Banco","juan","b4nk, con coma","https://banco.com","línea1
línea2","JBSWY3DPEHPK3PXP"`;

async function main(): Promise<void> {
    const email = `import-${Date.now()}@example.com`;
    const password = 'Clave-Import-2026!';

    await req('GET', '/sanctum/csrf-cookie');
    const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
    const mk = await deriveMasterKey(password, salt, DEFAULT_KDF_PARAMS);
    const wrap = await deriveWrappingKey(mk);
    const vaultBytes = generateVaultKeyBytes();
    const protectedKey = await wrapVaultKey(wrap, vaultBytes);
    const vaultKey = await importVaultKey(vaultBytes);
    const enc = (s: string) => encryptString(vaultKey, s);
    const dec = (s: string) => decryptString(vaultKey, s);
    const optional = async (s: string) => (s ? await enc(s) : null);

    await req('POST', '/api/auth/register', {
        email, name: 'Import',
        kdf_type: DEFAULT_KDF_PARAMS.type, kdf_memory: DEFAULT_KDF_PARAMS.memory,
        kdf_iterations: DEFAULT_KDF_PARAMS.iterations, kdf_parallelism: DEFAULT_KDF_PARAMS.parallelism,
        kdf_salt: salt, verifier: await deriveAuthVerifier(mk), protected_key: protectedKey,
    });

    // --- Orquestación de import (igual que vault.importRows) ---
    const rows = parseKeepassCsv(CSV);
    console.log('filas parseadas →', rows.length, '(esperado 3)');

    const folderMap = new Map<string, string>();
    for (const group of [...new Set(rows.map((r) => r.group).filter(Boolean))]) {
        const folder = await (await req('POST', '/api/folders', { name: await enc(group) })).json();
        folderMap.set(group, folder.data.id);
    }

    for (const r of rows) {
        await req('POST', '/api/entries', {
            type: 1,
            title: await enc(r.title || '(sin título)'),
            username: await optional(r.username),
            password: await optional(r.password),
            url: await optional(r.url),
            notes: await optional(r.notes),
            favorite: false,
            folder_id: r.group ? folderMap.get(r.group) : null,
            custom_fields: r.totp ? [{ label: await enc('TOTP'), value: await enc(r.totp), type: 3, protected: true, position: 0 }] : [],
            tag_ids: [],
        });
    }

    // --- Releer y validar ---
    const vault = await (await req('GET', '/api/vault')).json();
    let banco: any = null;
    for (const e of vault.entries) {
        if ((await dec(e.title)) === 'Banco') {
            banco = e;
            break;
        }
    }

    const checks = {
        folders: vault.folders.length === 2,
        entries: vault.entries.length === 3,
        comaEnPassword: (await dec(banco.password)) === 'b4nk, con coma',
        saltoEnNotas: (await dec(banco.notes)) === 'línea1\nlínea2',
        totp: banco.custom_fields.length === 1 && (await dec(banco.custom_fields[0].value)) === 'JBSWY3DPEHPK3PXP',
    };
    console.log('validaciones →', checks);
    console.log('TODO OK →', Object.values(checks).every(Boolean));
}

main().catch((e) => { console.error(e); process.exit(1); });
