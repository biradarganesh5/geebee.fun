// @vitest-environment node
//
// The Astro Container API renders through esbuild, whose runtime invariants
// break under jsdom's TextEncoder realm. This suite only inspects an HTML
// string, so it runs in the node environment (no DOM needed).
import { describe, it, expect, beforeAll } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import HobbiesSection from './HobbiesSection.astro';

/**
 * Unit tests for HobbiesSection.astro (Task 10.2).
 *
 * These tests render the component to an HTML string via Astro's Container API
 * and assert against the rendered markup. They cover the static, render-time
 * guarantees of Requirements 3.3, 3.4, and 3.6:
 *
 * - Req 3.6 (fallback-to-final-state): the three hobby entries render in their
 *   final visible state by default — every label is present and no entry is
 *   hidden (no `hidden` attribute, no inline `opacity:0`/`display:none`) — so a
 *   failed or absent reveal still shows the entries.
 * - The hobby cards are non-interactive presentational tiles (the former
 *   Homelabbing → Homelab shortcut has been removed), so no entry is an anchor.
 * - Req 3.3 (once-per-load reveal): the reveal wiring is present at the markup
 *   level — every entry carries the `data-hobby-entry` attribute that the client
 *   script targets to register the AnimationEngine reveal. The once-per-load
 *   guarantee itself is unit-tested in AnimationEngine.test.ts, and the actual
 *   scroll-triggered timing is covered by e2e (task 17.2).
 */

const EXPECTED_LABELS = ['Homelabbing', 'PCB designing', '3D modelling'];

let html: string;

beforeAll(async () => {
  const container = await AstroContainer.create();
  html = await container.renderToString(HobbiesSection);
});

describe('HobbiesSection — content and final-state rendering (Req 3.1, 3.6)', () => {
  it('renders exactly the three hobby entries', () => {
    const entryCount = (html.match(/data-hobby-entry/g) ?? []).length;
    expect(entryCount).toBe(3);
  });

  it('renders each hobby label (Homelabbing, PCB designing, 3D modelling)', () => {
    for (const label of EXPECTED_LABELS) {
      expect(html).toContain(label);
    }
  });

  it('renders entries in their final visible state by default — no hidden attribute (Req 3.6)', () => {
    // A `hidden` attribute on an entry would keep it invisible if the reveal
    // never runs. The final-visible-by-default contract forbids that.
    expect(html).not.toMatch(/<(a|div)[^>]*\bdata-hobby-entry\b[^>]*\bhidden\b/);
  });

  it('does not hide entries via inline opacity:0 or display:none (Req 3.6)', () => {
    // Guard against an inline style that would hide an entry without JS. The
    // engine applies the entrance offset only after confirming it is live, so
    // the server-rendered markup must not ship a hiding inline style.
    const inlineStyles = [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
    for (const style of inlineStyles) {
      const normalized = style.replace(/\s+/g, '').toLowerCase();
      expect(normalized).not.toContain('opacity:0');
      expect(normalized).not.toContain('display:none');
      expect(normalized).not.toContain('visibility:hidden');
    }
  });
});

describe('HobbiesSection — non-interactive cards (shortcut removed)', () => {
  it('does not render any Homelab shortcut anchor', () => {
    // The Homelabbing → Homelab shortcut was removed; no entry should be an
    // anchor and there should be no href="#homelab" link in the section.
    expect(html).not.toMatch(/href="#homelab"/);
    expect(html).not.toMatch(/<a\b/);
  });
});

describe('HobbiesSection — reveal wiring (Req 3.3)', () => {
  it('marks every entry with data-hobby-entry for the AnimationEngine reveal', () => {
    // The client script queries `[data-hobby-entry]` to register the
    // once-per-load reveal. All three entries must carry the attribute.
    const entryCount = (html.match(/data-hobby-entry/g) ?? []).length;
    expect(entryCount).toBe(3);
  });

  it('carries a motion kind on each entry so the reveal is data-driven', () => {
    // The reveal wiring reads data-motion-kind per entry; its presence confirms
    // the entries are wired for the engine's reveal. Timing/once-per-load is
    // verified in AnimationEngine.test.ts and e2e (task 17.2).
    const motionKindCount = (html.match(/data-motion-kind=/g) ?? []).length;
    expect(motionKindCount).toBe(3);
  });
});
