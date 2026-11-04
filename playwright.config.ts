import { defineConfig } from '@playwright/test';
import { BASE_URL } from './tests/e2e/helpers';

// E2E local: sobe `wrangler dev` (build + API + D1 local) sozinho.
// Contra outra base: PLAYWRIGHT_BASE_URL=https://italosantos.com npx playwright test
// (nesse caso o webServer não sobe e os testes que exigem seed local são pulados).
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    launchOptions: { args: ['--no-sandbox'] },
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run cf:dev',
        url: 'http://127.0.0.1:8799',
        reuseExistingServer: true,
        timeout: 180_000,
      },
  projects: [{ name: 'chromium' }],
});
