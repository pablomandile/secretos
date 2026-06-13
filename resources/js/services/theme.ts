import { useDark, useToggle } from '@vueuse/core';

/**
 * Tema claro/oscuro. Aplica la clase `app-dark` en <html> (la usan PrimeVue y
 * Tailwind), persiste la preferencia en localStorage y por defecto sigue la del
 * sistema. La preferencia de tema no es sensible, así que localStorage está bien.
 */
export const isDark = useDark({
    selector: 'html',
    valueDark: 'app-dark',
    valueLight: '',
    storageKey: 'secretos-theme',
});

export const toggleDark = useToggle(isDark);
