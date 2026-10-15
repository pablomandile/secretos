import { readonly, ref } from 'vue';

/**
 * Estado de conexión para el uso sin red (solo lectura).
 *
 * `navigator.onLine` miente (wifi sin internet), así que se combinan señales:
 *  - eventos online/offline del navegador,
 *  - el service worker marca con `X-Sin-Conexion` las respuestas que salieron de
 *    la copia guardada (ver interceptor en api.ts),
 *  - un pedido que falla por red,
 *  - y mientras se está sin conexión, una sonda HEAD /up cada 30 s: sin ella, si el
 *    teléfono nunca "creyó" perder la red, el aviso no se iría solo al volver.
 */
const sinConexion = ref(typeof navigator !== 'undefined' ? !navigator.onLine : false);
const datosDe = ref<string | null>(null); // ISO de cuándo se guardó lo que se está mostrando

const PROBE_MS = 30_000;
let probe: number | undefined;
const reconnectHandlers: Array<() => void> = [];

function startProbe(): void {
    if (probe !== undefined) return;
    probe = window.setInterval(async () => {
        try {
            const res = await fetch('/up', { method: 'HEAD', cache: 'no-store' });
            if (res.ok) marcarConexion();
        } catch {
            /* sigue sin red */
        }
    }, PROBE_MS);
}

function stopProbe(): void {
    if (probe === undefined) return;
    window.clearInterval(probe);
    probe = undefined;
}

/** Hay red de verdad (una respuesta del servidor, o la sonda). */
export function marcarConexion(): void {
    const wasOffline = sinConexion.value;
    sinConexion.value = false;
    datosDe.value = null;
    stopProbe();
    if (wasOffline) reconnectHandlers.forEach((h) => h());
}

/** No hay red: la pantalla está mostrando (o va a mostrar) lo guardado. */
export function marcarSinConexion(guardadoEn: string | null = null): void {
    sinConexion.value = true;
    if (guardadoEn) datosDe.value = guardadoEn;
    startProbe();
}

/** Registra qué hacer cuando vuelve la conexión (p. ej. recargar la bóveda). */
export function alVolverLaConexion(handler: () => void): void {
    reconnectHandlers.push(handler);
}

/** Le pide al service worker que borre lo guardado de la API (logout, otro usuario). */
export function borrarDatosGuardados(): void {
    try {
        navigator.serviceWorker?.controller?.postMessage('borrar-datos');
    } catch {
        /* sin service worker */
    }
}

/** Le pide al service worker que (re)guarde el shell y el bundle. */
export function guardarParaSinConexion(): void {
    try {
        navigator.serviceWorker?.controller?.postMessage('guardar-shell');
    } catch {
        /* sin service worker */
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('offline', () => marcarSinConexion());
    window.addEventListener('online', () => {
        // El evento no garantiza internet: confirmar con la sonda antes de avisar.
        fetch('/up', { method: 'HEAD', cache: 'no-store' })
            .then((res) => res.ok && marcarConexion())
            .catch(() => marcarSinConexion());
    });
    if (sinConexion.value) startProbe();
}

export const estaSinConexion = readonly(sinConexion);
export const guardadoEn = readonly(datosDe);
