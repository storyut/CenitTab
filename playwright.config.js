import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 10000,
  use: {
    baseURL: 'http://localhost:3999',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx http-server -p 3999 -c-1 .',
    url: 'http://localhost:3999',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
