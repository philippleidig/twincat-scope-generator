import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    {
        ignores: ['dist', 'coverage', 'playwright-report', 'test-results'],
    },
    {
        files: ['**/*.{ts,tsx}'],
        extends: [
            js.configs.recommended,
            ...tseslint.configs.recommended,
            reactHooks.configs.flat['recommended-latest'],
        ],
        languageOptions: {
            ecmaVersion: 2022,
            globals: globals.browser,
        },
    },
    {
        files: ['src/**/*.tsx'],
        extends: [reactRefresh.configs.vite],
    },
    {
        files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'tests/**'],
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
        },
    },
    {
        files: ['*.config.{js,ts}', 'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts'],
        languageOptions: {
            globals: globals.node,
        },
    },
)
