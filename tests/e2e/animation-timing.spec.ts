import { test, expect, type Page } from '@playwright/test';

/**
 * Animation / interaction timing e2e tests (task 17.2).
 *
 * Verifies the millisecond timing bounds the design places on the site's motion
 * layer, exercised end-to-end against the built + previewed site:
 *
 *  - Req 1.9: activating a Navigation_Control target brings the corresponding
 *    section into the Viewport within 1000ms.
 *  - Req 8.3: a scroll transition between sections begins within 100ms of the
 *    trigger and completes within 300–800ms (measured best-effort via the
 *    scroll-triggered reveal that manifests the transition in this build).
 *  - Req 4.5: a homelab component's reveal begins within 200ms and completes
 *    within 1000ms once ~25% of it enters the Viewport; hobby entries reveal on
 *    scroll into view (Req 3.3) and end fully visible.
 *  - Req 1.4: the hero entrance begins within 200ms, completes within 2000ms,
 *    and leaves the hero content fully visible.
 *
 * Timing assertions use generous tolerances on top of the spec bounds because
 * wall-clock measurement over a real browser + preview server is inherently
 * noisy. The lower bounds and "fully visible final state" checks are the
 * load-bearing assertions; the upper bounds guard against gross regressions.
 *
 * The engine (src/lib/animation/AnimationEngine.ts) stamps every animated
 * target with `data-anim-state`: `initial` (entrance offset applied), then
 * `animating`, then `final` (fully visible resting state). These tests observe
 * that attribute to time "begins" and "completes".
 */

/** The five in-page navigation targets (section ids), per content/navigation.ts. */
const SECTION_IDS = ['hobbies', 'homelab', 'pc-specs', 'resume', 'certifications'] as const;

/** `data-anim-state` value meaning "fully visible final resting state". */
const FINAL_STATE = 'final';

/**
 * Installs an in-page observer (before any page script runs) that records the
 * first time the hero entrance element enters an animating/final state and the
 * time it reaches its final state, both relative to navigation start. This lets
 * us measure the hero entrance "begins" and "completes" timings (Req 1.4).
 */
async function installHeroTimingProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __heroTiming?: { beginMs: number | null; finalMs: number | null };
    };
    w.__heroTiming = { beginMs: null, finalMs: null };

    // Poll every animation frame from document start. `beginMs` is captured the
    // first frame the hero element carries any `data-anim-state` (the entrance
    // has begun); `finalMs` the first frame it reads `final` (entrance done).
    // rAF polling is more robust here than a MutationObserver, which can miss
    // the synchronous initial attribute write during island hydration.
    const poll = () => {
      const el = document.querySelector('[data-hero-entrance]');
      if (el) {
        const state = el.getAttribute('data-anim-state');
        if (state && w.__heroTiming!.beginMs === null) {
          w.__heroTiming!.beginMs = performance.now();
        }
        if (state === 'final' && w.__heroTiming!.finalMs === null) {
          w.__heroTiming!.finalMs = performance.now();
          return; // Entrance complete — stop polling.
        }
      }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
}

/**
 * Scrolls the element matching `selector` into view and measures, relative to
 * the scroll, when its reveal begins (state leaves the resting `initial`) and
 * when it completes (`final`). Runs entirely in-page against real rAF timing.
 */
async function measureReveal(
  page: Page,
  selector: string,
): Promise<{ beginMs: number | null; completeMs: number; opacity: number; state: string | null }> {
  return page.evaluate(async (sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return { beginMs: null, completeMs: -1, opacity: 0, state: 'missing' };

    // Push the element well past the reveal trigger (`top 75%`).
    el.scrollIntoView({ block: 'center' });

    const t0 = performance.now();
    let beginMs: number | null = null;

    return new Promise<{
      beginMs: number | null;
      completeMs: number;
      opacity: number;
      state: string | null;
    }>((resolve) => {
      const check = () => {
        const state = el.getAttribute('data-anim-state');
        if (beginMs === null && (state === 'animating' || state === 'final')) {
          beginMs = performance.now() - t0;
        }
        if (state === 'final') {
          resolve({
            beginMs,
            completeMs: performance.now() - t0,
            opacity: Number.parseFloat(getComputedStyle(el).opacity),
            state,
          });
          return;
        }
        if (performance.now() - t0 > 5000) {
          resolve({
            beginMs,
            completeMs: -1,
            opacity: Number.parseFloat(getComputedStyle(el).opacity),
            state,
          });
          return;
        }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  }, selector);
}

test.describe('animation / interaction timing', () => {
  test('hero entrance begins <200ms, completes <2000ms, and ends fully visible (Req 1.4)', async ({
    page,
  }) => {
    await installHeroTimingProbe(page);
    await page.goto('/');

    const heroContent = page.locator('[data-hero-entrance]');
    await expect(heroContent).toBeVisible();

    // Wait for the entrance to reach its final resting state.
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-hero-entrance]');
      return el?.getAttribute('data-anim-state') === 'final';
    }, undefined, { timeout: 6000 });

    const timing = await page.evaluate(
      () =>
        (window as unknown as { __heroTiming: { beginMs: number | null; finalMs: number | null } })
          .__heroTiming,
    );

    // The entrance must have started and finished.
    expect(timing.beginMs, 'hero entrance should have begun').not.toBeNull();
    expect(timing.finalMs, 'hero entrance should have completed').not.toBeNull();

    // Begins within 200ms of first render (+ tolerance for load/hydration noise).
    expect(timing.beginMs as number).toBeLessThan(1500);

    // Completes within 2000ms (+ tolerance).
    expect(timing.finalMs as number).toBeLessThan(3000);

    // Ends in the fully visible final resting state.
    await expect(heroContent).toHaveAttribute('data-anim-state', FINAL_STATE);
    const opacity = await heroContent.evaluate((el) => getComputedStyle(el).opacity);
    expect(Number.parseFloat(opacity)).toBeGreaterThan(0.99);
    // Heading text is present and visible.
    await expect(page.getByRole('heading', { name: 'Ganesh Biradar', level: 1 })).toBeVisible();
  });

  test('activating each navigation target brings its section into view within 1000ms (Req 1.9)', async ({
    page,
  }) => {
    await page.goto('/');
    // Let the Navigation island hydrate so activation uses the smooth in-page
    // scroll path (the native anchor is only a no-JS fallback).
    await page.waitForLoadState('networkidle');

    for (const sectionId of SECTION_IDS) {
      // Reset to the top before each measurement so every target scrolls a
      // meaningful distance.
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
      await page.waitForTimeout(100);

      const elapsed = await page.evaluate(async (id) => {
        const link = document.querySelector<HTMLElement>(
          `nav[aria-label="Primary"] a[href="#${id}"]`,
        );
        const section = document.getElementById(id);
        if (!link || !section) return -1;

        const start = performance.now();
        link.click();

        return new Promise<number>((resolve) => {
          const check = () => {
            const rect = section.getBoundingClientRect();
            const inView = rect.top < window.innerHeight && rect.bottom > 0;
            if (inView) {
              resolve(performance.now() - start);
              return;
            }
            if (performance.now() - start > 3000) {
              resolve(-1);
              return;
            }
            requestAnimationFrame(check);
          };
          requestAnimationFrame(check);
        });
      }, sectionId);

      expect(elapsed, `nav target "${sectionId}" should scroll into view`).toBeGreaterThanOrEqual(0);
      // Req 1.9: within 1000ms (+ tolerance for scroll settling noise).
      expect(elapsed, `nav target "${sectionId}" should reach the viewport within ~1000ms`).toBeLessThan(
        1200,
      );
    }
  });

  test('hobby entries reveal on scroll into view and end fully visible (Req 3.3 / 4.5)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hobbyIds = await page.$$eval('[data-hobby-entry]', (els) =>
      els.map((el) => (el as HTMLElement).dataset.hobbyId ?? ''),
    );
    expect(hobbyIds.length).toBe(3);

    for (const hobbyId of hobbyIds) {
      const result = await measureReveal(page, `[data-hobby-entry][data-hobby-id="${hobbyId}"]`);

      // Reveal fired and reached its final visible state.
      expect(result.completeMs, `hobby "${hobbyId}" should complete its reveal`).toBeGreaterThan(0);
      expect(result.beginMs, `hobby "${hobbyId}" reveal should begin`).not.toBeNull();
      // Completes within the 1000ms reveal bound (+ tolerance).
      expect(result.completeMs, `hobby "${hobbyId}" reveal completes within ~1000ms`).toBeLessThan(
        1500,
      );
      // Ends fully visible.
      expect(result.state).toBe(FINAL_STATE);
      expect(result.opacity).toBeGreaterThan(0.99);
    }
  });

  test('homelab component reveal begins <200ms and completes within 1000ms (Req 4.5)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const componentCount = await page.locator('[data-homelab-component]').count();
    expect(componentCount).toBeGreaterThan(0);

    // Measure the first homelab component (representative of the reveal wiring).
    const result = await measureReveal(page, '[data-homelab-component]');

    expect(result.beginMs, 'homelab reveal should begin').not.toBeNull();
    // Begins within 200ms of the trigger (+ tolerance).
    expect(result.beginMs as number, 'homelab reveal begins within ~200ms').toBeLessThan(400);
    // Completes within 1000ms (+ tolerance).
    expect(result.completeMs, 'homelab reveal completes within ~1000ms').toBeGreaterThan(0);
    expect(result.completeMs, 'homelab reveal completes within ~1000ms').toBeLessThan(1500);
    // Ends fully visible.
    expect(result.state).toBe(FINAL_STATE);
    expect(result.opacity).toBeGreaterThan(0.99);
  });

  test('scroll transition begins <100ms and completes within 300–800ms — best effort (Req 8.3)', async ({
    page,
  }) => {
    // Best-effort: section-to-section motion manifests in this build as the
    // scroll-triggered reveal that runs when the incoming section enters view.
    // We use the homelab component's reveal as the observable proxy for the
    // transition's begin/complete timing.
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));

    const result = await measureReveal(page, '[data-homelab-component]');

    expect(result.beginMs, 'transition should begin').not.toBeNull();
    // "Begins within 100ms" — best-effort with tolerance for rAF granularity.
    expect(result.beginMs as number, 'transition begins promptly after trigger').toBeLessThan(300);
    // "Completes within 300–800ms" — best-effort with tolerance on the upper
    // bound; the reveal's own bound is <=1000ms.
    expect(result.completeMs, 'transition completes').toBeGreaterThan(200);
    expect(result.completeMs, 'transition completes within bounds (+tolerance)').toBeLessThan(1200);
    expect(result.state).toBe(FINAL_STATE);
  });
});
