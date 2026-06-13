/**
 * Parseo de CSV exportado por KeePass 2.x (y variantes) para importar entradas.
 * Todo ocurre en el cliente: las filas se mapean a entradas que luego se cifran
 * antes de subir. El parser sigue RFC 4180 (comillas, comas y saltos embebidos).
 */

export interface ImportCustomField {
    label: string;
    value: string;
    protected: boolean;
}

export interface ImportRow {
    /** Ruta de carpeta separada por "/" (vacío = sin carpeta). */
    group: string;
    title: string;
    username: string;
    password: string;
    url: string;
    notes: string;
    totp: string;
    customFields: ImportCustomField[];
}

/** Parser CSV genérico → filas de campos. */
export function parseCsv(text: string): string[][] {
    // Descarta el BOM inicial (algunas exportaciones de KeePass lo incluyen);
    // si no, el nombre de la primera columna no matchearía el encabezado.
    if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
    }

    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 2;
                    continue;
                }
                inQuotes = false;
                i++;
                continue;
            }
            field += ch;
            i++;
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
            i++;
        } else if (ch === ',') {
            row.push(field);
            field = '';
            i++;
        } else if (ch === '\r') {
            i++; // se ignora; el \n cierra la fila
        } else if (ch === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            i++;
        } else {
            field += ch;
            i++;
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

// Encabezados conocidos (KeePass 1.x/2.x, inglés y español) → campo interno.
const COLUMN_MAP: Record<string, keyof ImportRow> = {
    group: 'group',
    grupo: 'group',
    title: 'title',
    account: 'title',
    name: 'title',
    titulo: 'title',
    'título': 'title',
    username: 'username',
    'user name': 'username',
    'login name': 'username',
    login: 'username',
    usuario: 'username',
    password: 'password',
    'contraseña': 'password',
    contrasena: 'password',
    url: 'url',
    'web site': 'url',
    website: 'url',
    'sitio web': 'url',
    notes: 'notes',
    comments: 'notes',
    notas: 'notes',
    totp: 'totp',
    otp: 'totp',
    otpauth: 'totp',
};

/** Mapea un CSV de KeePass a filas tipadas, detectando columnas por encabezado. */
export function parseKeepassCsv(text: string): ImportRow[] {
    const rows = parseCsv(text);
    if (rows.length < 2) return [];

    const indices: Partial<Record<keyof ImportRow, number>> = {};
    rows[0].forEach((header, i) => {
        const key = COLUMN_MAP[header.trim().toLowerCase()];
        if (key && indices[key] === undefined) {
            indices[key] = i;
        }
    });

    const get = (cols: string[], key: keyof ImportRow): string => {
        const idx = indices[key];
        return idx !== undefined ? (cols[idx] ?? '').trim() : '';
    };

    return rows
        .slice(1)
        .filter((cols) => cols.some((c) => c.trim() !== ''))
        .map((cols) => ({
            group: get(cols, 'group'),
            title: get(cols, 'title'),
            username: get(cols, 'username'),
            password: get(cols, 'password'),
            url: get(cols, 'url'),
            notes: get(cols, 'notes'),
            totp: get(cols, 'totp'),
            customFields: [],
        }));
}

// ---------------------------------------------------------------------------
// Import desde el XML nativo de KeePass 2.x (trae jerarquía de carpetas, TOTP y
// campos personalizados). Los valores en el XML exportado están en texto plano.
// ---------------------------------------------------------------------------

const STANDARD_KEYS = new Set(['Title', 'UserName', 'Password', 'URL', 'Notes']);
const TOTP_KEYS = new Set(['otp', 'TOTP', 'TimeOtp-Secret-Base32']);

function directChildren(el: Element, tag: string): Element[] {
    return Array.from(el.children).filter((c) => c.tagName === tag);
}

function directChild(el: Element, tag: string): Element | null {
    return directChildren(el, tag)[0] ?? null;
}

function xmlEntryToRow(entryEl: Element, group: string): ImportRow {
    const values: Record<string, string> = {};
    const protectedKeys = new Set<string>();

    // Solo los <String> DIRECTOS de la entrada (no los del <History>).
    for (const s of directChildren(entryEl, 'String')) {
        const key = directChild(s, 'Key')?.textContent ?? '';
        const valueEl = directChild(s, 'Value');
        values[key] = valueEl?.textContent ?? '';
        if (valueEl?.getAttribute('ProtectInMemory') === 'True' || valueEl?.getAttribute('Protected') === 'True') {
            protectedKeys.add(key);
        }
    }

    const customFields: ImportCustomField[] = Object.keys(values)
        .filter((k) => !STANDARD_KEYS.has(k) && !TOTP_KEYS.has(k) && values[k] !== '')
        .map((k) => ({ label: k, value: values[k], protected: protectedKeys.has(k) }));

    return {
        group,
        title: values.Title ?? '',
        username: values.UserName ?? '',
        password: values.Password ?? '',
        url: values.URL ?? '',
        notes: values.Notes ?? '',
        totp: values.otp || values.TOTP || values['TimeOtp-Secret-Base32'] || '',
        customFields,
    };
}

export function parseKeepassXml(xml: string): ImportRow[] {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) {
        throw new Error('XML inválido');
    }

    // La papelera de KeePass se identifica por UUID; sus entradas no se importan.
    const recycleBinUuid = doc.querySelector('Meta > RecycleBinUUID')?.textContent?.trim() || null;
    const root = doc.querySelector('KeePassFile > Root');
    if (!root) return [];

    const rows: ImportRow[] = [];

    const walk = (groupEl: Element, path: string[]): void => {
        const uuid = directChild(groupEl, 'UUID')?.textContent?.trim();
        if (uuid && uuid === recycleBinUuid) return;

        for (const entryEl of directChildren(groupEl, 'Entry')) {
            rows.push(xmlEntryToRow(entryEl, path.join('/')));
        }
        for (const sub of directChildren(groupEl, 'Group')) {
            const name = directChild(sub, 'Name')?.textContent ?? '';
            walk(sub, [...path, name]);
        }
    };

    // El grupo raíz (nombre de la base) NO se agrega al path: sus entradas quedan
    // sin carpeta y sus subgrupos son las carpetas de primer nivel.
    for (const top of directChildren(root, 'Group')) {
        walk(top, []);
    }

    return rows;
}
