// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { buildKeepassXml } from './keepassExport';
import { parseKeepassXml, type ImportRow } from './keepassImport';
import type { DecryptedEntry, DecryptedFolder } from '@/stores/vault';

function entry(partial: Partial<DecryptedEntry> & { title: string }): DecryptedEntry {
    return {
        id: partial.id ?? crypto.randomUUID(),
        type: 1,
        folderId: partial.folderId ?? null,
        title: partial.title,
        username: partial.username ?? '',
        password: partial.password ?? '',
        url: partial.url ?? '',
        notes: partial.notes ?? '',
        favorite: partial.favorite ?? false,
        customFields: partial.customFields ?? [],
        tagIds: partial.tagIds ?? [],
        createdAt: partial.createdAt ?? '2026-01-02T03:04:05.000000Z',
        updatedAt: partial.updatedAt ?? '2026-01-02T03:04:05.000000Z',
    };
}

const folders: DecryptedFolder[] = [
    { id: 'F1', parentId: null, name: 'Email', position: 0 },
    { id: 'F2', parentId: 'F1', name: 'Personal', position: 0 },
];

const entries: DecryptedEntry[] = [
    entry({ title: 'Top', password: 'toppass', folderId: null }),
    entry({
        title: 'Gmail',
        username: 'pablo',
        password: 'gmailpass',
        url: 'https://gmail.com',
        folderId: 'F1',
        customFields: [
            { label: 'TOTP', value: 'otpauth://totp/x?secret=ABC', type: 3, protected: true, position: 0 },
            { label: 'Recovery', value: 'codes123', type: 1, protected: false, position: 1 },
        ],
    }),
    entry({ title: 'Nested', folderId: 'F2' }),
    entry({ title: 'A & B <x> "q" \' end', password: 'p&<>"', folderId: null }),
];

describe('buildKeepassXml → parseKeepassXml (round-trip)', () => {
    const xml = buildKeepassXml(entries, folders);
    const rows = parseKeepassXml(xml);
    const byTitle = (t: string): ImportRow | undefined => rows.find((r) => r.title === t);

    it('produce XML válido de KeePass', () => {
        expect(xml.startsWith('<?xml')).toBe(true);
        expect(xml).toContain('<KeePassFile>');
        expect(rows).toHaveLength(entries.length);
    });

    it('la entrada sin carpeta queda en la raíz', () => {
        expect(byTitle('Top')?.group).toBe('');
        expect(byTitle('Top')?.password).toBe('toppass');
    });

    it('preserva la jerarquía de carpetas', () => {
        expect(byTitle('Gmail')?.group).toBe('Email');
        expect(byTitle('Nested')?.group).toBe('Email/Personal');
    });

    it('preserva campos estándar, TOTP y campos personalizados', () => {
        const gmail = byTitle('Gmail')!;
        expect(gmail.username).toBe('pablo');
        expect(gmail.password).toBe('gmailpass');
        expect(gmail.url).toBe('https://gmail.com');
        expect(gmail.totp).toBe('otpauth://totp/x?secret=ABC');
        expect(gmail.customFields).toEqual([{ label: 'Recovery', value: 'codes123', protected: false }]);
    });

    it('escapa correctamente caracteres especiales de XML', () => {
        const special = byTitle('A & B <x> "q" \' end');
        expect(special).toBeDefined();
        expect(special?.password).toBe('p&<>"');
    });
});
