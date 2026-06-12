/**
 * Generador de contraseñas con CSPRNG (crypto.getRandomValues) y muestreo por
 * rechazo para evitar el sesgo de módulo.
 */

export interface GeneratorOptions {
    length: number;
    uppercase: boolean;
    lowercase: boolean;
    digits: boolean;
    symbols: boolean;
    excludeAmbiguous: boolean;
}

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?';
const AMBIGUOUS = 'O0Il1|';

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
    length: 20,
    uppercase: true,
    lowercase: true,
    digits: true,
    symbols: true,
    excludeAmbiguous: true,
};

/** Entero uniforme en [0, maxExclusive) sin sesgo de módulo (muestreo por rechazo). */
function randomInt(maxExclusive: number): number {
    if (maxExclusive <= 0) {
        throw new Error('maxExclusive debe ser > 0');
    }
    const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
    const buf = new Uint32Array(1);
    let x: number;
    do {
        crypto.getRandomValues(buf);
        x = buf[0];
    } while (x >= limit);
    return x % maxExclusive;
}

export function buildCharset(opts: GeneratorOptions): string {
    let chars = '';
    if (opts.uppercase) chars += UPPERCASE;
    if (opts.lowercase) chars += LOWERCASE;
    if (opts.digits) chars += DIGITS;
    if (opts.symbols) chars += SYMBOLS;
    if (opts.excludeAmbiguous) {
        chars = [...chars].filter((c) => !AMBIGUOUS.includes(c)).join('');
    }
    return chars;
}

export function generatePassword(opts: GeneratorOptions): string {
    if (opts.length < 1) {
        throw new Error('La longitud debe ser ≥ 1');
    }
    const charset = buildCharset(opts);
    if (charset.length === 0) {
        throw new Error('Seleccioná al menos un conjunto de caracteres');
    }
    let out = '';
    for (let i = 0; i < opts.length; i++) {
        out += charset[randomInt(charset.length)];
    }
    return out;
}
