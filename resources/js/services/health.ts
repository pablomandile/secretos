import { estimateStrength } from '@/crypto/strength';
import type { DecryptedEntry } from '@/stores/vault';

/**
 * Análisis de salud de la bóveda, 100% en el cliente sobre los datos descifrados:
 * contraseñas débiles (zxcvbn score < 3), repetidas (mismo valor en varias
 * entradas) y entradas sin contraseña. El score se calcula solo sobre las
 * entradas que tienen contraseña.
 */

export interface HealthEntryRef {
    id: string;
    title: string;
}

export interface WeakItem extends HealthEntryRef {
    score: 0 | 1 | 2 | 3 | 4;
}

export interface ReuseGroup {
    count: number;
    entries: HealthEntryRef[];
}

export interface HealthReport {
    total: number;
    withPassword: number;
    score: number; // 0-100
    weak: WeakItem[];
    reused: ReuseGroup[];
    empty: HealthEntryRef[];
}

/** Devuelve el score de fortaleza 0-4 de una contraseña. */
export type StrengthFn = (password: string) => Promise<number>;

const ref = (e: DecryptedEntry): HealthEntryRef => ({ id: e.id, title: e.title });

const defaultEstimate: StrengthFn = async (password) => (await estimateStrength(password)).score;

export async function analyzeVault(
    entries: DecryptedEntry[],
    options: { estimate?: StrengthFn; onProgress?: (done: number, total: number) => void } = {},
): Promise<HealthReport> {
    const estimate = options.estimate ?? defaultEstimate;
    const onProgress = options.onProgress;
    const withPassword = entries.filter((e) => e.password);
    const empty = entries.filter((e) => !e.password).map(ref);

    // Repetidas: agrupar por valor de contraseña (sin exponerlo).
    const byPassword = new Map<string, DecryptedEntry[]>();
    for (const e of withPassword) {
        const group = byPassword.get(e.password) ?? [];
        group.push(e);
        byPassword.set(e.password, group);
    }
    const reused: ReuseGroup[] = [...byPassword.values()]
        .filter((g) => g.length > 1)
        .map((g) => ({ count: g.length, entries: g.map(ref) }))
        .sort((a, b) => b.count - a.count);

    // Débiles: zxcvbn por entrada, en lotes para no congelar la UI.
    const weak: WeakItem[] = [];
    const total = withPassword.length;
    for (let i = 0; i < total; i++) {
        const e = withPassword[i];
        const score = await estimate(e.password);
        if (score < 3) {
            weak.push({ ...ref(e), score: score as WeakItem['score'] });
        }
        if ((i + 1) % 25 === 0 || i + 1 === total) {
            onProgress?.(i + 1, total);
            await new Promise((r) => setTimeout(r, 0)); // cede el hilo a la UI
        }
    }
    weak.sort((a, b) => a.score - b.score);

    // Score: % de entradas con contraseña que no son ni débiles ni repetidas.
    const problematic = new Set<string>();
    weak.forEach((w) => problematic.add(w.id));
    reused.forEach((g) => g.entries.forEach((e) => problematic.add(e.id)));
    const score = total === 0 ? 100 : Math.round((100 * (total - problematic.size)) / total);

    return { total: entries.length, withPassword: total, score, weak, reused, empty };
}
