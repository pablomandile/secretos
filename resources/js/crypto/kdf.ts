/**
 * Derivación de clave a partir de la contraseña maestra con Argon2id (hash-wasm).
 *
 * El resultado (32 bytes) es la `masterKey`, que NUNCA se envía al servidor:
 * de ella se derivan por separado el verifier (auth) y la wrappingKey. Ver keys.ts.
 */

import { argon2id } from 'hash-wasm';
import { fromBase64 } from './encoding';

export interface KdfParams {
    /** 1 = argon2id (único soportado hoy). */
    type: number;
    /** Memoria en KiB. */
    memory: number;
    iterations: number;
    parallelism: number;
}

export const DEFAULT_KDF_PARAMS: KdfParams = {
    type: 1,
    memory: 65536, // 64 MiB
    iterations: 3,
    parallelism: 4,
};

export const KDF_OUTPUT_BYTES = 32;

export async function deriveMasterKey(
    password: string,
    saltB64: string,
    params: KdfParams = DEFAULT_KDF_PARAMS,
): Promise<Uint8Array> {
    if (params.type !== 1) {
        throw new Error(`Tipo de KDF no soportado: ${params.type}`);
    }
    const salt = fromBase64(saltB64);
    return argon2id({
        password,
        salt,
        parallelism: params.parallelism,
        iterations: params.iterations,
        memorySize: params.memory,
        hashLength: KDF_OUTPUT_BYTES,
        outputType: 'binary',
    });
}
