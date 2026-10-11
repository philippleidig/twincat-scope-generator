/**
 * Corpus run (`npm run test:corpus`): imports every real TwinCAT file in `.corpus/` and checks
 * invariants. Separate from `vitest.config.ts` so the regular suite stays fast and offline.
 */
import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['src/catalog/corpus.test.ts'],
        // Always print the summary table (logs of passing tests are hidden otherwise).
        silent: false,
        reporters: ['default'],
        testTimeout: 60_000,
        hookTimeout: 60_000,
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
})
