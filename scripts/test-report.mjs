/**
 * Corre ambas suites y genera reportes JSON en reports/:
 *   - reports/vitest.json   (frontend/crypto, lo escribe el reporter de Vitest)
 *   - reports/phpunit.json  (backend, convertido desde JUnit XML)
 *   - reports/summary.json  (totales combinados + ok)
 *
 *   npm run test:report
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { junitXmlToJson } from './junit-to-json.mjs';

mkdirSync('reports', { recursive: true });

function run(cmd, args) {
    const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
    return result.status ?? 1;
}

function runVitest() {
    return run('npx', ['vitest', 'run', '--config', 'vitest.config.ts']);
}

console.log('\n=== Vitest (frontend / crypto) ===');
let vitestStatus = runVitest();

// Vitest 4 a veces falla la carga y reporta 0 tests pese a detectar las suites;
// reintentamos una vez para que el reporte sea confiable.
if (existsSync('reports/vitest.json')) {
    const raw = JSON.parse(readFileSync('reports/vitest.json', 'utf8'));
    if ((raw.numTotalTests ?? 0) === 0 && (raw.numTotalTestSuites ?? 0) > 0) {
        console.log('\n(Vitest cargó 0 tests; reintentando una vez…)');
        vitestStatus = runVitest();
    }
}

console.log('\n=== PHPUnit (backend) ===');
const phpunitStatus = run('php', ['artisan', 'test', '--log-junit', 'reports/phpunit.junit.xml']);

// Backend: JUnit XML → JSON
let phpunit = null;
if (existsSync('reports/phpunit.junit.xml')) {
    phpunit = junitXmlToJson(readFileSync('reports/phpunit.junit.xml', 'utf8'));
    writeFileSync('reports/phpunit.json', JSON.stringify(phpunit, null, 2));
}

// Frontend: lo escribe la config de Vitest (formato tipo Jest).
let vitest = null;
if (existsSync('reports/vitest.json')) {
    const raw = JSON.parse(readFileSync('reports/vitest.json', 'utf8'));
    vitest = {
        total: raw.numTotalTests ?? 0,
        passed: raw.numPassedTests ?? 0,
        failed: raw.numFailedTests ?? 0,
        pending: raw.numPendingTests ?? 0,
    };
}

const summary = {
    generatedAt: new Date().toISOString(),
    ok: vitestStatus === 0 && phpunitStatus === 0,
    vitest,
    phpunit: phpunit?.summary ?? null,
};
writeFileSync('reports/summary.json', JSON.stringify(summary, null, 2));

console.log('\n=== Reportes JSON generados ===');
console.log('  reports/vitest.json');
console.log('  reports/phpunit.json');
console.log('  reports/summary.json\n');
console.log(JSON.stringify(summary, null, 2));

process.exit(summary.ok ? 0 : 1);
