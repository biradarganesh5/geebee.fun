import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  computeBodyFontSize,
  MIN_VIEWPORT_PX,
  MAX_VIEWPORT_PX,
  MIN_ACCESSIBLE_FONT_PX,
} from './fluidTypography';

/**
 * Property-based test for `computeBodyFontSize` (fluid body typography).
 *
 * Validates Design Property 7 from the portfolio-website design:
 * - Property 7: the computed body font size never drops below the 14px
 *   accessibility floor across the supported viewport range [360, 2560].
 *
 * fast-check drives the input space; the property runs >= 100 iterations.
 */

const MIN_RUNS = 100;

// Arbitrary viewport widths across the supported range [360, 2560] inclusive.
const viewportWidthArb = (): fc.Arbitrary<number> =>
  fc.double({
    min: MIN_VIEWPORT_PX,
    max: MAX_VIEWPORT_PX,
    noNaN: true,
    noDefaultInfinity: true,
  });

describe('computeBodyFontSize', () => {
  // Feature: portfolio-website, Property 7: Fluid body typography never drops below 14px
  // Validates: Requirements 9.2
  it('Property 7: never drops below the 14px accessibility floor', () => {
    fc.assert(
      fc.property(viewportWidthArb(), (viewportWidth) => {
        expect(computeBodyFontSize(viewportWidth)).toBeGreaterThanOrEqual(
          MIN_ACCESSIBLE_FONT_PX,
        );
      }),
      { numRuns: MIN_RUNS },
    );
  });
});
