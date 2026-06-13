// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { parseKeepassXml, type ImportRow } from './keepassImport';

const XML = `<?xml version="1.0" encoding="utf-8"?>
<KeePassFile>
  <Meta><RecycleBinUUID>RECYCLE==</RecycleBinUUID></Meta>
  <Root>
    <Group>
      <UUID>ROOT==</UUID>
      <Name>Base</Name>
      <Entry>
        <UUID>E1</UUID>
        <String><Key>Title</Key><Value>Top</Value></String>
        <String><Key>Password</Key><Value Protected="True">toppass</Value></String>
      </Entry>
      <Group>
        <UUID>GEMAIL</UUID>
        <Name>Email</Name>
        <Entry>
          <UUID>E2</UUID>
          <String><Key>Title</Key><Value>Gmail</Value></String>
          <String><Key>UserName</Key><Value>pablo</Value></String>
          <String><Key>Password</Key><Value Protected="True">gmailpass</Value></String>
          <String><Key>otp</Key><Value>otpauth://totp/x?secret=ABC</Value></String>
          <String><Key>Recovery</Key><Value>codes123</Value></String>
          <History>
            <Entry>
              <UUID>E2OLD</UUID>
              <String><Key>Title</Key><Value>GmailOld</Value></String>
              <String><Key>Password</Key><Value>oldpass</Value></String>
            </Entry>
          </History>
        </Entry>
        <Group>
          <UUID>GPERS</UUID>
          <Name>Personal</Name>
          <Entry>
            <UUID>E3</UUID>
            <String><Key>Title</Key><Value>Nested</Value></String>
          </Entry>
        </Group>
      </Group>
      <Group>
        <UUID>RECYCLE==</UUID>
        <Name>RecycleBin</Name>
        <Entry>
          <UUID>EDEL</UUID>
          <String><Key>Title</Key><Value>Deleted</Value></String>
        </Entry>
      </Group>
    </Group>
  </Root>
</KeePassFile>`;

describe('parseKeepassXml', () => {
    const rows = parseKeepassXml(XML);
    const byTitle = (t: string): ImportRow | undefined => rows.find((r) => r.title === t);

    it('importa solo las entradas reales (sin historial ni papelera)', () => {
        expect(rows).toHaveLength(3);
        expect(byTitle('GmailOld')).toBeUndefined(); // entrada del historial
        expect(byTitle('Deleted')).toBeUndefined(); // entrada en la papelera
    });

    it('la entrada de la raíz queda sin carpeta', () => {
        expect(byTitle('Top')?.group).toBe('');
        expect(byTitle('Top')?.password).toBe('toppass');
    });

    it('asigna la ruta de carpeta de los subgrupos', () => {
        expect(byTitle('Gmail')?.group).toBe('Email');
        expect(byTitle('Nested')?.group).toBe('Email/Personal');
    });

    it('mapea campos estándar, TOTP y campos personalizados', () => {
        const gmail = byTitle('Gmail')!;
        expect(gmail.username).toBe('pablo');
        expect(gmail.password).toBe('gmailpass');
        expect(gmail.totp).toBe('otpauth://totp/x?secret=ABC');
        expect(gmail.customFields).toEqual([{ label: 'Recovery', value: 'codes123', protected: false }]);
    });

    it('rechaza XML inválido', () => {
        expect(() => parseKeepassXml('no soy xml <<<')).toThrow();
    });
});
