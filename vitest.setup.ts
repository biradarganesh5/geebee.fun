// Global test setup for Vitest.
// Extends `expect` with @testing-library/jest-dom matchers (toBeVisible,
// toHaveAttribute, …) used by component/interaction tests, and ensures the
// DOM is cleaned up between tests.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
