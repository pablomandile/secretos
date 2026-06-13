/**
 * Parseo de CSV exportado por KeePass 2.x (y variantes) para importar entradas.
 * Todo ocurre en el cliente: las filas se mapean a entradas que luego se cifran
 * antes de subir. El parser sigue RFC 4180 (comillas, comas y saltos embebidos).
 */

export interface ImportRow {
    group: string;
    title: string;
    username: string;
    password: string;
    url: string;
    notes: string;
    totp: string;
}

/** Parser CSV genérico → filas de campos. */
export function parseCsv(text: string): string[][] {
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
        }));
}
