// Regenera database/seeders/demo/boveda.json cifrando resources/js/demo/bovedaDemo.ts
// con la contraseña de la demo. Uso: node scripts/generar-boveda-demo.mjs [contraseña]
// (por defecto, la misma que el default de config/demo.php).
import { writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'vite';

const password = process.argv[2] ?? 'demo1234';

const server = await createServer({
    configFile: 'vitest.config.ts',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'error',
});
try {
    const { cifrarBovedaDemo, ENTRADAS_DEMO } = await server.ssrLoadModule('/resources/js/demo/bovedaDemo.ts');
    const boveda = await cifrarBovedaDemo(password);
    mkdirSync('database/seeders/demo', { recursive: true });
    writeFileSync('database/seeders/demo/boveda.json', JSON.stringify(boveda, null, 2) + '\n');
    console.log(`boveda.json: ${ENTRADAS_DEMO.length} entradas, ${boveda.folders.length} carpetas, ${boveda.tags.length} etiquetas`);
} finally {
    await server.close();
}
