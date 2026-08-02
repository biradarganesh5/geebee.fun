import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fc from 'fast-check';

// Smoke test verifying the testing infrastructure is wired correctly.
// This validates the Vitest + fast-check + @testing-library/react (jsdom) setup.
// It intentionally exercises no product logic; real logic/component tests are
// added alongside their features in later tasks.

describe('testing infrastructure', () => {
  it('runs a basic Vitest assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('runs a fast-check property (min 100 iterations)', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a;
      }),
      { numRuns: 100 },
    );
  });

  it('renders a React component in jsdom with jest-dom matchers', () => {
    render(<button aria-label="probe">click</button>);
    const el = screen.getByRole('button', { name: 'probe' });
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('aria-label', 'probe');
  });
});
