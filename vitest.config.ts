/// <reference types="vitest" />
import { getViteConfig } from 'astro/config';
import react from '@vitejs/plugin-react';

// Vitest configuration for the Portfolio_Site.
// - Uses Astro's getViteConfig so the tsconfig path aliases (@logic, @content, …)
//   and Astro's Vite pipeline are available inside tests.
// - jsdom environment powers @testing-library/react component tests.
// - fast-check property tests run in the same suite (min. 100 iterations each,
//   configured per-test via fc.assert numRuns).
// - Playwright e2e specs (tests/e2e) are excluded here; they run via `test:e2e`.
export default getViteConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/unit/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**', '.astro/**'],
    css: true,
  },
});
