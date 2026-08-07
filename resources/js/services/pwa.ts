import { computed, ref } from 'vue';

/**
 * Estado de instalación de la PWA.
 *
 * El navegador dispara `beforeinstallprompt` cuando la app es instalable
 * (manifest válido + service worker + contexto seguro) y todavía NO está
 * instalada. Guardamos ese evento para poder disparar el prompt cuando el
 * usuario toque "Instalar app". En iOS Safari este evento no existe: ahí la
 * instalación es manual (Compartir → Agregar a inicio), así que el botón no
 * aparecerá.
 */
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);
const installed = ref(false);

function isStandalone(): boolean {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        // iOS (Safari) expone esto cuando corre como app instalada.
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Evita el mini-infobar del navegador; lo disparamos nosotros.
    deferredPrompt.value = e as BeforeInstallPromptEvent;
});

window.addEventListener('appinstalled', () => {
    installed.value = true;
    deferredPrompt.value = null;
});

/** Registra el service worker (llamar una vez, desde el entry de la app). */
export function registerServiceWorker(): void {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(() => {
                /* si falla, la app sigue funcionando sin PWA */
            });
        });
    }
}

export function usePwaInstall() {
    const canInstall = computed(() => !!deferredPrompt.value && !installed.value && !isStandalone());

    async function install(): Promise<void> {
        const e = deferredPrompt.value;
        if (!e) return;
        await e.prompt();
        try {
            await e.userChoice;
        } catch {
            /* el usuario cerró el prompt */
        }
        // El evento solo puede usarse una vez.
        deferredPrompt.value = null;
    }

    return { canInstall, install };
}
