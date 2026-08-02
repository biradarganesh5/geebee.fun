import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import StatCounters, { defaultStats, type Stat } from './StatCounters';

/**
 * Unit tests for the StatCounters island.
 *
 * The island rolls each headline stat up from 0 to its final value once it
 * scrolls into view, but the FINAL value is always what renders server-side /
 * on first paint (and for screen readers via an sr-only sentence). Under
 * reduced motion the count-up is skipped and the final value is shown
 * immediately.
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

/** Formats a stat exactly like the component (prefix + value + suffix). */
function finalText(stat: Stat): string {
  return `${stat.prefix ?? ''}${stat.value}${stat.suffix ?? ''}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

describe('StatCounters', () => {
  it('renders the final value + label as accessible text for every stat', () => {
    stubMatchMedia(false);
    render(<StatCounters />);

    // The stable sr-only sentence for each stat carries the final value + label
    // regardless of animation progress, so assistive tech always gets the real
    // number.
    for (const stat of defaultStats) {
      // Labels may contain non-breaking spaces (e.g. to keep "ECS → EKS" on one
      // line); Testing Library normalizes those to regular spaces in the DOM,
      // so normalize the expected string the same way before matching.
      const expected = `${finalText(stat)} ${stat.label}`.replace(/\u00a0/g, ' ');
      expect(screen.getByText(expected)).toBeInTheDocument();
    }
  });

  it('exposes the stat row as a labelled list with one item per stat', () => {
    stubMatchMedia(false);
    render(<StatCounters />);

    const list = screen.getByRole('list', { name: /career highlights/i });
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(defaultStats.length);
  });

  it('shows the final numbers immediately under reduced motion (no count-up)', () => {
    stubMatchMedia(true);

    render(<StatCounters />);

    // The visible (aria-hidden) number for each stat is the final value right
    // away — never a mid-animation 0. Within each list item the first
    // aria-hidden span is the number, the second is the label.
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(defaultStats.length);

    defaultStats.forEach((stat, index) => {
      const number = items[index].querySelector<HTMLElement>(
        'span[aria-hidden="true"]',
      );
      expect(number?.textContent).toBe(finalText(stat));
    });
  });

  it('renders custom stats when provided', () => {
    stubMatchMedia(true);
    const stats: Stat[] = [
      { value: 42, suffix: '%', label: 'test coverage' },
      { value: 7, prefix: '$', suffix: 'M', label: 'value delivered' },
    ];

    render(<StatCounters stats={stats} />);

    expect(screen.getByText('42% test coverage')).toBeInTheDocument();
    expect(screen.getByText('$7M value delivered')).toBeInTheDocument();
  });
});
