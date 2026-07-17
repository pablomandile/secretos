/**
 * Exportación al XML nativo de KeePass 2.x (formato "KeePass XML (2.x)"), para
 * poder reimportar la bóveda en KeePass u otros gestores. Es el espejo del
 * parser de import (ver keepassImport.ts → parseKeepassXml):
 *
 *   <KeePassFile><Root><Group>            ← grupo raíz (su nombre NO es carpeta)
 *     <Entry>…</Entry>                     ← entradas "sin carpeta"
 *     <Group><Name>Carpeta</Name>…</Group> ← carpetas de primer nivel (anidan)
 *   </Group></Root></KeePassFile>
 *
 * TODO ocurre en el cliente, sobre datos YA descifrados. El archivo resultante
 * está en TEXTO PLANO (sin cifrar): quien lo abra ve todas las contraseñas.
 */
import type { DecryptedEntry, DecryptedFolder } from '@/stores/vault';

/** Escapa texto para uso seguro en contenido y atributos XML. */
function esc(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// Caracteres de control no permitidos en XML 1.0 (se conservan \t \n \r).
const INVALID_XML_CHARS = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]', 'g');

/** Escapa y limpia caracteres inválidos, en un solo paso. */
function clean(value: string): string {
    return esc(value.replace(INVALID_XML_CHARS, ''));
}

/** UUID de 16 bytes en base64, como usa KeePass para <UUID>. */
function uuid(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
}

/** Fecha ISO 8601 en UTC sin fracciones (formato de tiempos del XML de KeePass). */
function isoTime(value: string): string {
    const d = new Date(value);
    const iso = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    return iso.replace(/\.\d+Z$/, 'Z');
}

function stringNode(key: string, value: string, protectedValue: boolean): string {
    const attr = protectedValue ? ' ProtectInMemory="True"' : '';
    return `<String><Key>${clean(key)}</Key><Value${attr}>${clean(value)}</Value></String>`;
}

function timesNode(entry: DecryptedEntry): string {
    const created = isoTime(entry.createdAt);
    const modified = isoTime(entry.updatedAt);
    return '<Times>'
        + `<CreationTime>${created}</CreationTime>`
        + `<LastModificationTime>${modified}</LastModificationTime>`
        + `<LastAccessTime>${modified}</LastAccessTime>`
        + `<ExpiryTime>${modified}</ExpiryTime>`
        + '<Expires>False</Expires>'
        + '<UsageCount>0</UsageCount>'
        + `<LocationChanged>${modified}</LocationChanged>`
        + '</Times>';
}

function entryNode(entry: DecryptedEntry): string {
    const strings: string[] = [stringNode('Title', entry.title, false)];
    if (entry.username) strings.push(stringNode('UserName', entry.username, false));
    if (entry.password) strings.push(stringNode('Password', entry.password, true));
    if (entry.url) strings.push(stringNode('URL', entry.url, false));
    if (entry.notes) strings.push(stringNode('Notes', entry.notes, false));
    for (const field of entry.customFields) {
        if (!field.label) continue;
        strings.push(stringNode(field.label, field.value, field.protected));
    }
    return `<Entry><UUID>${uuid()}</UUID>${timesNode(entry)}${strings.join('')}</Entry>`;
}

/**
 * Genera el XML de KeePass 2.x a partir de las entradas y carpetas descifradas.
 * Reconstruye la jerarquía de carpetas por parentId y ubica cada entrada en su
 * carpeta (folderId === null → cuelga del grupo raíz).
 */
export function buildKeepassXml(entries: DecryptedEntry[], folders: DecryptedFolder[]): string {
    const childFolders = new Map<string | null, DecryptedFolder[]>();
    const sortedFolders = [...folders].sort(
        (a, b) => a.position - b.position || a.name.localeCompare(b.name),
    );
    for (const folder of sortedFolders) {
        const siblings = childFolders.get(folder.parentId) ?? [];
        siblings.push(folder);
        childFolders.set(folder.parentId, siblings);
    }

    const entriesByFolder = new Map<string | null, DecryptedEntry[]>();
    for (const entry of entries) {
        const list = entriesByFolder.get(entry.folderId) ?? [];
        list.push(entry);
        entriesByFolder.set(entry.folderId, list);
    }

    const groupNode = (name: string, folderId: string | null): string => {
        const ents = (entriesByFolder.get(folderId) ?? []).map(entryNode).join('');
        const subs = (childFolders.get(folderId) ?? [])
            .map((f) => groupNode(f.name, f.id))
            .join('');
        return `<Group><UUID>${uuid()}</UUID><Name>${clean(name)}</Name>${ents}${subs}</Group>`;
    };

    // Grupo raíz: sus entradas directas son las "sin carpeta"; sus subgrupos, las
    // carpetas de primer nivel. El nombre del raíz no forma parte de ninguna ruta.
    const rootEntries = (entriesByFolder.get(null) ?? []).map(entryNode).join('');
    const rootSubs = (childFolders.get(null) ?? []).map((f) => groupNode(f.name, f.id)).join('');
    const root = `<Group><UUID>${uuid()}</UUID><Name>Secretos</Name>${rootEntries}${rootSubs}</Group>`;

    return '<?xml version="1.0" encoding="utf-8"?>\n'
        + '<KeePassFile>'
        + '<Meta><Generator>Secretos</Generator><DatabaseName>Secretos</DatabaseName></Meta>'
        + `<Root>${root}</Root>`
        + '</KeePassFile>';
}

/** Construye el XML y dispara la descarga del archivo en el navegador. */
export function downloadKeepassXml(entries: DecryptedEntry[], folders: DecryptedFolder[]): void {
    const xml = buildKeepassXml(entries, folders);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `secretos-${new Date().toISOString().slice(0, 10)}.xml`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
