import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: [
    // A separate database for tests: running the suite never touches the development data.
    { command: 'npm run dev:api', url: 'http://localhost:3001/api/health', reuseExistingServer: true, timeout: 120_000, env: { DB_PATH: 'data/e2e.db' } },
    { command: 'npm run dev:web', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 120_000 },
  ],
})
