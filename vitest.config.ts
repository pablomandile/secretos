import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
        },
    },
    test: {
        environment: 'node',
        include: ['resources/js/**/*.{test,spec}.ts'],
        // Imprime en consola y además escribe un reporte JSON en cada corrida.
        reporters: ['default', 'json'],
        outputFile: { json: './reports/vitest.json' },
    },
});
