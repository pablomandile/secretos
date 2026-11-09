/**
 * Bóveda de la cuenta demo (secretos.bambudev.com.ar).
 *
 * El servidor no puede cifrar (es zero-knowledge, y además el PHP del hosting no
 * tiene Argon2id crudo), así que la bóveda se cifra acá, con el mismo código que
 * usa el navegador, y se guarda como fixture en database/seeders/demo/boveda.json.
 * El DemoSeeder solo la inserta, con fechas relativas al día del reset.
 *
 * Para regenerarla después de cambiar el contenido:
 *   node scripts/generar-boveda-demo.mjs
 */

import { encryptString } from '@/crypto/cipher';
import { toBase64, zero } from '@/crypto/encoding';
import { DEFAULT_KDF_PARAMS, deriveMasterKey } from '@/crypto/kdf';
import { deriveAuthVerifier, deriveWrappingKey, generateVaultKeyBytes, importVaultKey, wrapVaultKey } from '@/crypto/keys';

export interface CampoDemo {
    label: string;
    value: string;
    type: number; // 1=texto, 2=protegido, 3=totp
    protected: boolean;
}

export interface EntradaDemo {
    carpeta: string | null;
    title: string;
    username: string;
    password: string;
    url: string;
    notes: string;
    favorite: boolean;
    /** Antigüedad al momento del reset: así "Todas" siempre se ve al día. */
    diasAtras: number;
    campos: CampoDemo[];
    etiquetas: string[];
}

export const CARPETAS_DEMO: { clave: string; padre: string | null; nombre: string }[] = [
    { clave: 'personal', padre: null, nombre: 'Personal' },
    { clave: 'trabajo', padre: null, nombre: 'Trabajo' },
    { clave: 'servidores', padre: 'trabajo', nombre: 'Servidores' },
    { clave: 'finanzas', padre: null, nombre: 'Finanzas' },
    { clave: 'hogar', padre: null, nombre: 'Hogar' },
];

export const ETIQUETAS_DEMO: { clave: string; nombre: string; color: string }[] = [
    { clave: '2fa', nombre: '2FA', color: '#10b981' },
    { clave: 'compartida', nombre: 'Compartida', color: '#6366f1' },
    { clave: 'importante', nombre: 'Importante', color: '#ef4444' },
];

const TOTP_DEMO = 'JBSWY3DPEHPK3PXP';

const entrada = (e: Partial<EntradaDemo> & Pick<EntradaDemo, 'title' | 'diasAtras'>): EntradaDemo => ({
    carpeta: null,
    username: '',
    password: '',
    url: '',
    notes: '',
    favorite: false,
    campos: [],
    etiquetas: [],
    ...e,
});

/**
 * Datos ficticios. Hay a propósito contraseñas débiles y repetidas, para que el
 * reporte de salud tenga algo que mostrar.
 */
export const ENTRADAS_DEMO: EntradaDemo[] = [
    entrada({
        carpeta: 'personal', title: 'Correo personal', username: 'demo.secretos@example.com',
        password: 'Rio-Lento-Faro-42!', url: 'https://mail.example.com', favorite: true, diasAtras: 1,
        campos: [{ label: 'TOTP', value: TOTP_DEMO, type: 3, protected: true }], etiquetas: ['2fa', 'importante'],
    }),
    entrada({
        carpeta: 'finanzas', title: 'Home banking', username: '20123456789',
        password: 'kV8#qL2!mZ9@wT4p', url: 'https://banco.example.com', favorite: true, diasAtras: 3,
        notes: 'Usuario = CUIT. La tarjeta de coordenadas está en el cajón del escritorio.',
        campos: [
            { label: 'PIN cajero', value: '4821', type: 2, protected: true },
            { label: 'Clave de transferencias', value: 'Naranja-Tigre-77', type: 2, protected: true },
        ],
        etiquetas: ['importante'],
    }),
    entrada({
        carpeta: 'hogar', title: 'Wi-Fi de casa', username: 'CasaDemo-5G', password: 'girasol2024',
        diasAtras: 5, notes: 'Router en el living. Clave de admin del router: admin / admin (cambiarla).',
        etiquetas: ['compartida'],
    }),
    entrada({
        carpeta: 'personal', title: 'Streaming de series', username: 'demo.secretos@example.com',
        password: 'girasol2024', url: 'https://series.example.com', diasAtras: 8,
        notes: 'Perfil familiar. Misma clave que el Wi-Fi: cambiarla.', etiquetas: ['compartida'],
    }),
    entrada({
        carpeta: 'trabajo', title: 'Correo del trabajo', username: 'demo@empresa.example',
        password: 'Q7!nV3$tB9#xR1', url: 'https://correo.empresa.example', favorite: true, diasAtras: 10,
        campos: [{ label: 'TOTP', value: TOTP_DEMO, type: 3, protected: true }], etiquetas: ['2fa'],
    }),
    entrada({
        carpeta: 'servidores', title: 'VPS producción (SSH)', username: 'deploy',
        password: 'Cobre-Nube-Pino-93', url: 'ssh://203.0.113.10:22', diasAtras: 12,
        notes: 'Solo con clave pública. La contraseña es la del sudo.',
        campos: [
            { label: 'Puerto', value: '22', type: 1, protected: false },
            { label: 'Huella del host', value: 'SHA256:mF3x0demoHuellaDeEjemplo9q', type: 1, protected: false },
        ],
        etiquetas: ['importante'],
    }),
    entrada({
        carpeta: 'servidores', title: 'Base de datos staging', username: 'app_staging',
        password: '123456', url: 'mysql://db.staging.example:3306', diasAtras: 15,
        notes: 'Contraseña débil a propósito: es solo staging. (El reporte de salud la marca.)',
    }),
    entrada({
        carpeta: 'trabajo', title: 'Gestor de proyectos', username: 'demo@empresa.example',
        password: 'Q7!nV3$tB9#xR1', url: 'https://proyectos.example.com', diasAtras: 20,
        notes: 'Repite la del correo del trabajo.',
    }),
    entrada({
        carpeta: 'finanzas', title: 'Billetera virtual', username: '+54 9 11 5555-0101',
        password: 'Mate-Amargo-2025$', url: 'https://billetera.example.com', diasAtras: 25,
        campos: [{ label: 'TOTP', value: TOTP_DEMO, type: 3, protected: true }], etiquetas: ['2fa'],
    }),
    entrada({
        carpeta: 'finanzas', title: 'Tarjeta de crédito', username: 'Titular: Demo Secretos',
        password: '', diasAtras: 30,
        notes: 'Vence 08/29. Atención al cliente: 0800-555-0199.',
        campos: [
            { label: 'Número', value: '4000 1234 5678 9010', type: 2, protected: true },
            { label: 'Código de seguridad', value: '321', type: 2, protected: true },
        ],
    }),
    entrada({
        carpeta: 'personal', title: 'Red social', username: '@demo_secretos',
        password: 'password', url: 'https://social.example.com', diasAtras: 40,
    }),
    entrada({
        carpeta: 'hogar', title: 'Alarma de casa', username: '', password: '', diasAtras: 45,
        campos: [
            { label: 'Código de desactivación', value: '7319', type: 2, protected: true },
            { label: 'Palabra de seguridad', value: 'Cardenal', type: 2, protected: true },
        ],
        etiquetas: ['compartida'],
    }),
    entrada({
        carpeta: 'hogar', title: 'Compañía de luz', username: 'Cliente 00123456',
        password: 'Lampara-Azul-61', url: 'https://energia.example.com', diasAtras: 60,
    }),
    entrada({
        carpeta: 'personal', title: 'Tienda online', username: 'demo.secretos@example.com',
        password: 'Rio-Lento-Faro-42!', url: 'https://tienda.example.com', diasAtras: 75,
        notes: 'Repite la del correo personal (el reporte de salud la marca).',
    }),
    entrada({
        carpeta: 'trabajo', title: 'Repositorio de código', username: 'demo-dev',
        password: 'Hx4!rZ8$pW2&kM6q', url: 'https://git.example.com', diasAtras: 90,
        campos: [{ label: 'Token de acceso', value: 'ghp_demoTokenDeEjemplo000000000000', type: 2, protected: true }],
        etiquetas: ['2fa'],
    }),
    entrada({
        carpeta: null, title: 'Nota: preguntas de seguridad', diasAtras: 120,
        notes: 'Primera mascota: Toby\nCalle donde creciste: Las Heras\nComida preferida: empanadas',
    }),
    entrada({
        carpeta: null, title: 'Licencia de software', username: 'demo.secretos@example.com',
        password: '', diasAtras: 150,
        campos: [{ label: 'Clave de licencia', value: 'DEMO-7K2Q-9XPL-44RT', type: 2, protected: true }],
    }),
    entrada({
        carpeta: 'personal', title: 'Obra social', username: 'Afiliado 123456/01',
        password: 'Hoja-Verde-58', url: 'https://salud.example.com', diasAtras: 200,
    }),
];

export interface BovedaDemoCifrada {
    kdf: { type: number; memory: number; iterations: number; parallelism: number; salt: string };
    verifier: string;
    protected_key: string;
    folders: { clave: string; padre: string | null; name: string; position: number }[];
    tags: { clave: string; name: string; color: string }[];
    entries: {
        carpeta: string | null;
        type: number;
        title: string;
        username: string | null;
        password: string | null;
        url: string | null;
        notes: string | null;
        favorite: boolean;
        dias_atras: number;
        custom_fields: { label: string; value: string; type: number; protected: boolean; position: number }[];
        etiquetas: string[];
    }[];
}

/** Cifra la bóveda demo con la contraseña maestra dada (la de config/demo.php). */
export async function cifrarBovedaDemo(password: string): Promise<BovedaDemoCifrada> {
    const kdf = DEFAULT_KDF_PARAMS;
    const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
    const masterKey = await deriveMasterKey(password, salt, kdf);
    const vaultBytes = generateVaultKeyBytes();
    try {
        const verifier = await deriveAuthVerifier(masterKey);
        const protectedKey = await wrapVaultKey(await deriveWrappingKey(masterKey), vaultBytes);
        const key = await importVaultKey(vaultBytes);
        const enc = (v: string) => encryptString(key, v);
        const optional = async (v: string) => (v ? await enc(v) : null);

        return {
            kdf: { ...kdf, salt },
            verifier,
            protected_key: protectedKey,
            folders: await Promise.all(
                CARPETAS_DEMO.map(async (c, i) => ({ clave: c.clave, padre: c.padre, name: await enc(c.nombre), position: i })),
            ),
            tags: await Promise.all(
                ETIQUETAS_DEMO.map(async (t) => ({ clave: t.clave, name: await enc(t.nombre), color: t.color })),
            ),
            entries: await Promise.all(
                ENTRADAS_DEMO.map(async (e) => ({
                    carpeta: e.carpeta,
                    type: 1,
                    title: await enc(e.title),
                    username: await optional(e.username),
                    password: await optional(e.password),
                    url: await optional(e.url),
                    notes: await optional(e.notes),
                    favorite: e.favorite,
                    dias_atras: e.diasAtras,
                    custom_fields: await Promise.all(
                        e.campos.map(async (f, position) => ({
                            label: await enc(f.label),
                            value: await enc(f.value),
                            type: f.type,
                            protected: f.protected,
                            position,
                        })),
                    ),
                    etiquetas: e.etiquetas,
                })),
            ),
        };
    } finally {
        zero(masterKey);
        zero(vaultBytes);
    }
}
