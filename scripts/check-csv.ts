/**
 * Diagnóstico de un CSV de KeePass contra nuestro parser, SIN exponer secretos.
 * Reporta codificación/BOM, columnas detectadas, mapeo, columnas ignoradas y
 * conteos. Los valores se enmascaran (solo longitudes / presencia).
 *
 *   npx vite-node scripts/check-csv.ts "C:\temp\pablo.csv"
 */
import { readFileSync } from 'node:fs';
import { parseCsv, parseKeepassCsv } from '../resources/js/services/keepassImport';

const path = process.argv[2];
if (!path) {
    console.error('Uso: vite-node scripts/check-csv.ts <ruta.csv>');
    process.exit(1);
}

const buf = readFileSync(path);

// Detectar codificación por BOM / bytes nulos.
let encoding = 'utf-8 (sin BOM)';
let utf16 = false;
if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) encoding = 'utf-8 (con BOM)';
else if (buf[0] === 0xff && buf[1] === 0xfe) {
    encoding = 'utf-16 LE';
    utf16 = true;
} else if (buf[0] === 0xfe && buf[1] === 0xff) {
    encoding = 'utf-16 BE';
    utf16 = true;
} else if (buf.subarray(0, 200).includes(0x00)) {
    encoding = 'utf-16 (sin BOM, hay bytes nulos)';
    utf16 = true;
}

// Así lo ve el navegador: File.text() decodifica como UTF-8 y descarta el BOM.
const browserText = new TextDecoder('utf-8').decode(buf);

console.log('=== Archivo ===');
console.log('  tamaño:', buf.length, 'bytes');
console.log('  codificación detectada:', encoding);
if (utf16) {
    console.log('  ⚠️  UTF-16: File.text() del navegador lo decodifica como UTF-8 → texto corrupto.');
    console.log('     Nuestro import fallaría. Habría que decodificar UTF-16 o exportar como UTF-8.');
}

const rows = parseCsv(browserText);
const header = rows[0] ?? [];
console.log('\n=== Encabezado (nombres de columna, no son secretos) ===');
console.log(' ', JSON.stringify(header));

const entries = parseKeepassCsv(browserText);

// ¿Qué columnas mapeó nuestro parser? (replicamos su lógica de detección)
const FIELDS = ['group', 'title', 'username', 'password', 'url', 'notes', 'totp'] as const;
const ALIASES: Record<string, string> = {
    group: 'group', grupo: 'group',
    title: 'title', account: 'title', name: 'title', titulo: 'title', 'título': 'title',
    username: 'username', 'user name': 'username', 'login name': 'username', login: 'username', usuario: 'username',
    password: 'password', 'contraseña': 'password', contrasena: 'password',
    url: 'url', 'web site': 'url', website: 'url', 'sitio web': 'url',
    notes: 'notes', comments: 'notes', notas: 'notes',
    totp: 'totp', otp: 'totp', otpauth: 'totp',
};
const mappedCols = new Map<string, string>(); // field -> header name
const unmapped: string[] = [];
header.forEach((h) => {
    const key = ALIASES[h.trim().toLowerCase()];
    if (key && !mappedCols.has(key)) mappedCols.set(key, h);
    else if (!key) unmapped.push(h);
});

console.log('\n=== Mapeo de columnas ===');
for (const f of FIELDS) {
    console.log(`  ${f.padEnd(9)} → ${mappedCols.get(f) ?? 'NO DETECTADA'}`);
}
if (unmapped.length) {
    console.log('\n=== Columnas IGNORADAS (no las importamos) ===');
    console.log(' ', JSON.stringify(unmapped));
}

console.log('\n=== Conteos ===');
console.log('  filas de datos (sin encabezado):', Math.max(0, rows.length - 1));
console.log('  entradas parseadas:', entries.length);
const nonEmpty = (k: keyof (typeof entries)[number]) => entries.filter((e) => e[k]).length;
console.log('  con título:', nonEmpty('title'), '| sin título (→ "(sin título)"):', entries.filter((e) => !e.title).length);
console.log('  con usuario:', nonEmpty('username'));
console.log('  con contraseña:', nonEmpty('password'));
console.log('  con URL:', nonEmpty('url'));
console.log('  con notas:', nonEmpty('notes'), '| notas multilínea:', entries.filter((e) => e.notes.includes('\n')).length);
console.log('  con grupo/carpeta:', nonEmpty('group'));
console.log('  con TOTP:', nonEmpty('totp'));

console.log('\n=== Vista previa enmascarada (entrada #1) ===');
const e = entries[0];
if (e) {
    const mask = (s: string) => (s ? `(${s.length} chars)` : '(vacío)');
    console.log('  group:', e.group ? `"${e.group}"` : '(vacío)'); // el grupo no es secreto
    console.log('  title:', mask(e.title));
    console.log('  username:', mask(e.username));
    console.log('  password:', mask(e.password));
    console.log('  url:', mask(e.url));
    console.log('  notes:', mask(e.notes));
    console.log('  totp:', e.totp ? 'presente' : '(vacío)');
}

// Grupos únicos (se vuelven carpetas) — los nombres de grupo no suelen ser secretos.
const groups = [...new Set(entries.map((x) => x.group).filter(Boolean))];
console.log('\n=== Grupos → carpetas (' + groups.length + ') ===');
console.log(' ', JSON.stringify(groups));
