/**
 * StatCounters — animated headline statistics for the Resume_Section (React island).
 *
 * Renders a compact row of career-highlight numbers (microservices migrated,
 * recurring cloud savings, deploy-time reduction, years of experience) that
 * roll up from 0 to their final value with an ease-out `requestAnimationFrame`
 * count-up. The count-up is triggered the first time the row scrolls into view
 * (via `IntersectionObserver`) and then the numbers stay at their final value.
 *
 * Designed to be dropped inside the existing `<section id="resume">` landmark
 * whose `h2#resume-heading` is already rendered by the static shell, so it owns
 * neither the landmark nor the heading — it renders the stat row only.
 *
 * Accessibility + progressive enhancement:
 *  - The FINAL numeric value is what renders server-side and on first paint, so
 *    a no-JS visitor always sees the real number (never a stuck 0). The island
 *    only resets to 0 and animates up AFTER it hydrates and becomes visible.
 *  - Each visible number + label is `aria-hidden` (it changes rapidly while
 *    animating, which would be noisy for screen readers). A single visually
 *    hidden `sr-only` sentence per stat carries the final value + label as
 *    stable text for assistive tech.
 *  - Under `prefers-reduced-motion: reduce` the count-up is skipped entirely and
 *    the final value is shown immediately.
 *
 * The numbers are data (a small typed array below). This island is display-only
 * — no interaction or activation targets.
 */
import { useEffect, useRef, useState } from 'react';

// -----------------------------------------------------------------------------
// Data
// -----------------------------------------------------------------------------

/** A single animated headline statistic. */
export interface Stat {
  /** The final value the number counts up to. */
  value: number;
  /** Text rendered immediately before the number (e.g. "$"). */
  prefix?: string;
  /** Text rendered immediately after the number (e.g. "+", "%", "K+/yr"). */
  suffix?: string;
  /** Short description shown beneath the number. */
  label: string;
}

/**
 * Career-highlight stats, derived faithfully from the resume achievements:
 *  - 25+ microservices migrated ECS -> EKS
 *  - $24K+/yr recurring cloud savings
 *  - up to 80% faster deployments
 *  - 3+ years of DevOps experience
 */
export const defaultStats: Stat[] = [
  { value: 25, suffix: '+', label: 'microservices migrated ECS\u00a0\u2192\u00a0EKS' },
  { value: 24, prefix: '$', suffix: 'K+', label: 'per year saved in cloud costs' },
  { value: 80, suffix: '%', label: 'faster deployments' },
  { value: 3, suffix: '+', label: 'years of DevOps experience' },
];

/** Total count-up duration in milliseconds. */
const DURATION_MS = 1200;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** SSR-safe live reduced-motion lookup. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Formats a (possibly mid-animation) value with its prefix/suffix. */
function formatStat(stat: Stat, value: number): string {
  return `${stat.prefix ?? ''}${Math.round(value)}${stat.suffix ?? ''}`;
}

// easeOutCubic — fast start, gentle settle onto the final value.
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

// -----------------------------------------------------------------------------
// Props + component
// -----------------------------------------------------------------------------

export interface StatCountersProps {
  /** Stats to animate. Defaults to the resume-derived highlights. */
  stats?: Stat[];
}

export default function StatCounters({ stats = defaultStats }: StatCountersProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Initialise to the FINAL values so SSR / first paint / no-JS show the real
  // numbers. This also matches the server markup, avoiding a hydration mismatch.
  const [values, setValues] = useState<number[]>(() => stats.map((s) => s.value));

  useEffect(() => {
    const finals = stats.map((s) => s.value);

    // Reduced motion: never animate — keep the final values on screen.
    if (prefersReducedMotion()) {
      setValues(finals);
      return;
    }

    let started = false;

    const runCountUp = () => {
      if (started) return;
      started = true;

      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION_MS);
        const eased = easeOut(t);
        setValues(finals.map((v) => v * eased));
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          // Snap to exact finals so rounding never leaves us a hair short.
          setValues(finals);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    // Now that we're hydrated, reset to 0 and count up once visible.
    setValues(finals.map(() => 0));

    const el = rootRef.current;

    // Without IntersectionObserver (older engines / test env) just animate now.
    if (el === null || typeof IntersectionObserver === 'undefined') {
      runCountUp();
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          runCountUp();
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // Stats are static content; animate once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rootRef}
      data-testid="stat-counters"
      role="list"
      aria-label="Career highlights"
      className="mt-8 grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4"
    >
      {stats.map((stat, index) => (
        <div key={stat.label} role="listitem" className="flex flex-col">
          {/* Stable, final text for assistive tech (the visible number is
              aria-hidden because it changes rapidly while animating). */}
          <span className="sr-only">
            {formatStat(stat, stat.value)} {stat.label}
          </span>

          <span
            aria-hidden="true"
            className="inline-block whitespace-nowrap bg-gradient-to-br from-sky-300 to-sky-500 bg-clip-text pr-1 text-3xl font-bold leading-tight tabular-nums text-transparent md:text-4xl"
          >
            {formatStat(stat, values[index] ?? stat.value)}
          </span>
          <span
            aria-hidden="true"
            className="mt-2 text-sm leading-snug text-muted-foreground md:text-base"
          >
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}
