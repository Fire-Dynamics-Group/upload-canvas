import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    timeout: 120000,
    use: {
        baseURL: 'http://localhost:3003',
        headless: true,
    },
    webServer: {
        command: 'npm run dev -- -p 3003',
        env: { NEXT_DIST_DIR: '.next-e2e' },
        port: 3003,
        reuseExistingServer: true,
        timeout: 180000,
    },
})
