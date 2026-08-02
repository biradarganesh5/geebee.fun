import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  computeCoverTransform,
  type Box,
  type FocalPoint,
} from './computeCoverTransform';

/**
 * Property-based tests for `computeCoverTransform` (pure cover-fit geometry).
 *
 * These validate Design Properties 1 and 2 from the portfolio-website design:
 * - Property 1: cover-fit preserves the intrinsic aspect ratio (no skew).
 * - Property 2: cover-fit fully covers the box with non-positive offsets and
 *   keeps the focal point visible inside the box.
 *
 * fast-check drives the input space; each property runs >= 100 iterations.
 */

const MIN_RUNS = 100;

// Sensible positive bounds keep generated products (width * scale) well within
// double precision so comparisons are not dominated by floating-point overflow.
const dimension = () =>
  fc.double({
    min: 1,
    max: 100_000,
    noNaN: true,
    noDefaultInfinity: true,
  });

const boxArb = (): fc.Arbitrary<Box> =>
  fc.record({ width: dimension(), height: dimension() });

const intrinsicArb = (): fc.Arbitrary<Box> =>
  fc.record({ width: dimension(), height: dimension() });

// The Hero_Image focal point (horizontal center, top 25%) per Requirement 1.3.
const HERO_FOCAL: FocalPoint = { x: 0.5, y: 0.125 };

const focalArb = (): fc.Arbitrary<FocalPoint> =>
  fc.oneof(
    fc.constant(HERO_FOCAL),
    fc.record({
      x: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
      y: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
    }),
  );

describe('computeCoverTransform', () => {
  // Feature: portfolio-website, Property 1: Cover-fit preserves aspect ratio
  // Validates: Requirements 1.2
  it('Property 1: preserves the intrinsic aspect ratio (no skew)', () => {
    fc.assert(
      fc.property(intrinsicArb(), boxArb(), focalArb(), (intrinsic, box, focal) => {
        const { renderedWidth, renderedHeight } = computeCoverTransform(
          intrinsic,
          box,
          focal,
        );

        // A single uniform scale means the rendered ratio equals the intrinsic
        // ratio. Compare with a small relative epsilon to absorb float error.
        const renderedRatio = renderedWidth / renderedHeight;
        const intrinsicRatio = intrinsic.width / intrinsic.height;

        const relativeError =
          Math.abs(renderedRatio - intrinsicRatio) / intrinsicRatio;

        expect(relativeError).toBeLessThanOrEqual(1e-9);
      }),
      { numRuns: MIN_RUNS },
    );
  });

  // Feature: portfolio-website, Property 2: Cover-fit fully covers the box with the focal point visible
  // Validates: Requirements 1.3
  it('Property 2: fully covers the box with the focal point visible', () => {
    fc.assert(
      fc.property(intrinsicArb(), boxArb(), focalArb(), (intrinsic, box, focal) => {
        const { offsetX, offsetY, renderedWidth, renderedHeight } =
          computeCoverTransform(intrinsic, box, focal);

        // Relative epsilon scaled to the box magnitude for coverage checks.
        const epsX = box.width * 1e-9;
        const epsY = box.height * 1e-9;

        // Coverage: rendered image spans the box in both axes (no gaps).
        expect(renderedWidth).toBeGreaterThanOrEqual(box.width - epsX);
        expect(renderedHeight).toBeGreaterThanOrEqual(box.height - epsY);

        // Non-positive offsets: the box origin sits within the image.
        expect(offsetX).toBeLessThanOrEqual(epsX);
        expect(offsetY).toBeLessThanOrEqual(epsY);

        // Focal visibility: the focal point projects to a screen coordinate
        // inside [0, box.width] x [0, box.height].
        const focalScreenX = offsetX + focal.x * renderedWidth;
        const focalScreenY = offsetY + focal.y * renderedHeight;

        expect(focalScreenX).toBeGreaterThanOrEqual(-epsX);
        expect(focalScreenX).toBeLessThanOrEqual(box.width + epsX);
        expect(focalScreenY).toBeGreaterThanOrEqual(-epsY);
        expect(focalScreenY).toBeLessThanOrEqual(box.height + epsY);
      }),
      { numRuns: MIN_RUNS },
    );
  });
});
