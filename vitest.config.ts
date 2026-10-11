import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        // The real-file corpus runs separately: `npm run test:corpus` (vitest.corpus.config.ts).
        exclude: [...configDefaults.exclude, 'src/catalog/corpus.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['src/test/**', 'src/**/*.d.ts', 'src/main.tsx', 'src/catalog/__fixtures__/**'],
            // Guard against coverage regressions (current: ~90% statements).
            thresholds: { statements: 85, branches: 75, functions: 85, lines: 85 },
        },
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
})
