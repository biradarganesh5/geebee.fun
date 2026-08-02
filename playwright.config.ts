import { defineConfig, devices } from '@playwright/test';

// Playwright configuration for cross-device integration / e2e coverage.
// Covers timing, responsive sweep (360–2560px), touch targets, reduced-motion,
// and above-the-fold performance criteria (Requirements 8.1, 9.1, 9.5, 10.5).
// Specs live in tests/e2e and run against the Astro preview server.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  // Start the production preview server before running e2e tests.
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 5'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'] } },
  ],
});
