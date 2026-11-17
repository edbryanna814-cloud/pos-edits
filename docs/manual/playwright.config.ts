import { defineConfig } from '@playwright/test'

// Manual screenshots only; not part of the test suite.
export default defineConfig({ testDir: '.', testMatch: 'shoot.spec.ts', timeout: 300_000, workers: 1, reporter: [['list']] })
