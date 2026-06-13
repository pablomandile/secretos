import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { toBase64, zero } from '@/crypto/encoding';
import { deriveMasterKey, DEFAULT_KDF_PARAMS, type KdfParams } from '@/crypto/kdf';
import {
    deriveAuthVerifier,
    deriveWrappingKey,
    generateVaultKeyBytes,
    importVaultKey,
    unwrapVaultKey,
    wrapVaultKey,
} from '@/crypto/keys';
import { decryptBytes } from '@/crypto/cipher';
import api, { ensureCsrfCookie } from '@/services/api';
import { useKeychainStore } from '@/stores/keychain';

export interface AuthUser {
    id: number;
    email: string;
    name: string | null;
    auto_lock_minutes: number;
}

interface ServerKdf {
    kdf_type: number;
    kdf_memory: number;
    kdf_iterations: number;
    kdf_parallelism: number;
    kdf_salt: string;
}

interface SessionPayload {
    user: AuthUser;
    kdf: ServerKdf;
    protected_key: string;
    key_version: number;
}

function mapKdf(s: ServerKdf): { params: KdfParams; salt: string } {
    return {
        params: {
            type: s.kdf_type,
            memory: s.kdf_memory,
            iterations: s.kdf_iterations,
            parallelism: s.kdf_parallelism,
        },
        salt: s.kdf_salt,
    };
}

export const useAuthStore = defineStore('auth', () => {
    const keychain = useKeychainStore();

    const user = ref<AuthUser | null>(null);
    const kdfParams = ref<KdfParams | null>(null);
    const salt = ref<string | null>(null);
    const protectedKey = ref<string | null>(null);
    const ready = ref(false); // true cuando ya consultamos /session al arrancar

    const isAuthenticated = computed(() => user.value !== null);
    // Autenticado pero sin bóveda configurada (típico de una cuenta nueva vía Google).
    const needsSetup = computed(() => isAuthenticated.value && !protectedKey.value);

    function applySession(data: SessionPayload): void {
        user.value = data.user;
        const mapped = mapKdf(data.kdf);
        kdfParams.value = mapped.params;
        salt.value = mapped.salt;
        protectedKey.value = data.protected_key;
    }

    function reset(): void {
        user.value = null;
        kdfParams.value = null;
        salt.value = null;
        protectedKey.value = null;
    }

    /** Ceremonia de registro: genera la vaultKey y la envía envuelta. */
    async function register(email: string, password: string, name: string | null): Promise<void> {
        await ensureCsrfCookie();
        const newSalt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
        const kdf = DEFAULT_KDF_PARAMS;
        const masterKey = await deriveMasterKey(password, newSalt, kdf);
        try {
            const verifier = await deriveAuthVerifier(masterKey);
            const wrappingKey = await deriveWrappingKey(masterKey);
            const vaultBytes = generateVaultKeyBytes();
            const wrapped = await wrapVaultKey(wrappingKey, vaultBytes);

            const { data } = await api.post<SessionPayload>('/auth/register', {
                email,
                name,
                kdf_type: kdf.type,
                kdf_memory: kdf.memory,
                kdf_iterations: kdf.iterations,
                kdf_parallelism: kdf.parallelism,
                kdf_salt: newSalt,
                verifier,
                protected_key: wrapped,
            });

            keychain.setVaultKey(await importVaultKey(vaultBytes));
            zero(vaultBytes);
            applySession(data);
        } finally {
            zero(masterKey);
        }
    }

    /** Login en dos pasos + desbloqueo inmediato reutilizando la masterKey. */
    async function login(email: string, password: string): Promise<void> {
        await ensureCsrfCookie();
        const { data: pre } = await api.post<ServerKdf>('/auth/prelogin', { email });
        const { params, salt: loginSalt } = mapKdf(pre);
        const masterKey = await deriveMasterKey(password, loginSalt, params);
        try {
            const verifier = await deriveAuthVerifier(masterKey);
            const { data } = await api.post<SessionPayload>('/auth/login', { email, verifier });
            const wrappingKey = await deriveWrappingKey(masterKey);
            keychain.setVaultKey(await unwrapVaultKey(wrappingKey, data.protected_key));
            applySession(data);
        } finally {
            zero(masterKey);
        }
    }

    /** Al arrancar la app: ¿hay sesión viva? Si sí, falta desbloquear. */
    async function fetchSession(): Promise<void> {
        try {
            const { data } = await api.get<SessionPayload>('/auth/session');
            applySession(data);
        } catch {
            reset();
        } finally {
            ready.value = true;
        }
    }

    /** Redirige a Google (Socialite). Vuelve a /app y el router enruta a setup/unlock. */
    function loginWithGoogle(): void {
        window.location.href = '/auth/google/redirect';
    }

    /**
     * Setup de clave maestra para una cuenta sin bóveda (creada vía Google).
     * Misma ceremonia que el registro pero sobre la cuenta ya autenticada.
     */
    async function setupKey(password: string): Promise<void> {
        await ensureCsrfCookie();
        const newSalt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
        const kdf = DEFAULT_KDF_PARAMS;
        const masterKey = await deriveMasterKey(password, newSalt, kdf);
        try {
            const verifier = await deriveAuthVerifier(masterKey);
            const wrappingKey = await deriveWrappingKey(masterKey);
            const vaultBytes = generateVaultKeyBytes();
            const wrapped = await wrapVaultKey(wrappingKey, vaultBytes);

            const { data } = await api.post<SessionPayload>('/auth/setup-key', {
                kdf_type: kdf.type,
                kdf_memory: kdf.memory,
                kdf_iterations: kdf.iterations,
                kdf_parallelism: kdf.parallelism,
                kdf_salt: newSalt,
                verifier,
                protected_key: wrapped,
            });

            keychain.setVaultKey(await importVaultKey(vaultBytes));
            zero(vaultBytes);
            applySession(data);
        } finally {
            zero(masterKey);
        }
    }

    /** Desbloqueo tras refresh: re-deriva y desenvuelve con la contraseña. */
    async function unlock(password: string): Promise<void> {
        if (!kdfParams.value || !salt.value || !protectedKey.value) {
            throw new Error('Falta el contexto de sesión para desbloquear');
        }
        await keychain.unlock(password, kdfParams.value, salt.value, protectedKey.value);
    }

    async function logout(): Promise<void> {
        try {
            await api.post('/auth/logout');
        } finally {
            keychain.lock();
            reset();
        }
    }

    /**
     * Cambio de clave maestra: re-deriva con la actual, recupera la vaultKey en
     * claro, la re-envuelve bajo la clave nueva y la envía. Los items NO se
     * re-cifran (la vaultKey es la misma). La sesión actual sigue desbloqueada.
     */
    async function changeMasterPassword(currentPassword: string, newPassword: string): Promise<void> {
        if (!kdfParams.value || !salt.value || !protectedKey.value) {
            throw new Error('Falta el contexto de sesión');
        }
        const oldMaster = await deriveMasterKey(currentPassword, salt.value, kdfParams.value);
        let rawVault: Uint8Array;
        try {
            const currentVerifier = await deriveAuthVerifier(oldMaster);
            const oldWrap = await deriveWrappingKey(oldMaster);
            // Lanza si la contraseña actual es incorrecta (fallo de tag GCM).
            rawVault = await decryptBytes(oldWrap, protectedKey.value);

            const newSalt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
            const kdf = DEFAULT_KDF_PARAMS;
            const newMaster = await deriveMasterKey(newPassword, newSalt, kdf);
            try {
                const newVerifier = await deriveAuthVerifier(newMaster);
                const newWrap = await deriveWrappingKey(newMaster);
                const newProtected = await wrapVaultKey(newWrap, rawVault);

                await api.put('/account/master-password', {
                    current_verifier: currentVerifier,
                    verifier: newVerifier,
                    kdf_type: kdf.type,
                    kdf_memory: kdf.memory,
                    kdf_iterations: kdf.iterations,
                    kdf_parallelism: kdf.parallelism,
                    kdf_salt: newSalt,
                    protected_key: newProtected,
                });

                kdfParams.value = kdf;
                salt.value = newSalt;
                protectedKey.value = newProtected;
            } finally {
                zero(newMaster);
                zero(rawVault);
            }
        } finally {
            zero(oldMaster);
        }
    }

    async function updateAutoLock(minutes: number): Promise<void> {
        await api.patch('/account/preferences', { auto_lock_minutes: minutes });
        if (user.value) user.value.auto_lock_minutes = minutes;
    }

    /** Invocado por el interceptor 401: la sesión murió del lado del servidor. */
    function handleUnauthorized(): void {
        keychain.lock();
        reset();
    }

    return {
        user,
        kdfParams,
        salt,
        protectedKey,
        ready,
        isAuthenticated,
        needsSetup,
        register,
        login,
        loginWithGoogle,
        setupKey,
        fetchSession,
        unlock,
        logout,
        changeMasterPassword,
        updateAutoLock,
        handleUnauthorized,
    };
});
