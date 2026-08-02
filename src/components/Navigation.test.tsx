import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import Navigation from '@components/Navigation';
import { profile } from '@content/profile';

// Unit tests for the Navigation island.
//
// The dock is a minimal, social-forward shortcut bar: a single "About" jump
// link followed by social shortcuts (GitHub, LinkedIn, Email) plus the theme
// toggle. These tests assert that composition in both the desktop (inline dock)
// and mobile (collapsible) layouts.
//
// The component reads `window.matchMedia` inside an effect to decide between the
// inline desktop layout (>=768px, no toggle) and the collapsible mobile layout
// (<768px, single toggle). jsdom does not implement `matchMedia`, so each test
// installs a mock.
//
// _Requirements: 9.3, 9.4_

/** The social shortcuts surfaced in the dock, in order (mirrors Navigation). */
const DOCK_SOCIAL_NAMES = ['GitHub', 'LinkedIn', 'Email'] as const;

/** Expected dock items: the About jump link followed by the social shortcuts. */
const EXPECTED_ITEMS = [
  { label: 'About', href: '#about', external: false },
  ...DOCK_SOCIAL_NAMES.map((name) => {
    const social = profile.socials.find((s) => s.name === name)!;
    return {
      label: social.name,
      href: social.url,
      external: /^https?:\/\//.test(social.url),
    };
  }),
];

/**
 * Installs a `window.matchMedia` mock.
 *
 * @param desktop when true the `(min-width: 768px)` query reports `matches: true`
 *                (desktop/inline layout); when false it reports `matches: false`
 *                (mobile/collapsible layout).
 */
function installMatchMedia(desktop: boolean, reducedMotion = false): void {
  const impl = (query: string): MediaQueryList => {
    const matches = query.includes('min-width: 768px')
      ? desktop
      : query.includes('prefers-reduced-motion')
        ? reducedMotion
        : false;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn(impl),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  // Remove the mock so tests remain independent.
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe('Navigation — desktop layout (>=768px)', () => {
  it('renders the About link plus the social shortcuts, with no nav toggle (Req 9.4)', () => {
    installMatchMedia(true);
    render(<Navigation />);

    // The dock shows exactly the About link + the three social shortcuts.
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(EXPECTED_ITEMS.length);
    expect(links).toHaveLength(4);

    for (const item of EXPECTED_ITEMS) {
      const link = screen.getByRole('link', { name: item.label });
      expect(link).toBeVisible();
      expect(link).toHaveAttribute('href', item.href);
      if (item.external) {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      }
    }

    // Inline layout shows no *navigation* toggle (hamburger). The only button
    // present is the additional theme toggle control, which is not a nav target.
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute('aria-label', 'Toggle theme');
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeVisible();
  });

  it('exposes each dock item label as its icon link accessible name (Req a11y)', () => {
    installMatchMedia(true);
    render(<Navigation />);

    for (const item of EXPECTED_ITEMS) {
      // The icon renders an SVG, but the accessible name is the label via
      // aria-label so screen-reader users hear the destination, not the glyph.
      const link = screen.getByRole('link', { name: item.label });
      expect(link).toHaveAttribute('aria-label', item.label);
    }
  });

  it('keeps dock icons at their base size when reduced motion is preferred (magnification disabled)', () => {
    installMatchMedia(true, /* reducedMotion */ true);
    render(<Navigation />);

    const dock = screen.getByRole('link', { name: EXPECTED_ITEMS[0].label }).closest('ul');
    expect(dock).not.toBeNull();

    // Pointer movement over the dock must not trigger any magnification: every
    // icon stays pinned at the resting 44px base size.
    fireEvent.pointerMove(dock as HTMLElement, { clientX: 10 });
    fireEvent.pointerMove(dock as HTMLElement, { clientX: 200 });

    for (const link of screen.getAllByRole('link')) {
      expect((link as HTMLElement).style.width).toBe('44px');
      expect((link as HTMLElement).style.height).toBe('44px');
    }
  });
});

describe('Navigation — mobile viewport (<768px)', () => {
  it('renders the same floating dock (no hamburger toggle) at mobile width', () => {
    installMatchMedia(false);
    render(<Navigation />);

    // The dock is shown at every viewport size, so all links are visible
    // immediately — there is no collapsed hamburger menu.
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(EXPECTED_ITEMS.length);
    for (const item of EXPECTED_ITEMS) {
      const link = screen.getByRole('link', { name: item.label });
      expect(link).toBeVisible();
      expect(link).toHaveAttribute('href', item.href);
    }

    // The only button is the theme toggle — no navigation hamburger toggle.
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute('aria-label', 'Toggle theme');
  });

  it('keeps every link reachable within the dock list at mobile width', () => {
    installMatchMedia(false);
    render(<Navigation />);

    const dock = screen.getByRole('link', { name: EXPECTED_ITEMS[0].label }).closest('ul');
    expect(dock).not.toBeNull();
    expect(within(dock as HTMLElement).getAllByRole('link')).toHaveLength(
      EXPECTED_ITEMS.length,
    );
  });
});
