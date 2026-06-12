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
        register,
        login,
        fetchSession,
        unlock,
        logout,
        handleUnauthorized,
    };
});
