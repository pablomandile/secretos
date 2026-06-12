/**
 * Cifrado simétrico de campos con AES-256-GCM (WebCrypto).
 *
 * Formato de ciphertext autodescriptivo:
 *   v1.<base64(iv 12B)>.<base64(ciphertext||tag)>
 *
 * GCM provee cifrado autenticado: el tag detecta manipulación y, en el
 * desbloqueo, una clave incorrecta produce un fallo de tag (no hay que
 * preguntarle al servidor si la contraseña es correcta).
 */

import { fromBase64, toBase64, utf8Decode, utf8Encode } from './encoding';

export const CIPHER_VERSION = 'v1';
const IV_LENGTH = 12;

/** Valida sin descifrar que un string tiene forma de ciphertext `vN.iv.ct`. */
export function isCipherString(value: string): boolean {
    return /^v\d+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/.test(value);
}

export interface ParsedCipher {
    version: string;
    iv: Uint8Array;
    ct: Uint8Array;
}

export function parseCipherString(cipherString: string): ParsedCipher {
    const parts = cipherString.split('.');
    if (parts.length !== 3) {
        throw new Error('Formato de ciphertext inválido');
    }
    const [version, ivB64, ctB64] = parts;
    if (version !== CIPHER_VERSION) {
        throw new Error(`Versión de ciphertext no soportada: ${version}`);
    }
    return { version, iv: fromBase64(ivB64), ct: fromBase64(ctB64) };
}

export async function encryptBytes(key: CryptoKey, plaintext: Uint8Array): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const ctBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    return `${CIPHER_VERSION}.${toBase64(iv)}.${toBase64(new Uint8Array(ctBuffer))}`;
}

export async function decryptBytes(key: CryptoKey, cipherString: string): Promise<Uint8Array> {
    const { iv, ct } = parseCipherString(cipherString);
    const ptBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new Uint8Array(ptBuffer);
}

export function encryptString(key: CryptoKey, plaintext: string): Promise<string> {
    return encryptBytes(key, utf8Encode(plaintext));
}

export async function decryptString(key: CryptoKey, cipherString: string): Promise<string> {
    return utf8Decode(await decryptBytes(key, cipherString));
}
