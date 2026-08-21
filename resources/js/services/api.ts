import axios from 'axios';

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
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            csrfReady = false;
            if (error.config?.url !== SESSION_PROBE) onUnauthorized?.();
        }
        return Promise.reject(error);
    },
);

export default api;
