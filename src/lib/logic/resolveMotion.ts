/**
 * The kinds of motion an animation can request.
 *
 * `translate`, `scale`, `rotate`, and `parallax` are motion-based effects that
 * must be collapsed when a reduced-motion preference is set. `fade` is an
 * opacity-only effect that is preserved (but capped) under reduced motion.
 */
export type MotionKind = 'translate' | 'scale' | 'rotate' | 'parallax' | 'fade';

/**
 * A requested animation, authored without regard to the visitor's motion
 * preference.
 */
export interface MotionSpec {
  kind: MotionKind;
  startDelayMs: number;
  durationMs: number;
}

/**
 * The resolved animation the engine will actually run after accounting for the
 * visitor's reduced-motion preference.
 *
 * - `full`      — run the requested motion as authored.
 * - `fade`      — opacity-only transition, `durationMs` capped to <=200ms.
 * - `immediate` — snap to the final state with `durationMs` === 0.
 */
export interface ResolvedMotion {
  mode: 'full' | 'fade' | 'immediate';
  /** 0 for immediate; <=200 for fade. */
  durationMs: number;
  startDelayMs: number;
}

/**
 * Maximum duration (ms) allowed for a fade-only transition under reduced motion.
 * Req 8.2: fade-only replacements must complete within 200ms.
 */
const MAX_REDUCED_FADE_MS = 200;

/**
 * Resolves a requested {@link MotionSpec} against the visitor's reduced-motion
 * preference.
 *
 * Req 8.2 / 1.5 / 3.5 / 4.7: WHILE a reduced-motion preference is set, all
 * motion-based animations (translate/scale/rotate/parallax) are replaced with
 * either an immediate transition (0ms) or a fade-only transition completing
 * within 200ms.
 *
 * Policy:
 * - When `prefersReducedMotion` is false, the requested motion is returned
 *   unchanged as `mode: 'full'`, preserving the authored duration and delay.
 * - When `prefersReducedMotion` is true:
 *   - a `fade` spec collapses to a capped fade (`mode: 'fade'`,
 *     `durationMs` = min(requested, 200)), preserving the start delay.
 *   - every true-motion kind (translate/scale/rotate/parallax) collapses to an
 *     immediate transition (`mode: 'immediate'`, `durationMs` = 0,
 *     `startDelayMs` = 0).
 *
 * @param spec - The authored animation request.
 * @param prefersReducedMotion - Whether the visitor prefers reduced motion.
 * @returns The {@link ResolvedMotion} the engine should run.
 */
export function resolveMotion(
  spec: MotionSpec,
  prefersReducedMotion: boolean
): ResolvedMotion {
  if (!prefersReducedMotion) {
    return {
      mode: 'full',
      durationMs: spec.durationMs,
      startDelayMs: spec.startDelayMs,
    };
  }

  if (spec.kind === 'fade') {
    return {
      mode: 'fade',
      durationMs: Math.max(0, Math.min(spec.durationMs, MAX_REDUCED_FADE_MS)),
      startDelayMs: spec.startDelayMs,
    };
  }

  // translate / scale / rotate / parallax -> immediate apply-final-state.
  return {
    mode: 'immediate',
    durationMs: 0,
    startDelayMs: 0,
  };
}
