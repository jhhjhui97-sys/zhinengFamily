import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  // The mock FastAPI intentionally keeps mutable CRUD state for end-to-end flows.
  // Run files serially so independent scenarios cannot mutate that shared fixture.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL } }],
  webServer: [
    { command: 'node tests/mock-api.mjs', url: 'http://127.0.0.1:8765/auth/me', reuseExistingServer: false, timeout: 30_000 },
    { command: process.env.PLAYWRIGHT_PRODUCTION ? 'npm run start' : 'npm run dev', url: 'http://127.0.0.1:3000', reuseExistingServer: false, timeout: 120_000, env: { API_BASE_URL: 'http://127.0.0.1:8765' } },
  ],
});
