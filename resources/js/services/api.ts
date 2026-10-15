import axios from 'axios';
import ToastEventBus from 'primevue/toasteventbus';

import { marcarConexion, marcarSinConexion } from '@/services/conexion';

/**
 * Cliente axios para la API. Usa cookies de sesión Sanctum (withCredentials)
 * y el patrón XSRF: primero se pide la cookie CSRF, luego axios reenvía el
 * token automáticamente en cada request mutante.
 */
const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
    withXSRFToken: true,
    headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
});

let csrfReady = false;

/** Garantiza que tenemos la cookie XSRF-TOKEN antes del primer POST. */
export async function ensureCsrfCookie(): Promise<void> {
    if (csrfReady) return;
    await axios.get('/sanctum/csrf-cookie', { withCredentials: true });
    csrfReady = true;
}

/**
 * Hook de 401: cuando la sesión expira, se invoca para bloquear y redirigir.
 * Lo setea el store de auth para evitar dependencias circulares.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void): void {
    onUnauthorized = handler;
}

/**
 * El sondeo de sesión al arrancar contesta 401 cuando simplemente no hay sesión:
 * es una respuesta esperada, no una sesión que murió, así que no dispara el hook
 * (si no, las páginas públicas rebotarían al login).
 */
const SESSION_PROBE = '/auth/session';

api.interceptors.response.use(
    (response) => {
        // El service worker marca con X-Sin-Conexion lo que salió de la copia guardada.
        if (response.headers['x-sin-conexion']) {
            marcarSinConexion((response.headers['x-guardado-en'] as string | undefined) ?? null);
        } else {
            marcarConexion();
        }
        return response;
    },
    (error) => {
        if (error.response?.status === 401) {
            csrfReady = false;
            if (error.config?.url !== SESSION_PROBE) onUnauthorized?.();
        }
        const method = String(error.config?.method ?? 'get').toLowerCase();
        if (!error.response) {
            // Falló por red: nada llegó al servidor.
            marcarSinConexion();
            if (method !== 'get') {
                ToastEventBus.emit('add', {
                    severity: 'warn',
                    summary: 'Sin conexión',
                    detail: 'Esta acción necesita conexión. Sin red la bóveda es de solo lectura.',
                    life: 5000,
                });
            }
        } else if (error.response.headers?.['x-sin-conexion']) {
            // 503 propio del SW: pantalla que nunca se guardó.
            marcarSinConexion();
        }
        return Promise.reject(error);
    },
);

export default api;
