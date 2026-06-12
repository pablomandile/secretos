/**
 * Verificación end-to-end de la bóveda (Fase 4) contra la API viva, usando los
 * mismos módulos crypto del navegador. Crea carpeta + etiqueta + entrada con
 * campo personalizado, relee /vault y descifra para confirmar el round-trip.
 *
 *   npx vite-node scripts/verify-vault.ts
 */
import { toBase64 } from '../resources/js/crypto/encoding';
import { deriveMasterKey, DEFAULT_KDF_PARAMS } from '../resources/js/crypto/kdf';
import {
    deriveAuthVerifier,
    deriveWrappingKey,
    generateVaultKeyBytes,
    importVaultKey,
    wrapVaultKey,
} from '../resources/js/crypto/keys';
import { decryptString, encryptString } from '../resources/js/crypto/cipher';

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
    const email = `vault-${Date.now()}@example.com`;
    const password = 'Clave-Maestra-De-Prueba-2026!';

    await req('GET', '/sanctum/csrf-cookie');

    // Registro + vaultKey
    const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
    const masterKey = await deriveMasterKey(password, salt, DEFAULT_KDF_PARAMS);
    const verifier = await deriveAuthVerifier(masterKey);
    const wrappingKey = await deriveWrappingKey(masterKey);
    const vaultBytes = generateVaultKeyBytes();
    const protectedKey = await wrapVaultKey(wrappingKey, vaultBytes);
    const vaultKey = await importVaultKey(vaultBytes);
    const enc = (s: string) => encryptString(vaultKey, s);
    const dec = (s: string) => decryptString(vaultKey, s);

    await req('POST', '/api/auth/register', {
        email,
        name: 'Vault',
        kdf_type: DEFAULT_KDF_PARAMS.type,
        kdf_memory: DEFAULT_KDF_PARAMS.memory,
        kdf_iterations: DEFAULT_KDF_PARAMS.iterations,
        kdf_parallelism: DEFAULT_KDF_PARAMS.parallelism,
        kdf_salt: salt,
        verifier,
        protected_key: protectedKey,
    });

    // Carpeta + etiqueta
    const folder = await (await req('POST', '/api/folders', { name: await enc('Trabajo') })).json();
    const tag = await (await req('POST', '/api/tags', { name: await enc('importante'), color: '#ef4444' })).json();

    // Entrada con campo personalizado protegido + etiqueta + carpeta
    const created = await (
        await req('POST', '/api/entries', {
            type: 1,
            folder_id: folder.data.id,
            title: await enc('GitHub'),
            username: await enc('pablo'),
            password: await enc('s3cr3t-p4ss'),
            url: await enc('https://github.com'),
            notes: null,
            favorite: true,
            custom_fields: [
                { label: await enc('PIN'), value: await enc('1234'), type: 2, protected: true, position: 0 },
            ],
            tag_ids: [tag.data.id],
        })
    ).json();
    console.log('crear entrada →', created.data ? 'OK' : JSON.stringify(created));

    // Releer la bóveda y descifrar
    const vault = await (await req('GET', '/api/vault')).json();
    const e = vault.entries[0];
    const checks = {
        title: (await dec(e.title)) === 'GitHub',
        username: (await dec(e.username)) === 'pablo',
        password: (await dec(e.password)) === 's3cr3t-p4ss',
        url: (await dec(e.url)) === 'https://github.com',
        favorite: e.favorite === true,
        folder: (await dec(vault.folders[0].name)) === 'Trabajo',
        tag: (await dec(vault.tags[0].name)) === 'importante',
        customField: (await dec(e.custom_fields[0].label)) === 'PIN' && (await dec(e.custom_fields[0].value)) === '1234',
        tagLink: e.tag_ids[0] === tag.data.id,
    };
    console.log('round-trip de la bóveda:', checks);
    console.log('TODO OK →', Object.values(checks).every(Boolean));
    console.log('\nEMAIL:', email, '| ENTRY ID:', created.data?.id);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
