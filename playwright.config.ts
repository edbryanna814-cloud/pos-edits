import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  // Vitest owns tests/unit/*.test.ts; Playwright runs only the E2E specs.
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure'
  }
})
