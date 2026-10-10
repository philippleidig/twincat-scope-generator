import { defineConfig, devices } from '@playwright/test'

// The app is served below the GitHub Pages base path (see vite.config.ts).
const BASE_URL = 'http://localhost:5173/twincat-scope-generator/'

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: BASE_URL,
        trace: 'on-first-retry',
        // Use a preinstalled browser when one is provided (e.g. in sandboxes without downloads).
        launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
    ],
    webServer: {
        command: 'npm run dev -- --port 5173 --strictPort',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
    },
})
