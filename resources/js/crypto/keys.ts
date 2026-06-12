/**
 * Jerarquía de claves (estilo Bitwarden).
 *
 *   masterKey (Argon2id, ver kdf.ts)
 *     ├─ HKDF info="secretos/v1/auth" → verifier  (se envía al servidor)
 *     └─ HKDF info="secretos/v1/wrap" → wrappingKey (solo en memoria)
 *   vaultKey (32B aleatorios) ── envuelta con wrappingKey → protected_key
 *
 * La separación de dominio por `info` hace que verifier y wrappingKey sean
 * computacionalmente independientes: conocer uno no revela el otro.
 */

import { decryptBytes, encryptBytes } from './cipher';
import { toBase64, utf8Encode, zero } from './encoding';

const HKDF_HASH = 'SHA-256';
const VAULT_KEY_BYTES = 32;
const INFO_AUTH = 'secretos/v1/auth';
const INFO_WRAP = 'secretos/v1/wrap';

async function importHkdfKey(masterKey: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', masterKey, 'HKDF', false, ['deriveBits', 'deriveKey']);
}

/** Verifier de autenticación (base64 de 32B). El servidor lo re-hashea con Hash::make. */
export async function deriveAuthVerifier(masterKey: Uint8Array): Promise<string> {
    const hkdf = await importHkdfKey(masterKey);
    const bits = await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: HKDF_HASH, salt: new Uint8Array(0), info: utf8Encode(INFO_AUTH) },
        hkdf,
        256,
    );
    return toBase64(new Uint8Array(bits));
}

/** Clave AES-GCM no extraíble usada solo para envolver/desenvolver la vaultKey. */
export async function deriveWrappingKey(masterKey: Uint8Array): Promise<CryptoKey> {
    const hkdf = await importHkdfKey(masterKey);
    return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: HKDF_HASH, salt: new Uint8Array(0), info: utf8Encode(INFO_WRAP) },
        hkdf,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
}

export function generateVaultKeyBytes(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(VAULT_KEY_BYTES));
}

/** Importa la vaultKey como CryptoKey NO extraíble (no se puede volver a leer en claro). */
export async function importVaultKey(raw: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Envuelve la vaultKey con la wrappingKey → blob `protected_key` para el servidor. */
export function wrapVaultKey(wrappingKey: CryptoKey, vaultKeyBytes: Uint8Array): Promise<string> {
    return encryptBytes(wrappingKey, vaultKeyBytes);
}

/**
 * Desenvuelve `protected_key`. Una contraseña incorrecta produce wrappingKey
 * incorrecta → fallo del tag GCM → throw (así se valida la clave sin el servidor).
 */
export async function unwrapVaultKey(wrappingKey: CryptoKey, protectedKey: string): Promise<CryptoKey> {
    const raw = await decryptBytes(wrappingKey, protectedKey);
    try {
        return await importVaultKey(raw);
    } finally {
        zero(raw);
    }
}
