/**
 * Medidor de fortaleza de contraseñas (zxcvbn-ts).
 *
 * Los diccionarios pesan ~cientos de KB; se cargan de forma diferida (dynamic
 * import) y se configuran una sola vez.
 */

let configured = false;

async function ensureConfigured(): Promise<void> {
    if (configured) return;
    const [core, common, en] = await Promise.all([
        import('@zxcvbn-ts/core'),
        import('@zxcvbn-ts/language-common'),
        import('@zxcvbn-ts/language-en'),
    ]);
    core.zxcvbnOptions.setOptions({
        dictionary: { ...common.dictionary, ...en.dictionary },
        graphs: common.adjacencyGraphs,
        translations: en.translations,
    });
    configured = true;
}

export interface StrengthResult {
    score: 0 | 1 | 2 | 3 | 4;
    warning: string;
    suggestions: string[];
    crackTimeDisplay: string;
}

export async function estimateStrength(password: string): Promise<StrengthResult> {
    await ensureConfigured();
    const core = await import('@zxcvbn-ts/core');
    const result = core.zxcvbn(password);
    return {
        score: result.score as StrengthResult['score'],
        warning: result.feedback.warning ?? '',
        suggestions: result.feedback.suggestions ?? [],
        crackTimeDisplay: String(result.crackTimesDisplay.offlineSlowHashing1e4PerSecond),
    };
}
