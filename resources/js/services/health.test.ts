import { describe, expect, it } from 'vitest';

import { analyzeVault } from './health';
import type { DecryptedEntry } from '@/stores/vault';

function entry(id: string, title: string, password: string): DecryptedEntry {
    return {
        id,
        type: 1,
        folderId: null,
        title,
        username: '',
        password,
        url: '',
        notes: '',
        favorite: false,
        customFields: [],
        tagIds: [],
        createdAt: '',
        updatedAt: '',
    };
}

describe('analyzeVault', () => {
    it('detecta débiles, repetidas, vacías y calcula el score', async () => {
        const entries = [
            entry('1', 'Débil', '123456'), // débil
            entry('2', 'Repetida A', 'reused-pass-123'), // repetida (con 3)
            entry('3', 'Repetida B', 'reused-pass-123'),
            entry('4', 'Fuerte', 'x9$Kq2!vR7mZ@wL4nP'), // fuerte y única
            entry('5', 'Sin pass', ''), // sin contraseña
        ];

        // Fortaleza inyectada y determinista: '123456' es débil (0), el resto fuerte (4).
        const estimate = async (pw: string) => (pw === '123456' ? 0 : 4);
        const report = await analyzeVault(entries, { estimate });

        expect(report.total).toBe(5);
        expect(report.withPassword).toBe(4);
        expect(report.empty.map((e) => e.id)).toEqual(['5']);

        expect(report.weak.some((w) => w.id === '1')).toBe(true);

        expect(report.reused).toHaveLength(1);
        expect(report.reused[0].count).toBe(2);
        expect(report.reused[0].entries.map((e) => e.id).sort()).toEqual(['2', '3']);

        // 4 con contraseña; problemáticas: '1' (débil) + '2','3' (repetidas) = 3.
        // score = round(100 * (4 - 3) / 4) = 25.
        expect(report.score).toBe(25);
    });

    it('score 100 si no hay contraseñas para evaluar', async () => {
        const report = await analyzeVault([entry('1', 'Nota', '')]);
        expect(report.score).toBe(100);
        expect(report.withPassword).toBe(0);
    });
});
