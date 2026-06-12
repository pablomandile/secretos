import { describe, expect, it } from 'vitest';

import { fromBase64, toBase64, utf8Decode, utf8Encode, zero } from './encoding';
import {
    decryptBytes,
    decryptString,
    encryptBytes,
    encryptString,
    isCipherString,
    parseCipherString,
} from './cipher';
import { deriveMasterKey, type KdfParams } from './kdf';
import {
    deriveAuthVerifier,
    deriveWrappingKey,
    generateVaultKeyBytes,
    importVaultKey,
    unwrapVaultKey,
    wrapVaultKey,
} from './keys';
import { buildCharset, generatePassword, type GeneratorOptions } from './generator';

// Parámetros baratos para que la suite corra rápido (Argon2id real es lento).
const TEST_KDF: KdfParams = { type: 1, memory: 8192, iterations: 1, parallelism: 1 };
const SALT_A = toBase64(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]));
const SALT_B = toBase64(new Uint8Array([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]));

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

describe('encoding', () => {
    it('base64 ida y vuelta', () => {
        const bytes = new Uint8Array([0, 1, 2, 250, 251, 255]);
        expect([...fromBase64(toBase64(bytes))]).toEqual([...bytes]);
    });

    it('utf-8 ida y vuelta con acentos', () => {
        const text = 'contraseña ñ €';
        expect(utf8Decode(utf8Encode(text))).toBe(text);
    });

    it('zero sobrescribe el buffer', () => {
        const b = new Uint8Array([9, 9, 9]);
        zero(b);
        expect([...b]).toEqual([0, 0, 0]);
    });
});

describe('cipher (AES-256-GCM)', () => {
    it('round-trip de string', async () => {
        const key = await importAesKey(generateVaultKeyBytes());
        const cs = await encryptString(key, 'hola mundo');
        expect(isCipherString(cs)).toBe(true);
        expect(await decryptString(key, cs)).toBe('hola mundo');
    });

    it('round-trip de string vacío', async () => {
        const key = await importAesKey(generateVaultKeyBytes());
        const cs = await encryptString(key, '');
        expect(await decryptString(key, cs)).toBe('');
    });

    it('cada cifrado usa un IV distinto', async () => {
        const key = await importAesKey(generateVaultKeyBytes());
        const a = await encryptString(key, 'igual');
        const b = await encryptString(key, 'igual');
        expect(a).not.toBe(b);
        expect(parseCipherString(a).iv).not.toEqual(parseCipherString(b).iv);
    });

    it('falla al descifrar con clave incorrecta', async () => {
        const k1 = await importAesKey(generateVaultKeyBytes());
        const k2 = await importAesKey(generateVaultKeyBytes());
        const cs = await encryptString(k1, 'secreto');
        await expect(decryptString(k2, cs)).rejects.toThrow();
    });

    it('falla si el ciphertext fue manipulado (tag GCM)', async () => {
        const key = await importAesKey(generateVaultKeyBytes());
        const cs = await encryptBytes(key, utf8Encode('intacto'));
        const { version, iv, ct } = parseCipherString(cs);
        ct[0] ^= 0xff; // flip de un bit
        const tampered = `${version}.${toBase64(iv)}.${toBase64(ct)}`;
        await expect(decryptBytes(key, tampered)).rejects.toThrow();
    });

    it('rechaza versión desconocida y formato inválido', () => {
        expect(() => parseCipherString('v2.aaa.bbb')).toThrow(/no soportada/);
        expect(() => parseCipherString('no-es-un-cipher')).toThrow(/inválido/);
        expect(isCipherString('v1.abc.def')).toBe(true);
        expect(isCipherString('texto plano')).toBe(false);
    });
});

describe('kdf (Argon2id)', () => {
    it('es determinístico para misma contraseña y salt', async () => {
        const a = await deriveMasterKey('clave-maestra', SALT_A, TEST_KDF);
        const b = await deriveMasterKey('clave-maestra', SALT_A, TEST_KDF);
        expect(a.length).toBe(32);
        expect([...a]).toEqual([...b]);
    });

    it('cambia con distinto salt', async () => {
        const a = await deriveMasterKey('clave-maestra', SALT_A, TEST_KDF);
        const b = await deriveMasterKey('clave-maestra', SALT_B, TEST_KDF);
        expect([...a]).not.toEqual([...b]);
    });

    it('cambia con distinta contraseña', async () => {
        const a = await deriveMasterKey('clave-uno', SALT_A, TEST_KDF);
        const b = await deriveMasterKey('clave-dos', SALT_A, TEST_KDF);
        expect([...a]).not.toEqual([...b]);
    });

    it('rechaza tipo de KDF no soportado', async () => {
        await expect(deriveMasterKey('x', SALT_A, { ...TEST_KDF, type: 99 })).rejects.toThrow();
    });
});

describe('keys (jerarquía y separación de dominio)', () => {
    it('verifier es determinístico', async () => {
        const mk = await deriveMasterKey('clave', SALT_A, TEST_KDF);
        expect(await deriveAuthVerifier(mk)).toBe(await deriveAuthVerifier(mk));
    });

    it('verifier ≠ material de wrappingKey (separación HKDF)', async () => {
        const mk = await deriveMasterKey('clave', SALT_A, TEST_KDF);
        const verifier = fromBase64(await deriveAuthVerifier(mk));
        // La wrappingKey no es extraíble; comparamos cifrando un valor conocido:
        // si compartieran material, el verifier (como clave) descifraría lo que
        // cifró la wrappingKey. Verificamos que NO ocurre.
        const wrap = await deriveWrappingKey(mk);
        const blob = await encryptBytes(wrap, utf8Encode('x'));
        const verifierAsKey = await importAesKey(verifier);
        await expect(decryptBytes(verifierAsKey, blob)).rejects.toThrow();
    });

    it('envuelve y desenvuelve la vaultKey', async () => {
        const mk = await deriveMasterKey('clave', SALT_A, TEST_KDF);
        const wrap = await deriveWrappingKey(mk);
        const vaultBytes = generateVaultKeyBytes();
        const protectedKey = await wrapVaultKey(wrap, vaultBytes);
        expect(isCipherString(protectedKey)).toBe(true);

        const vaultKey = await unwrapVaultKey(wrap, protectedKey);
        // La vaultKey desenvuelta debe poder descifrar lo que cifra la original.
        const original = await importVaultKey(vaultBytes);
        const cs = await encryptString(original, 'item');
        expect(await decryptString(vaultKey, cs)).toBe('item');
    });

    it('desenvolver con contraseña incorrecta lanza error', async () => {
        const mkGood = await deriveMasterKey('correcta', SALT_A, TEST_KDF);
        const mkBad = await deriveMasterKey('incorrecta', SALT_A, TEST_KDF);
        const protectedKey = await wrapVaultKey(await deriveWrappingKey(mkGood), generateVaultKeyBytes());
        await expect(unwrapVaultKey(await deriveWrappingKey(mkBad), protectedKey)).rejects.toThrow();
    });
});

describe('ceremonia completa (registro → desbloqueo → item)', () => {
    it('flujo end-to-end', async () => {
        const password = 'Una-Clave-Maestra-Larga!';
        // Registro
        const mk = await deriveMasterKey(password, SALT_A, TEST_KDF);
        const verifier = await deriveAuthVerifier(mk);
        const wrap = await deriveWrappingKey(mk);
        const vaultBytes = generateVaultKeyBytes();
        const protectedKey = await wrapVaultKey(wrap, vaultBytes);
        const vaultKey = await importVaultKey(vaultBytes);
        const titleCs = await encryptString(vaultKey, 'GitHub');

        // Login en otra sesión: solo tenemos password + (del servidor) salt y protectedKey
        const mk2 = await deriveMasterKey(password, SALT_A, TEST_KDF);
        expect(await deriveAuthVerifier(mk2)).toBe(verifier); // el servidor valida esto
        const wrap2 = await deriveWrappingKey(mk2);
        const vaultKey2 = await unwrapVaultKey(wrap2, protectedKey);
        expect(await decryptString(vaultKey2, titleCs)).toBe('GitHub');
    });
});

describe('generador de contraseñas', () => {
    const base: GeneratorOptions = {
        length: 32,
        uppercase: true,
        lowercase: true,
        digits: true,
        symbols: true,
        excludeAmbiguous: false,
    };

    it('respeta la longitud', () => {
        expect(generatePassword({ ...base, length: 16 }).length).toBe(16);
        expect(generatePassword({ ...base, length: 64 }).length).toBe(64);
    });

    it('solo dígitos cuando se selecciona solo dígitos', () => {
        const pw = generatePassword({ ...base, uppercase: false, lowercase: false, symbols: false });
        expect(pw).toMatch(/^[0-9]+$/);
    });

    it('excluye caracteres ambiguos', () => {
        const charset = buildCharset({ ...base, excludeAmbiguous: true });
        for (const ch of 'O0Il1|') {
            expect(charset).not.toContain(ch);
        }
    });

    it('lanza error sin conjuntos seleccionados', () => {
        expect(() =>
            generatePassword({
                length: 10,
                uppercase: false,
                lowercase: false,
                digits: false,
                symbols: false,
                excludeAmbiguous: false,
            }),
        ).toThrow();
    });

    it('lanza error con longitud inválida', () => {
        expect(() => generatePassword({ ...base, length: 0 })).toThrow();
    });

    it('usa todo el charset en una muestra grande (sin caracteres fuera de él)', () => {
        const opts: GeneratorOptions = { ...base, length: 2000 };
        const charset = new Set(buildCharset(opts));
        for (const ch of generatePassword(opts)) {
            expect(charset.has(ch)).toBe(true);
        }
    });
});
