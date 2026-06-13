import { useDark, useToggle } from '@vueuse/core';

/**
 * Tema claro/oscuro. Aplica la clase `app-dark` en <html> (la usan PrimeVue y
 * Tailwind) y persiste la preferencia en localStorage. Por defecto arranca CLARO
 * (initialValue: 'light'), ignorando el tema del sistema; si el usuario lo cambia
 * a mano, queda guardado y se recuerda en la próxima sesión. La preferencia de
 * tema no es sensible, así que localStorage está bien.
 */
export const isDark = useDark({
    selector: 'html',
    valueDark: 'app-dark',
    valueLight: '',
    // Clave v2: ignora cualquier preferencia 'auto' guardada por la versión previa
    // que seguía al sistema, garantizando el nuevo default claro.
    storageKey: 'secretos-theme-v2',
    initialValue: 'light',
});

export const toggleDark = useToggle(isDark);
