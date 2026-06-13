import { describe, expect, it } from 'vitest';

import {
    base32Decode,
    generateTotp,
    normalizeTotpInput,
    parseOtpauth,
    totpRemaining,
} from './totp';

// Seed del RFC 6238 ("12345678901234567890" ASCII) en base32.
const SEED32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('base32Decode', () => {
    it('decodifica el seed del RFC a los 20 bytes ASCII', () => {
        const bytes = base32Decode(SEED32);
        const expected = new TextEncoder().encode('12345678901234567890');
        expect([...bytes]).toEqual([...expected]);
    });

    it('rechaza caracteres inválidos', () => {
        expect(() => base32Decode('0189!')).toThrow();
    });
});

describe('generateTotp (vectores RFC 6238, SHA-1, 8 dígitos)', () => {
    const vectors: [number, string][] = [
        [59, '94287082'],
        [1111111109, '07081804'],
        [1111111111, '14050471'],
        [1234567890, '89005924'],
        [2000000000, '69279037'],
        [20000000000, '65353130'],
    ];

    it.each(vectors)('T=%i → %s', async (seconds, expected) => {
        const code = await generateTotp(SEED32, {
            timestamp: seconds * 1000,
            period: 30,
            digits: 8,
            algorithm: 'SHA-1',
        });
        expect(code).toBe(expected);
    });

    it('produce 6 dígitos por defecto', async () => {
        const code = await generateTotp(SEED32, { timestamp: 59000 });
        expect(code).toMatch(/^\d{6}$/);
    });
});

describe('totpRemaining', () => {
    it('calcula los segundos restantes del paso', () => {
        expect(totpRemaining(30, 59_000)).toBe(1); // 30 - (59 % 30)
        expect(totpRemaining(30, 30_000)).toBe(30); // 30 - 0
    });
});

describe('parseOtpauth', () => {
    it('parsea un URI otpauth completo', () => {
        const cfg = parseOtpauth(
            'otpauth://totp/GitHub:pablo?secret=GEZDGNBVGY3TQOJQ&issuer=GitHub&digits=8&period=60&algorithm=SHA256',
        );
        expect(cfg.secret).toBe('GEZDGNBVGY3TQOJQ');
        expect(cfg.digits).toBe(8);
        expect(cfg.period).toBe(60);
        expect(cfg.algorithm).toBe('SHA-256');
        expect(cfg.issuer).toBe('GitHub');
        expect(cfg.label).toBe('GitHub:pablo');
    });

    it('rechaza un URI que no es otpauth', () => {
        expect(() => parseOtpauth('https://example.com')).toThrow();
    });
});

describe('normalizeTotpInput', () => {
    it('acepta un secreto base32 pelado con defaults', () => {
        const cfg = normalizeTotpInput('GEZD GNBV GY3T QOJQ');
        expect(cfg.secret).toBe('GEZDGNBVGY3TQOJQ');
        expect(cfg.digits).toBe(6);
        expect(cfg.period).toBe(30);
        expect(cfg.algorithm).toBe('SHA-1');
    });

    it('delega en parseOtpauth si es un URI', () => {
        const cfg = normalizeTotpInput('otpauth://totp/x?secret=ABCDEF&period=45');
        expect(cfg.secret).toBe('ABCDEF');
        expect(cfg.period).toBe(45);
    });
});
