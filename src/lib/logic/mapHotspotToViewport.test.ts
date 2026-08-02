import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  mapHotspotToViewport,
  type Box,
  type FocalPoint,
  type NormalizedPoint,
} from './mapHotspotToViewport';

// Feature: portfolio-website, Property 3: Hotspots project inside the rendered image box
//
// Validates: Requirements 2.1, 2.7
//
// For any hotspot authored as a normalized coordinate in [0,1]x[0,1], any
// intrinsic image size, any display box (positive dims), and any focal point in
// [0,1]x[0,1], mapHotspotToViewport returns a pixel point that lies within the
// bounds of the rendered (cover-fit) image box:
//   x in [offsetX, offsetX + renderedWidth]
//   y in [offsetY, offsetY + renderedHeight]
// This keeps every hotspot (PC, soldering station, ...) reachable by pointer,
// touch, and keyboard on every viewport.

/** Recomputes the same cover-fit box the projection uses, for assertion. */
function coverFitBounds(intrinsic: Box, box: Box, focal: FocalPoint) {
  const scale = Math.max(box.width / intrinsic.width, box.height / intrinsic.height);
  const renderedWidth = intrinsic.width * scale;
  const renderedHeight = intrinsic.height * scale;
  const offsetX = focal.x * (box.width - renderedWidth);
  const offsetY = focal.y * (box.height - renderedHeight);
  return { offsetX, offsetY, renderedWidth, renderedHeight };
}

describe('mapHotspotToViewport', () => {
  it('projects normalized hotspots inside the rendered image box (Property 3)', () => {
    // Sensible numeric bounds avoid float overflow while covering realistic
    // intrinsic sizes, viewport boxes, and normalized coordinates.
    const normArb: fc.Arbitrary<NormalizedPoint> = fc.record({
      x: fc.double({ min: 0, max: 1, noNaN: true }),
      y: fc.double({ min: 0, max: 1, noNaN: true }),
    });
    const dimArb = fc.double({ min: 1, max: 10000, noNaN: true });
    const boxArb: fc.Arbitrary<Box> = fc.record({ width: dimArb, height: dimArb });
    const focalArb: fc.Arbitrary<FocalPoint> = fc.record({
      x: fc.double({ min: 0, max: 1, noNaN: true }),
      y: fc.double({ min: 0, max: 1, noNaN: true }),
    });

    const EPSILON = 1e-6;

    fc.assert(
      fc.property(normArb, boxArb, boxArb, focalArb, (norm, intrinsic, box, focal) => {
        const point = mapHotspotToViewport(norm, intrinsic, box, focal);
        const { offsetX, offsetY, renderedWidth, renderedHeight } = coverFitBounds(
          intrinsic,
          box,
          focal,
        );

        // Tolerance scales with the rendered dimension so large images (where
        // floating point granularity is coarser) do not produce spurious
        // failures at the boundaries.
        const tolX = EPSILON * (1 + Math.abs(renderedWidth));
        const tolY = EPSILON * (1 + Math.abs(renderedHeight));

        expect(point.x).toBeGreaterThanOrEqual(offsetX - tolX);
        expect(point.x).toBeLessThanOrEqual(offsetX + renderedWidth + tolX);
        expect(point.y).toBeGreaterThanOrEqual(offsetY - tolY);
        expect(point.y).toBeLessThanOrEqual(offsetY + renderedHeight + tolY);
      }),
      { numRuns: 200 },
    );
  });

  it('maps corners and center to the expected rendered-box positions', () => {
    const intrinsic: Box = { width: 3000, height: 3878 };
    const box: Box = { width: 800, height: 600 };
    const focal: FocalPoint = { x: 0.5, y: 0.125 };
    const { offsetX, offsetY, renderedWidth, renderedHeight } = coverFitBounds(
      intrinsic,
      box,
      focal,
    );

    const topLeft = mapHotspotToViewport({ x: 0, y: 0 }, intrinsic, box, focal);
    expect(topLeft.x).toBeCloseTo(offsetX);
    expect(topLeft.y).toBeCloseTo(offsetY);

    const bottomRight = mapHotspotToViewport({ x: 1, y: 1 }, intrinsic, box, focal);
    expect(bottomRight.x).toBeCloseTo(offsetX + renderedWidth);
    expect(bottomRight.y).toBeCloseTo(offsetY + renderedHeight);

    const center = mapHotspotToViewport({ x: 0.5, y: 0.5 }, intrinsic, box, focal);
    expect(center.x).toBeCloseTo(offsetX + renderedWidth / 2);
    expect(center.y).toBeCloseTo(offsetY + renderedHeight / 2);
  });
});
