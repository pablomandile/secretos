import { describe, expect, it } from 'vitest';

import { parseCsv, parseKeepassCsv } from './keepassImport';

describe('parseCsv', () => {
    it('parsea campos simples', () => {
        expect(parseCsv('a,b,c\n1,2,3')).toEqual([
            ['a', 'b', 'c'],
            ['1', '2', '3'],
        ]);
    });

    it('maneja comillas, comas embebidas y comillas escapadas', () => {
        const csv = '"Title","Notes"\n"Banco","Línea 1, con coma"\n"PIN","comilla "" interna"';
        expect(parseCsv(csv)).toEqual([
            ['Title', 'Notes'],
            ['Banco', 'Línea 1, con coma'],
            ['PIN', 'comilla " interna'],
        ]);
    });

    it('maneja saltos de línea dentro de un campo entre comillas', () => {
        const csv = 'Title,Notes\n"X","línea1\nlínea2"';
        const rows = parseCsv(csv);
        expect(rows[1][1]).toBe('línea1\nlínea2');
    });

    it('tolera CRLF y no agrega fila vacía final', () => {
        expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
            ['a', 'b'],
            ['1', '2'],
        ]);
    });

    it('descarta el BOM inicial para no romper el primer encabezado', () => {
        const csv = '﻿"Account","Password"\n"GitHub","x"';
        const rows = parseKeepassCsv(csv);
        expect(rows).toHaveLength(1);
        expect(rows[0].title).toBe('GitHub'); // "Account" mapea aunque venga con BOM
    });
});

describe('parseKeepassCsv', () => {
    it('mapea el formato KeePass 2.x (Group/Title/Username/Password/URL/Notes)', () => {
        const csv =
            '"Group","Title","Username","Password","URL","Notes"\n' +
            '"Trabajo","GitHub","pablo","s3cr3t","https://github.com","nota"';
        const rows = parseKeepassCsv(csv);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            group: 'Trabajo',
            title: 'GitHub',
            username: 'pablo',
            password: 's3cr3t',
            url: 'https://github.com',
            notes: 'nota',
        });
    });

    it('mapea el formato KeePass 1.x (Account/Login Name/Password/Web Site/Comments)', () => {
        const csv =
            '"Account","Login Name","Password","Web Site","Comments"\n' +
            '"Mi cuenta","juan","pass","https://x.com","obs"';
        const [row] = parseKeepassCsv(csv);
        expect(row.title).toBe('Mi cuenta');
        expect(row.username).toBe('juan');
        expect(row.url).toBe('https://x.com');
        expect(row.notes).toBe('obs');
    });

    it('detecta columna TOTP y encabezados en español', () => {
        const csv = '"Titulo","Usuario","Contraseña","TOTP"\n"Cuenta","u","p","JBSWY3DPEHPK3PXP"';
        const [row] = parseKeepassCsv(csv);
        expect(row.title).toBe('Cuenta');
        expect(row.username).toBe('u');
        expect(row.password).toBe('p');
        expect(row.totp).toBe('JBSWY3DPEHPK3PXP');
    });

    it('ignora filas totalmente vacías', () => {
        const csv = '"Title","Password"\n"A","1"\n,\n"B","2"';
        expect(parseKeepassCsv(csv)).toHaveLength(2);
    });

    it('devuelve vacío si no hay filas de datos', () => {
        expect(parseKeepassCsv('"Title","Password"')).toEqual([]);
    });
});
