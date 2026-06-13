/**
 * Generación de códigos TOTP (RFC 6238) / HOTP (RFC 4226) con WebCrypto.
 *
 * El secreto es sensible: se guarda cifrado como cualquier otro campo (custom
 * field type=3). La generación del código ocurre solo en el cliente.
 */

export type TotpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

export interface OtpauthConfig {
    secret: string; // base32
    digits: number;
    period: number;
    algorithm: TotpAlgorithm;
    label: string;
    issuer: string;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input: string): Uint8Array {
    const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    const out: number[] = [];
    let bits = 0;
    let value = 0;
    for (const ch of clean) {
        const idx = BASE32_ALPHABET.indexOf(ch);
        if (idx === -1) {
            throw new Error('Secreto base32 inválido');
        }
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return new Uint8Array(out);
}

async function hmac(algorithm: TotpAlgorithm, key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: algorithm }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, message));
}

export async function generateHotp(
    secret: Uint8Array,
    counter: number,
    digits = 6,
    algorithm: TotpAlgorithm = 'SHA-1',
): Promise<string> {
    // Contador en 64 bits big-endian (división para evitar overflow de 32 bits).
    const message = new Uint8Array(8);
    let c = counter;
    for (let i = 7; i >= 0; i--) {
        message[i] = c & 0xff;
        c = Math.floor(c / 256);
    }

    const hs = await hmac(algorithm, secret, message);
    const offset = hs[hs.length - 1] & 0x0f;
    const binary =
        ((hs[offset] & 0x7f) << 24) |
        ((hs[offset + 1] & 0xff) << 16) |
        ((hs[offset + 2] & 0xff) << 8) |
        (hs[offset + 3] & 0xff);

    return (binary % 10 ** digits).toString().padStart(digits, '0');
}

export interface TotpOptions {
    timestamp?: number; // ms epoch
    period?: number;
    digits?: number;
    algorithm?: TotpAlgorithm;
}

export async function generateTotp(secretBase32: string, opts: TotpOptions = {}): Promise<string> {
    const { timestamp = Date.now(), period = 30, digits = 6, algorithm = 'SHA-1' } = opts;
    const counter = Math.floor(timestamp / 1000 / period);
    return generateHotp(base32Decode(secretBase32), counter, digits, algorithm);
}

/** Segundos restantes del paso TOTP actual. */
export function totpRemaining(period = 30, timestamp = Date.now()): number {
    return period - (Math.floor(timestamp / 1000) % period);
}

export function parseOtpauth(uri: string): OtpauthConfig {
    const url = new URL(uri);
    if (url.protocol !== 'otpauth:') {
        throw new Error('No es un URI otpauth://');
    }
    const secret = url.searchParams.get('secret');
    if (!secret) {
        throw new Error('El URI otpauth no tiene secreto');
    }
    const algoParam = (url.searchParams.get('algorithm') ?? 'SHA1').toUpperCase();
    const algorithm: TotpAlgorithm = algoParam === 'SHA256' ? 'SHA-256' : algoParam === 'SHA512' ? 'SHA-512' : 'SHA-1';

    return {
        secret,
        digits: Number(url.searchParams.get('digits') ?? 6),
        period: Number(url.searchParams.get('period') ?? 30),
        algorithm,
        issuer: url.searchParams.get('issuer') ?? '',
        label: decodeURIComponent(url.pathname.replace(/^\//, '')),
    };
}

/** Acepta un URI otpauth:// o un secreto base32 pelado y normaliza la config. */
export function normalizeTotpInput(input: string): OtpauthConfig {
    const trimmed = input.trim();
    if (trimmed.toLowerCase().startsWith('otpauth://')) {
        return parseOtpauth(trimmed);
    }
    return {
        secret: trimmed.replace(/\s+/g, ''),
        digits: 6,
        period: 30,
        algorithm: 'SHA-1',
        label: '',
        issuer: '',
    };
}
