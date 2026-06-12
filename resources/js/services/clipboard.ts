import { useToast } from 'primevue/usetoast';

const CLEAR_AFTER_MS = 30_000;

/**
 * Copia un secreto al portapapeles y lo limpia a los 30s (best-effort: si el
 * navegador permite readText, solo borra si el valor sigue siendo el mismo;
 * si no, sobrescribe igual). Igual que la bóveda web de Bitwarden.
 */
export function useSecretClipboard() {
    const toast = useToast();

    async function copy(value: string, label = 'Copiado'): Promise<void> {
        if (!value) return;
        await navigator.clipboard.writeText(value);
        toast.add({
            severity: 'success',
            summary: label,
            detail: 'Se limpiará del portapapeles en 30 s',
            life: 3000,
        });

        setTimeout(async () => {
            try {
                const current = await navigator.clipboard.readText();
                if (current === value) {
                    await navigator.clipboard.writeText('');
                }
            } catch {
                // readText bloqueado: sobrescribimos igualmente.
                try {
                    await navigator.clipboard.writeText('');
                } catch {
                    /* sin permisos: nada que hacer */
                }
            }
        }, CLEAR_AFTER_MS);
    }

    return { copy };
}
