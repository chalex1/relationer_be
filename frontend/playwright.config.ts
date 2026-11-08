import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4173', channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true, viewport: { width: 1440, height: 960 }, contextOptions: { reducedMotion: 'reduce' } },
  webServer: { command: 'npm run dev -- --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
  reporter: 'list',
})
