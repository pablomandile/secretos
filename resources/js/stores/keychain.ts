import { defineStore } from 'pinia';
import { computed, shallowRef } from 'vue';

import { decryptString, encryptString } from '@/crypto/cipher';
import { zero } from '@/crypto/encoding';
import { deriveMasterKey, type KdfParams } from '@/crypto/kdf';
import { deriveWrappingKey, unwrapVaultKey } from '@/crypto/keys';

/**
 * Núcleo de seguridad: custodia la vaultKey (CryptoKey no extraíble) SOLO en
 * memoria. Nunca se persiste. `lock()` la descarta; tras eso la bóveda no se
 * puede leer hasta re-derivarla desde la contraseña maestra.
 */
export const useKeychainStore = defineStore('keychain', () => {
    // shallowRef: el CryptoKey no debe envolverse en un proxy reactivo.
    const vaultKey = shallowRef<CryptoKey | null>(null);

    const isLocked = computed(() => vaultKey.value === null);

    function setVaultKey(key: CryptoKey): void {
        vaultKey.value = key;
    }

    /**
     * Desbloqueo local: deriva la masterKey con Argon2id y desenvuelve la
     * vaultKey. Una contraseña incorrecta produce un fallo de tag GCM → throw.
     */
    async function unlock(
        password: string,
        kdf: KdfParams,
        salt: string,
        protectedKey: string,
    ): Promise<void> {
        const masterKey = await deriveMasterKey(password, salt, kdf);
        try {
            const wrappingKey = await deriveWrappingKey(masterKey);
            vaultKey.value = await unwrapVaultKey(wrappingKey, protectedKey);
        } finally {
            zero(masterKey);
        }
    }

    function lock(): void {
        vaultKey.value = null;
    }

    function requireKey(): CryptoKey {
        if (!vaultKey.value) {
            throw new Error('La bóveda está bloqueada');
        }
        return vaultKey.value;
    }

    function encrypt(plaintext: string): Promise<string> {
        return encryptString(requireKey(), plaintext);
    }

    function decrypt(cipherString: string): Promise<string> {
        return decryptString(requireKey(), cipherString);
    }

    return { vaultKey, isLocked, setVaultKey, unlock, lock, encrypt, decrypt };
});
