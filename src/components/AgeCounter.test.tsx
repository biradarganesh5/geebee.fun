import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

import AgeCounter, {
  computeAge,
  formatAge,
  MS_PER_YEAR,
  REDUCED_FRACTION_DIGITS,
  TICK_INTERVAL_MS,
} from './AgeCounter';

/**
 * Unit tests for the AgeCounter island.
 *
 * The island computes a fractional age in years from an ISO birthday and, once
 * mounted (and only when motion is allowed), ticks ~10x/second, pushing the new
 * value into a <NumberFlow> so the digits roll (the "odometer" effect). The
 * INITIAL value is computed synchronously (SSR / first paint), a stable
 * "N years old" sentence is exposed to assistive tech, and under reduced motion
 * a calm single-decimal STATIC age is shown (no NumberFlow, no interval).
 *
 * NumberFlow renders a custom `<number-flow-react>` element. Rather than scrape
 * the animated digit DOM, these tests read the value NumberFlow was handed via
 * its serialized `data` attribute (which carries the exact numeric value), so
 * the assertions are robust to the animation internals.
 */

/** Installs a matchMedia stub returning `reduced` for the reduced-motion query. */
function stubMatchMedia(reduced: boolean) {
  const mql = {
    matches: reduced,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => mql),
  );
}

/**
 * Reads the value NumberFlow is currently rendering from its serialized `data`
 * attribute. Returns `null` when NumberFlow is not mounted (reduced motion).
 */
function readNumberFlowValue(container: HTMLElement): number | null {
  const el = container.querySelector('number-flow-react');
  if (!el) return null;
  const raw = el.getAttribute('data');
  if (!raw) return null;
  return Number(JSON.parse(raw).value);
}

/** Reads the fixed-precision string NumberFlow is rendering (its `valueAsString`). */
function readNumberFlowString(container: HTMLElement): string | null {
  const el = container.querySelector('number-flow-react');
  if (!el) return null;
  const raw = el.getAttribute('data');
  if (!raw) return null;
  return String(JSON.parse(raw).valueAsString);
}

const FIXED_BIRTHDAY = '1999-08-22';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  cleanup();
});

describe('AgeCounter — value + formula', () => {
  it('computeAge matches (now - birthday) / MS_PER_YEAR', () => {
    const now = Date.UTC(2024, 0, 1);
    const expected = (now - new Date(FIXED_BIRTHDAY).getTime()) / MS_PER_YEAR;
    expect(computeAge(FIXED_BIRTHDAY, now)).toBe(expected);
  });

  it('formatAge renders a fixed number of decimal places', () => {
    expect(formatAge(24.5, 10)).toBe('24.5000000000');
    expect(formatAge(24.123456789012, 10)).toBe('24.1234567890');
  });

  it('renders without crashing and feeds a plausible age into NumberFlow', () => {
    stubMatchMedia(false);
    const { container } = render(<AgeCounter birthday={FIXED_BIRTHDAY} />);

    // The wrapper is present and the animated NumberFlow element mounted.
    expect(screen.getByTestId('age-counter')).toBeInTheDocument();
    const rendered = readNumberFlowValue(container);
    expect(rendered).not.toBeNull();

    // The value handed to NumberFlow tracks the live formula (generous
    // tolerance for the render/read time gap).
    const expected = computeAge(FIXED_BIRTHDAY);
    expect(rendered!).toBeGreaterThanOrEqual(0);
    expect(Math.abs(rendered! - expected)).toBeLessThan(1e-3);
  });

  it('exposes a stable "N years old" sentence for assistive tech', () => {
    stubMatchMedia(false);
    render(<AgeCounter birthday={FIXED_BIRTHDAY} />);

    const whole = Math.floor(computeAge(FIXED_BIRTHDAY));
    expect(screen.getByText(`${whole} years old`)).toBeInTheDocument();
  });

  it('keeps the animated number aria-hidden and the label as visible text', () => {
    stubMatchMedia(false);
    const { container } = render(<AgeCounter birthday={FIXED_BIRTHDAY} />);

    // The rapidly-changing readout is hidden from assistive tech...
    const hidden = container.querySelector('[aria-hidden="true"]');
    expect(hidden).not.toBeNull();
    expect(hidden!.querySelector('number-flow-react')).not.toBeNull();
    // ...and carries the trailing "years old" label.
    expect(hidden!.textContent).toContain('years old');
  });

  it('uses tabular-nums for the rolling digits (no layout jitter)', () => {
    stubMatchMedia(false);
    const { container } = render(<AgeCounter birthday={FIXED_BIRTHDAY} />);

    const nf = container.querySelector('number-flow-react');
    expect(nf).not.toBeNull();
    expect(nf!.getAttribute('class')).toContain('tabular-nums');
  });

  it('honours the fractionDigits prop for the live value', () => {
    stubMatchMedia(false);
    const { container } = render(
      <AgeCounter birthday={FIXED_BIRTHDAY} fractionDigits={3} />,
    );

    const text = readNumberFlowString(container) ?? '';
    const decimals = text.split('.')[1] ?? '';
    expect(decimals).toHaveLength(3);
  });
});

describe('AgeCounter — reduced motion', () => {
  it('shows a calm, low-precision STATIC age (single decimal) and no NumberFlow', () => {
    stubMatchMedia(true);
    const { container } = render(<AgeCounter birthday={FIXED_BIRTHDAY} />);

    // No animated element is mounted under reduced motion.
    expect(container.querySelector('number-flow-react')).toBeNull();

    const text = screen.getByTestId('age-counter-value').textContent ?? '';
    const decimals = text.split('.')[1] ?? '';
    expect(decimals).toHaveLength(REDUCED_FRACTION_DIGITS);
    expect(Number(text)).toBeCloseTo(computeAge(FIXED_BIRTHDAY), 1);
  });

  it('does not tick: the value is stable as time advances', () => {
    stubMatchMedia(true);
    vi.useFakeTimers();
    const start = Date.UTC(2024, 0, 1);
    vi.setSystemTime(start);

    render(<AgeCounter birthday={FIXED_BIRTHDAY} />);
    const before = screen.getByTestId('age-counter-value').textContent;

    act(() => {
      vi.setSystemTime(start + 60_000);
      vi.advanceTimersByTime(1_000);
    });

    const after = screen.getByTestId('age-counter-value').textContent;
    expect(after).toBe(before);
  });
});

describe('AgeCounter — ticking lifecycle', () => {
  // The digit-rolling is driven by feeding a fresh `computeAge()` into
  // NumberFlow on a fast interval. NumberFlow only animates in a real browser
  // (in jsdom it renders its static SSR fallback), so we assert the ticking
  // machinery we own: the interval is scheduled at the right cadence only when
  // motion is allowed, and it is torn down on unmount. That `computeAge` grows
  // with time — so each tick feeds a larger value — is covered by the formula
  // test above.

  it('schedules a fast interval at the tick cadence and clears it on unmount', () => {
    stubMatchMedia(false);
    const setSpy = vi.spyOn(globalThis, 'setInterval');
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = render(<AgeCounter birthday={FIXED_BIRTHDAY} />);

    const tick = setSpy.mock.calls.find(
      ([, delay]) => delay === TICK_INTERVAL_MS,
    );
    expect(tick).toBeDefined();

    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it('does not schedule the fast interval under reduced motion', () => {
    stubMatchMedia(true);
    const setSpy = vi.spyOn(globalThis, 'setInterval');

    render(<AgeCounter birthday={FIXED_BIRTHDAY} />);

    const tick = setSpy.mock.calls.find(
      ([, delay]) => delay === TICK_INTERVAL_MS,
    );
    expect(tick).toBeUndefined();
  });
});
