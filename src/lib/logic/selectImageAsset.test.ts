import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { selectImageAsset } from './selectImageAsset';

// Feature: portfolio-website, Property 6: Image tier selection matches viewport width boundaries
//
// Validates: Requirements 10.2
//
// For any viewport width, selectImageAsset returns:
//   - 'small'  iff width <= 480
//   - 'medium' iff 481 <= width <= 1024
//   - 'large'  iff width > 1024
describe('selectImageAsset', () => {
  it('returns the tier matching the viewport width boundaries (Property 6)', () => {
    // Arbitrary widths across the full range, biased to include the exact
    // boundary values 480/481/1024/1025 so the boundary logic is exercised.
    const widthArb = fc.oneof(
      { weight: 8, arbitrary: fc.integer({ min: -1000, max: 5000 }) },
      { weight: 1, arbitrary: fc.constantFrom(480, 481, 1024, 1025) },
      // exercise non-integer widths as browsers can report fractional widths
      { weight: 2, arbitrary: fc.double({ min: -1000, max: 5000, noNaN: true }) },
    );

    fc.assert(
      fc.property(widthArb, (width) => {
        const tier = selectImageAsset(width);

        if (width <= 480) {
          expect(tier).toBe('small');
        } else if (width <= 1024) {
          expect(tier).toBe('medium');
        } else {
          expect(tier).toBe('large');
        }
      }),
      { numRuns: 200 },
    );
  });

  it('returns the exact tier at each boundary value', () => {
    expect(selectImageAsset(480)).toBe('small');
    expect(selectImageAsset(481)).toBe('medium');
    expect(selectImageAsset(1024)).toBe('medium');
    expect(selectImageAsset(1025)).toBe('large');
  });
});
