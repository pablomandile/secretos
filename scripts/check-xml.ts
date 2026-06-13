/**
 * Diagnóstico de un XML de KeePass contra parseKeepassXml, SIN exponer secretos.
 * Usa el DOMParser de jsdom (en el navegador es nativo). Reporta carpetas,
 * conteos y una vista previa enmascarada.
 *
 *   npx vite-node scripts/check-xml.ts "C:\temp\pablo.xml"
 */
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

// El parser usa DOMParser (global en el navegador); lo proveemos vía jsdom.
(globalThis as unknown as { DOMParser: typeof window.DOMParser }).DOMParser = new JSDOM().window.DOMParser;

import { parseKeepassXml } from '../resources/js/services/keepassImport';

const path = process.argv[2];
if (!path) {
    console.error('Uso: vite-node scripts/check-xml.ts <ruta.xml>');
    process.exit(1);
}

const xml = new TextDecoder('utf-8').decode(readFileSync(path));
const rows = parseKeepassXml(xml);

console.log('=== Conteos ===');
console.log('  entradas reales (sin historial ni papelera):', rows.length);
const nonEmpty = (k: 'title' | 'username' | 'password' | 'url' | 'notes' | 'totp') => rows.filter((r) => r[k]).length;
console.log('  con título:', nonEmpty('title'), '| sin título:', rows.filter((r) => !r.title).length);
console.log('  con usuario:', nonEmpty('username'), '| con contraseña:', nonEmpty('password'));
console.log('  con URL:', nonEmpty('url'), '| con notas:', nonEmpty('notes'));
console.log('  con TOTP:', nonEmpty('totp'));
console.log('  con campos personalizados:', rows.filter((r) => r.customFields.length).length);
console.log('  en una carpeta:', rows.filter((r) => r.group).length, '| sin carpeta:', rows.filter((r) => !r.group).length);

const folders = [...new Set(rows.map((r) => r.group).filter(Boolean))].sort();
console.log('\n=== Carpetas (rutas únicas, ' + folders.length + ') ===');
for (const f of folders) {
    console.log('  -', f, `(${rows.filter((r) => r.group === f).length} entradas)`);
}

console.log('\n=== Vista previa enmascarada (entrada #1) ===');
const e = rows[0];
if (e) {
    const mask = (s: string) => (s ? `(${s.length} chars)` : '(vacío)');
    console.log('  group:', e.group || '(raíz)');
    console.log('  title:', mask(e.title), '| username:', mask(e.username), '| password:', mask(e.password));
    console.log('  url:', mask(e.url), '| notes:', mask(e.notes), '| totp:', e.totp ? 'sí' : 'no');
}
