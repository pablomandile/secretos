import { watch } from 'vue';
import { useEventListener, useIdle, useTimestamp } from '@vueuse/core';

import { useAuthStore } from '@/stores/auth';
import { useKeychainStore } from '@/stores/keychain';
import router from '@/router';

/**
 * Auto-bloqueo por inactividad. Bloquea la bóveda tras `auto_lock_minutes` sin
 * actividad. Además chequea al volver de visibilidad oculta (la laptop pudo
 * dormir: los timers no corren suspendidos, así que verificamos en el wake).
 */
export function useAutoLock(): void {
    const keychain = useKeychainStore();
    const auth = useAuthStore();

    const { lastActive } = useIdle(60_000); // solo nos interesa lastActive
    const now = useTimestamp({ interval: 5_000 });

    const timeoutMs = () => (auth.user?.auto_lock_minutes ?? 5) * 60_000;

    function maybeLock(reference: number): void {
        if (!keychain.isLocked && auth.isAuthenticated && reference - lastActive.value >= timeoutMs()) {
            keychain.lock();
            router.push({ name: 'unlock' });
        }
    }

    watch(now, (value) => maybeLock(value));

    useEventListener(document, 'visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            maybeLock(Date.now());
        }
    });
}
