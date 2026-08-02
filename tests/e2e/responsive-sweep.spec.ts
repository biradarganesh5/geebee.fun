import { test, expect } from '@playwright/test';

/**
 * Responsive sweep e2e coverage (Requirements 9.1, 9.2, 9.5).
 *
 * Loads the Portfolio_Site at a range of viewport widths spanning the supported
 * 360–2560px band and, at each width, asserts the responsive invariants:
 *
 *  - Req 9.1: no horizontal scrolling, no overlap of the major sections, and
 *             no clipped/truncated text.
 *  - Req 9.2: body text renders at a computed font size of at least 14px.
 *  - Req 9.5: resizing between widths reflows content within 500ms and never
 *             introduces horizontal scrolling.
 *
 * The sweep drives the viewport size directly, so it only runs on the desktop
 * projects (mobile device projects pin an emulated viewport that cannot be
 * resized freely).
 */

// Representative widths across the 360–2560px supported band, including the
// 480/768/1024 breakpoint boundaries called out in the requirements.
const SWEEP_WIDTHS = [360, 480, 768, 1024, 1440, 1920, 2560] as const;

// A tall viewport height so every stacked section is laid out and measurable.
const VIEWPORT_HEIGHT = 900;

// Sub-pixel rounding tolerance for width/overlap comparisons.
const TOLERANCE_PX = 1;

// The five content sections plus the hero — the "major sections" whose boxes
// must never overlap one another.
const MAJOR_SECTION_IDS = [
  'hero',
  'hobbies',
  'homelab',
  'pc-specs',
  'resume',
  'certifications',
] as const;

const MIN_BODY_FONT_PX = 14;

// The maximum reflow budget after a resize (Req 9.5).
const REFLOW_BUDGET_MS = 500;

interface HorizontalScroll {
  scrollWidth: number;
  innerWidth: number;
}

interface OverlapResult {
  overlaps: Array<{ a: string; b: string }>;
  missing: string[];
}

interface TruncationResult {
  truncated: Array<{
    tag: string;
    text: string;
    scrollWidth: number;
    clientWidth: number;
  }>;
}

/**
 * Measures whether the document overflows its viewport horizontally.
 * Uses the documentElement scrollWidth vs. the layout viewport width.
 */
async function measureHorizontalScroll(page: import('@playwright/test').Page) {
  return page.evaluate<HorizontalScroll>(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: Math.max(doc.scrollWidth, document.body.scrollWidth),
      innerWidth: window.innerWidth,
    };
  });
}

/**
 * Detects overlap between the major section boxes. Sections stack vertically,
 * so any real overlap means one section's box intrudes into another's.
 */
async function measureSectionOverlap(
  page: import('@playwright/test').Page,
  ids: readonly string[],
  tolerance: number,
) {
  return page.evaluate<OverlapResult, { ids: string[]; tolerance: number }>(
    ({ ids, tolerance }) => {
      const missing: string[] = [];
      const boxes = ids
        .map((id) => {
          const el = document.getElementById(id);
          if (!el) {
            missing.push(id);
            return null;
          }
          const r = el.getBoundingClientRect();
          return { id, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
        })
        .filter((b): b is NonNullable<typeof b> => b !== null);

      const overlaps: Array<{ a: string; b: string }> = [];
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          const verticalOverlap =
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          const horizontalOverlap =
            Math.min(a.right, b.right) - Math.max(a.left, b.left);
          // A true overlap requires meaningful intrusion on BOTH axes.
          if (verticalOverlap > tolerance && horizontalOverlap > tolerance) {
            overlaps.push({ a: a.id, b: b.id });
          }
        }
      }
      return { overlaps, missing };
    },
    { ids: [...ids], tolerance },
  );
}

/**
 * Detects horizontally clipped/truncated text. Elements that clip their text
 * (via overflow + nowrap/ellipsis) report a scrollWidth larger than their
 * clientWidth. We only inspect elements that directly hold visible text.
 */
async function measureTextTruncation(
  page: import('@playwright/test').Page,
  tolerance: number,
) {
  return page.evaluate<TruncationResult, number>((tolerance) => {
    const selector = 'h1, h2, h3, h4, p, a, li, span, button, dt, dd, figcaption';
    const truncated: TruncationResult['truncated'] = [];

    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      // Only consider elements with their own visible, non-empty text.
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (ownText.length === 0) continue;

      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      // Skip visually-hidden accessibility affordances (e.g. `sr-only` skip
      // links). These are intentionally clipped to a ~1px box and revealed only
      // on focus, so their scrollWidth > clientWidth is by design and not a
      // case of visible text being truncated (Req 9.1 targets visible text).
      const isVisuallyHidden =
        el.clientWidth <= 1 ||
        el.clientHeight <= 1 ||
        (style.clip !== 'auto' && style.clip.replace(/\s/g, '') === 'rect(0px,0px,0px,0px)') ||
        (style.clipPath !== 'none' && style.clipPath.includes('inset(50%)'));
      if (isVisuallyHidden) continue;

      const clipsHorizontally =
        style.overflowX === 'hidden' ||
        style.overflowX === 'clip' ||
        style.textOverflow === 'ellipsis';
      if (!clipsHorizontally) continue;

      if (el.scrollWidth > el.clientWidth + tolerance) {
        truncated.push({
          tag: el.tagName.toLowerCase(),
          text: ownText.slice(0, 60),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        });
      }
    }
    return { truncated };
  }, tolerance);
}

/** Reads the computed font-size of the document body in pixels. */
async function measureBodyFontSize(page: import('@playwright/test').Page) {
  return page.evaluate<number>(() =>
    parseFloat(window.getComputedStyle(document.body).fontSize),
  );
}

test.describe('responsive sweep 360-2560px', () => {
  // The sweep controls the viewport directly, which is unsupported on the
  // emulated mobile device projects.
  test.skip(
    ({ isMobile }) => Boolean(isMobile),
    'Responsive sweep drives the viewport size and runs on desktop projects only.',
  );

  for (const width of SWEEP_WIDTHS) {
    test(`renders cleanly at ${width}px wide`, async ({ page }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Req 9.1 — no horizontal scrolling.
      const scroll = await measureHorizontalScroll(page);
      expect(
        scroll.scrollWidth,
        `horizontal scroll at ${width}px (scrollWidth=${scroll.scrollWidth}, innerWidth=${scroll.innerWidth})`,
      ).toBeLessThanOrEqual(scroll.innerWidth + TOLERANCE_PX);

      // Req 9.1 — every major section is present and none overlap.
      const overlap = await measureSectionOverlap(
        page,
        MAJOR_SECTION_IDS,
        TOLERANCE_PX,
      );
      expect(
        overlap.missing,
        `missing major sections at ${width}px: ${overlap.missing.join(', ')}`,
      ).toEqual([]);
      expect(
        overlap.overlaps,
        `overlapping sections at ${width}px: ${JSON.stringify(overlap.overlaps)}`,
      ).toEqual([]);

      // Req 9.1 — no clipped/truncated text.
      const truncation = await measureTextTruncation(page, TOLERANCE_PX);
      expect(
        truncation.truncated,
        `truncated text at ${width}px: ${JSON.stringify(truncation.truncated)}`,
      ).toEqual([]);

      // Req 9.2 — body font size never drops below 14px.
      const fontSize = await measureBodyFontSize(page);
      expect(
        fontSize,
        `body font-size at ${width}px was ${fontSize}px`,
      ).toBeGreaterThanOrEqual(MIN_BODY_FONT_PX);
    });
  }

  test('reflows within budget without horizontal scroll when resized across the band', async ({
    page,
  }) => {
    // Start at the widest supported viewport, then walk down to the narrowest,
    // asserting each resize reflows within 500ms and never overflows (Req 9.5).
    await page.setViewportSize({ width: 2560, height: VIEWPORT_HEIGHT });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const descending = [...SWEEP_WIDTHS].sort((a, b) => b - a);
    for (const width of descending) {
      const start = Date.now();
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });

      // Poll until the layout settles with no horizontal overflow, bounded by
      // the reflow budget.
      await expect
        .poll(
          async () => {
            const scroll = await measureHorizontalScroll(page);
            return scroll.scrollWidth <= scroll.innerWidth + TOLERANCE_PX;
          },
          { timeout: REFLOW_BUDGET_MS, message: `did not reflow within ${REFLOW_BUDGET_MS}ms at ${width}px` },
        )
        .toBe(true);

      const elapsed = Date.now() - start;
      expect(
        elapsed,
        `reflow to ${width}px took ${elapsed}ms`,
      ).toBeLessThanOrEqual(REFLOW_BUDGET_MS + 50);
    }
  });
});
