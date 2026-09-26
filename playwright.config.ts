import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  // Own ports and own database: the suite never reuses (or resets) a developer's running servers.
  webServer: [
    {
      command: 'npm run dev:api',
      url: 'http://localhost:3002/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { PORT: '3002', DB_PATH: 'data/e2e.db' },
    },
    {
      command: 'npm run dev:web -- --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_PORT: '3002' },
    },
  ],
})
