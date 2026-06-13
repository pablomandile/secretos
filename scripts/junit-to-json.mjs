/**
 * Convierte el reporte JUnit XML de PHPUnit a JSON.
 *   node scripts/junit-to-json.mjs [entrada.xml] [salida.json]
 * Por defecto: reports/phpunit.junit.xml → reports/phpunit.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const input = process.argv[2] ?? 'reports/phpunit.junit.xml';
const output = process.argv[3] ?? 'reports/phpunit.json';

export function junitXmlToJson(xml) {
    const tests = [];
    const summary = { total: 0, passed: 0, failed: 0, errors: 0, skipped: 0, time: 0 };

    const caseRe = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
    let m;
    while ((m = caseRe.exec(xml)) !== null) {
        const attrsRaw = m[1];
        const inner = m[2] ?? '';
        const attrs = {};
        for (const a of attrsRaw.matchAll(/([\w:-]+)="([^"]*)"/g)) {
            attrs[a[1]] = a[2];
        }

        let status = 'passed';
        if (/<error\b/.test(inner)) status = 'error';
        else if (/<failure\b/.test(inner)) status = 'failed';
        else if (/<skipped\b/.test(inner)) status = 'skipped';

        const msgMatch = inner.match(/<(?:failure|error|skipped)\b[^>]*>([\s\S]*?)<\/(?:failure|error|skipped)>/);
        const message = msgMatch ? decodeXml(msgMatch[1].trim()).split('\n')[0].slice(0, 300) : undefined;

        const time = Number(attrs.time ?? 0);
        summary.total += 1;
        summary.time += Number.isFinite(time) ? time : 0;
        if (status === 'passed') summary.passed += 1;
        else if (status === 'failed') summary.failed += 1;
        else if (status === 'error') summary.errors += 1;
        else if (status === 'skipped') summary.skipped += 1;

        tests.push({
            name: attrs.name,
            class: attrs.class ?? attrs.classname,
            status,
            time,
            ...(message ? { message } : {}),
        });
    }

    summary.time = Number(summary.time.toFixed(3));
    return { summary, tests };
}

function decodeXml(s) {
    return s
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

// Ejecutado directamente (no importado).
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
    if (!existsSync(input)) {
        console.error(`No existe ${input}. Corré primero la suite PHPUnit.`);
        process.exit(1);
    }
    const json = junitXmlToJson(readFileSync(input, 'utf8'));
    writeFileSync(output, JSON.stringify(json, null, 2));
    console.log(`PHPUnit → ${output} (${json.summary.passed}/${json.summary.total} OK)`);
}
