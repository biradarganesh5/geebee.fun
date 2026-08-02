/**
 * AgeCounter — a live, fractional "age" readout with a rolling/odometer digit
 * animation (React island).
 *
 * Reimplements the inspiration site's NumberFlow age counter. The inspiration
 * uses `@number-flow/svelte`; this is the same effect built on the official
 * React port, `@number-flow/react` (by the same author). The author's age is
 * computed as a fractional number of years and pushed into <NumberFlow> several
 * times per second so the trailing decimals visibly roll upward
 * (e.g. "25.1234567890 years old").
 *
 * Age is derived exactly like the inspiration:
 *
 *     age = (Date.now() - birthday) / 31_557_600_000
 *
 * where `31557600000` is the number of milliseconds in an (average Julian)
 * year, so the value is a plain fractional count of years. The number is
 * formatted with `minimumFractionDigits`/`maximumFractionDigits` = 10, matching
 * the inspiration, and the value ticks on an interval (~every 100ms).
 *
 * Progressive enhancement + SSR safety:
 *  - The initial value is computed synchronously (server + first client paint)
 *    from the birthday, so a no-JS / pre-hydration visitor sees a real age.
 *  - <NumberFlow> is SSR-safe: server-side it renders a static fallback of the
 *    formatted number (never crashing during SSR/hydration in Astro) and only
 *    begins animating after hydration. The ticking `setInterval` is installed
 *    on mount and cleared on unmount.
 *
 * Reduced motion:
 *  - Under `prefers-reduced-motion: reduce` the fast ticking interval is NOT
 *    started and <NumberFlow> is NOT rendered. Instead a calm, low-precision
 *    static age (a single decimal place) is shown, so the UI is not a
 *    constantly-moving or animating number. <NumberFlow> also honours reduced
 *    motion via `respectMotionPreference` as a second line of defence.
 *
 * Accessibility:
 *  - A stable, visually hidden (`sr-only`) "N years old" sentence carries the
 *    whole-years value as calm, announce-once text for screen readers.
 *  - The visible, rapidly-changing number is `aria-hidden`, so assistive tech
 *    is not spammed with an announcement several times per second. Digits use
 *    `tabular-nums` so the layout does not jitter as they roll. Color is
 *    inherited from the surrounding (muted) row via theme tokens.
 */
import { useEffect, useRef, useState } from 'react';
import NumberFlow from '@number-flow/react';

import { profile } from '../content/profile';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * Milliseconds in one (average Julian) year — the divisor that turns an elapsed
 * millisecond span into a fractional count of years. Matches the inspiration.
 */
export const MS_PER_YEAR = 31_557_600_000;

/** Default number of decimal places of the fractional age to display live. */
export const AGE_FRACTION_DIGITS = 10;

/** Decimal places shown when motion is reduced (a calm, near-static value). */
export const REDUCED_FRACTION_DIGITS = 1;

/** Ticking cadence in milliseconds (~10 updates per second, per the inspiration). */
export const TICK_INTERVAL_MS = 100;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Fractional age in years for a given ISO birthday at time `now`.
 *
 * @param birthday ISO `YYYY-MM-DD` date string.
 * @param now Epoch milliseconds to measure against (defaults to `Date.now()`).
 */
export function computeAge(birthday: string, now: number = Date.now()): number {
  return (now - new Date(birthday).getTime()) / MS_PER_YEAR;
}

/** Formats a fractional age with a fixed number of decimals (padded, stable width). */
export function formatAge(
  age: number,
  fractionDigits: number = AGE_FRACTION_DIGITS,
): string {
  return age.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: false,
  });
}

/** SSR-safe live reduced-motion lookup. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// -----------------------------------------------------------------------------
// Props + component
// -----------------------------------------------------------------------------

export interface AgeCounterProps {
  /** ISO `YYYY-MM-DD` birthday. Defaults to the profile's birthday. */
  birthday?: string;
  /** Decimal places for the live value. Defaults to {@link AGE_FRACTION_DIGITS}. */
  fractionDigits?: number;
  /** Extra classes for the wrapper span. */
  className?: string;
}

export default function AgeCounter({
  birthday = profile.birthday,
  fractionDigits = AGE_FRACTION_DIGITS,
  className = '',
}: AgeCounterProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialise from the birthday so SSR / first paint / no-JS show a real age
  // (and the server + client first render agree, keeping hydration stable).
  const [age, setAge] = useState<number>(() => computeAge(birthday));

  // When reduced motion is preferred we render a calm static age and never
  // start the fast interval or mount <NumberFlow>. Resolved after mount so SSR
  // stays neutral (server renders the animated path's static fallback).
  const [reduced, setReduced] = useState<boolean>(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      // Calm, static value — do NOT start ticking and do NOT animate.
      setReduced(true);
      setAge(computeAge(birthday));
      return;
    }

    setReduced(false);

    // Start ticking after mount so the digits visibly roll (~every 100ms).
    intervalRef.current = setInterval(() => {
      setAge(computeAge(birthday));
    }, TICK_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [birthday]);

  // Stable whole-years value for assistive tech (announced calmly, once).
  const wholeYears = Math.floor(age);

  return (
    <span
      data-testid="age-counter"
      className={`inline-flex items-center gap-1.5 ${className}`.trim()}
    >
      {/* Calm, announce-once text for screen readers. */}
      <span className="sr-only">{wholeYears} years old</span>

      {/* Visible, rapidly-changing readout — hidden from assistive tech. */}
      <span aria-hidden="true" className="inline-flex items-center gap-1.5">
        {reduced ? (
          // Reduced motion: a calm, low-precision static value (no animation).
          <span data-testid="age-counter-value" className="tabular-nums">
            {formatAge(age, REDUCED_FRACTION_DIGITS)}
          </span>
        ) : (
          // Rolling odometer digits via the official NumberFlow React port.
          <NumberFlow
            data-testid="age-counter-value"
            className="tabular-nums"
            value={age}
            respectMotionPreference
            format={{
              minimumFractionDigits: fractionDigits,
              maximumFractionDigits: fractionDigits,
              useGrouping: false,
            }}
          />
        )}
        <span>years old</span>
      </span>
    </span>
  );
}
