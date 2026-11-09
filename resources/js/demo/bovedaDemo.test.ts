import { describe, expect, it } from 'vitest';

import fixture from '../../../database/seeders/demo/boveda.json';

import { decryptString } from '@/crypto/cipher';
import { deriveMasterKey } from '@/crypto/kdf';
import { deriveAuthVerifier, deriveWrappingKey, unwrapVaultKey } from '@/crypto/keys';
import { CARPETAS_DEMO, ENTRADAS_DEMO, ETIQUETAS_DEMO, type BovedaDemoCifrada } from './bovedaDemo';

// La misma que el default de config/demo.php (DEMO_PASSWORD).
const DEMO_PASSWORD = 'demo1234';

describe('fixture de la bóveda demo', () => {
    it('se abre con la contraseña demo y coincide con el contenido en claro', async () => {
        const boveda = fixture as BovedaDemoCifrada;

        const { salt, ...params } = boveda.kdf;
        const masterKey = await deriveMasterKey(DEMO_PASSWORD, salt, params);
        expect(await deriveAuthVerifier(masterKey)).toBe(boveda.verifier);
        const key = await unwrapVaultKey(await deriveWrappingKey(masterKey), boveda.protected_key);
        const dec = (v: string | null) => (v ? decryptString(key, v) : Promise.resolve(''));

        expect(await Promise.all(boveda.folders.map((f) => dec(f.name)))).toEqual(CARPETAS_DEMO.map((c) => c.nombre));
        expect(await Promise.all(boveda.tags.map((t) => dec(t.name)))).toEqual(ETIQUETAS_DEMO.map((t) => t.nombre));

        // Si falla acá, se cambió bovedaDemo.ts sin regenerar: node scripts/generar-boveda-demo.mjs
        expect(boveda.entries).toHaveLength(ENTRADAS_DEMO.length);
        for (const [i, e] of boveda.entries.entries()) {
            const esperado = ENTRADAS_DEMO[i];
            expect({
                title: await dec(e.title),
                username: await dec(e.username),
                password: await dec(e.password),
                url: await dec(e.url),
                notes: await dec(e.notes),
                campos: await Promise.all(e.custom_fields.map(async (f) => [await dec(f.label), await dec(f.value)])),
                carpeta: e.carpeta,
                etiquetas: e.etiquetas,
            }).toEqual({
                title: esperado.title,
                username: esperado.username,
                password: esperado.password,
                url: esperado.url,
                notes: esperado.notes,
                campos: esperado.campos.map((f) => [f.label, f.value]),
                carpeta: esperado.carpeta,
                etiquetas: esperado.etiquetas,
            });
        }
    });
});
