import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    timeout: 120000,
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3003',
        headless: true,
    },
    webServer: process.env.PLAYWRIGHT_BASE_URL
        ? undefined
        : {
            command: 'npm run dev -- -p 3003',
            env: {
                NEXT_DIST_DIR: '.next-e2e',
                NEXT_PUBLIC_AUTH_DISABLED: 'true',
            },
            port: 3003,
            reuseExistingServer: true,
            timeout: 180000,
        },
})
