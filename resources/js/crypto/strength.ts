/**
 * Medidor de fortaleza de contraseñas (zxcvbn-ts v4).
 *
 * Los diccionarios pesan cientos de KB; se cargan de forma diferida (dynamic
 * import) y el factory se construye una sola vez.
 */

import type { ZxcvbnFactory } from '@zxcvbn-ts/core';

let factory: ZxcvbnFactory | null = null;

async function getFactory(): Promise<ZxcvbnFactory> {
    if (factory) return factory;
    const [core, common, en] = await Promise.all([
        import('@zxcvbn-ts/core'),
        import('@zxcvbn-ts/language-common'),
        import('@zxcvbn-ts/language-en'),
    ]);
    factory = new core.ZxcvbnFactory({
        dictionary: { ...common.dictionary, ...en.dictionary },
        graphs: common.adjacencyGraphs,
        translations: en.translations,
    });
    return factory;
}

export interface StrengthResult {
    score: 0 | 1 | 2 | 3 | 4;
    warning: string;
    suggestions: string[];
    crackTimeDisplay: string;
}

export async function estimateStrength(password: string): Promise<StrengthResult> {
    const zxcvbn = await getFactory();
    const result = zxcvbn.check(password);
    return {
        score: result.score,
        warning: result.feedback.warning ?? '',
        suggestions: result.feedback.suggestions ?? [],
        crackTimeDisplay: String(result.crackTimes.offlineSlowHashingXPerSecond),
    };
}
