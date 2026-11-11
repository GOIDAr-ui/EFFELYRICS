import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 940 }, launchOptions: process.env.AURORA_CHROMIUM ? { executablePath: process.env.AURORA_CHROMIUM } : {}, trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev:web', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
});
