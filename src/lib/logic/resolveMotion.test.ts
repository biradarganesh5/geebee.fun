import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { resolveMotion, type MotionKind, type MotionSpec } from './resolveMotion';

// The four motion-based kinds that must never survive a reduced-motion resolve.
const MOTION_KINDS: readonly MotionKind[] = [
  'translate',
  'scale',
  'rotate',
  'parallax',
];

const ALL_KINDS: readonly MotionKind[] = [...MOTION_KINDS, 'fade'];

/**
 * Arbitrary MotionSpec: any kind, with non-negative start delay and duration.
 * `noNaN` keeps durations meaningful; the ceiling is generous so fade capping
 * (values above 200ms) is exercised alongside small values.
 */
const motionSpecArb: fc.Arbitrary<MotionSpec> = fc.record({
  kind: fc.constantFrom(...ALL_KINDS),
  startDelayMs: fc.double({ min: 0, max: 100_000, noNaN: true }),
  durationMs: fc.double({ min: 0, max: 100_000, noNaN: true }),
});

describe('resolveMotion — reduced motion', () => {
  // Feature: portfolio-website, Property 4: Reduced motion collapses all motion animations
  // Validates: Requirements 1.5, 3.5, 4.7, 8.2
  it('Property 4: reduced motion collapses every MotionSpec to non-full immediate/fade', () => {
    fc.assert(
      fc.property(motionSpecArb, (spec) => {
        const resolved = resolveMotion(spec, true);

        // Mode is never the authored full motion.
        expect(resolved.mode).not.toBe('full');
        expect(['fade', 'immediate']).toContain(resolved.mode);

        // Duration collapses to immediate (0) or a capped fade (<=200ms).
        expect(resolved.durationMs).toBeGreaterThanOrEqual(0);
        if (resolved.mode === 'immediate') {
          expect(resolved.durationMs).toBe(0);
        } else {
          expect(resolved.durationMs).toBeLessThanOrEqual(200);
        }

        // A motion-based input kind must never resolve to a motion effect:
        // it collapses to immediate (0ms) rather than any translate/scale/
        // rotate/parallax animation.
        if ((MOTION_KINDS as readonly string[]).includes(spec.kind)) {
          expect(resolved.mode).toBe('immediate');
          expect(resolved.durationMs).toBe(0);
        }
      }),
      { numRuns: 100 },
    );
  });
});
