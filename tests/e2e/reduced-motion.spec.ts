import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Reduced-motion e2e coverage (task 17.6).
 *
 * With `prefers-reduced-motion: reduce` emulated at the context level, the
 * Portfolio_Site must present its content directly in the final, fully visible
 * resting state rather than mid-animation, and must replace all motion-based
 * animation (translate/scale/rotate/parallax) with either an immediate (0ms)
 * transition or a short fade (<=200ms).
 *
 * How the app satisfies this (see AnimationEngine + resolveMotion):
 * - The single AnimationEngine facade resolves every requested animation
 *   against the LIVE `prefers-reduced-motion` value. Under reduced motion the
 *   pure `resolveMotion` collapses translate/scale/rotate/parallax to
 *   `immediate`, so `heroEntrance` and every `reveal` call `markFinalVisibleState`
 *   synchronously on load — no scroll trigger, no waiting.
 * - `markFinalVisibleState` stamps the target with `data-anim-state="final"`
 *   and forces `opacity:1; transform:none; visibility:visible`, which is exactly
 *   the observable "final resting state" this task asserts.
 *
 * Requirements: 1.5 (hero final state), 3.5 (hobby entries final state),
 * 4.7 (homelab components final state), 8.2 (motion replaced by immediate/fade).
 */

// Mirror of AnimationEngine's exported final-state marker so the tests assert
// against the same contract the engine writes.
const FINAL_STATE_ATTR = 'data-anim-state';
const FINAL_STATE_VALUE = 'final';

// Emulate a reduced-motion visitor for every test in this file.
test.use({ reducedMotion: 'reduce' });

/**
 * Reads the computed `transform` of a locator's element. Under reduced motion
 * the engine snaps targets to `transform: none`, so a settled element must not
 * carry a non-identity (motion) transform such as a translate/scale/rotate.
 */
async function computedTransform(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el as HTMLElement).transform);
}

/** True when a computed transform value represents no motion (identity/none). */
function isIdentityTransform(transform: string): boolean {
  if (!transform || transform === 'none') return true;
  // A settled/identity matrix has no translation, scaling, or rotation.
  const identity2d = 'matrix(1, 0, 0, 1, 0, 0)';
  const identity3d = 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)';
  return transform === identity2d || transform === identity3d;
}

/**
 * Asserts a target is presented in its final, fully visible resting state:
 * flagged final by the engine, visible, fully opaque, and carrying no
 * outstanding motion transform (Req 8.2 immediate/fade contract).
 */
async function expectFinalRestingState(page: Page, locator: Locator): Promise<void> {
  // The engine stamps the final-state flag once the target is fully visible.
  await expect(locator).toHaveAttribute(FINAL_STATE_ATTR, FINAL_STATE_VALUE);
  // Visible without waiting on any motion timeline.
  await expect(locator).toBeVisible();

  const opacity = await locator.evaluate(
    (el) => getComputedStyle(el as HTMLElement).opacity,
  );
  expect(Number(opacity)).toBeCloseTo(1, 2);

  const transform = await computedTransform(locator);
  expect(
    isIdentityTransform(transform),
    `expected a settled (no-motion) transform but got "${transform}"`,
  ).toBe(true);
}

test.describe('Reduced motion: content renders in final resting state', () => {
  test.beforeEach(async ({ page }) => {
    // Emulate a reduced-motion visitor. `emulateMedia` sets the media feature
    // for the page's lifetime, so `prefers-reduced-motion: reduce` is active
    // for the app's initial scripts (hero entrance + reveal wiring) on load.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    // Sanity check that the emulation is actually active in the page context.
    const reduced = await page.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    expect(reduced).toBe(true);
  });

  test('hero name and tagline render immediately in their final visible state (Req 1.5)', async ({
    page,
  }) => {
    const heroContent = page.locator('[data-hero-entrance]');

    // The hero entrance offset must never be applied under reduced motion; the
    // wrapper is snapped straight to its final resting state.
    await expectFinalRestingState(page, heroContent);

    // Name and tagline are visible immediately (not mid-animation).
    const name = page.locator('#hero-heading');
    await expect(name).toBeVisible();
    await expect(name).toHaveText('Ganesh Biradar');

    const tagline = heroContent.locator('p');
    await expect(tagline).toBeVisible();
    await expect(tagline).not.toBeEmpty();
  });

  test('every hobby entry renders in its final revealed state without motion (Req 3.5)', async ({
    page,
  }) => {
    const entries = page.locator('[data-hobby-entry]');

    // The Hobbies_Section has exactly three entries (Homelabbing, PCB, 3D).
    await expect(entries).toHaveCount(3);

    const count = await entries.count();
    for (let i = 0; i < count; i += 1) {
      const entry = entries.nth(i);
      await expectFinalRestingState(page, entry);
      // The hobby label is visible right away.
      await expect(entry.locator('.hobby-card__label')).toBeVisible();
    }
  });

  test('every homelab component renders in its final visible state without motion (Req 4.7)', async ({
    page,
  }) => {
    const components = page.locator('[data-homelab-component]');

    // Three hardware components + five self-hosted services.
    await expect(components).toHaveCount(8);

    const count = await components.count();
    for (let i = 0; i < count; i += 1) {
      // Reduced motion resolves reveals to `immediate`, so components reach
      // their final state on load regardless of scroll position — no waiting
      // on a scroll-triggered motion timeline.
      await expectFinalRestingState(page, components.nth(i));
    }
  });

  test('motion is replaced by immediate/fade — no long-running transforms remain (Req 8.2)', async ({
    page,
  }) => {
    // Collect the animated targets across hero, hobbies, and homelab.
    const animatedSelectors = [
      '[data-hero-entrance]',
      '[data-hobby-entry]',
      '[data-homelab-component]',
    ];

    for (const selector of animatedSelectors) {
      const targets = page.locator(selector);
      const count = await targets.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i += 1) {
        const target = targets.nth(i);

        // Each target must already be flagged final (immediate resolution)
        // rather than sitting in an `initial`/`animating` motion state.
        await expect(target).toHaveAttribute(FINAL_STATE_ATTR, FINAL_STATE_VALUE);

        // No outstanding translate/scale/rotate transform.
        const transform = await computedTransform(target);
        expect(
          isIdentityTransform(transform),
          `${selector}[${i}] still carries a motion transform "${transform}"`,
        ).toBe(true);
      }
    }

    // Fully visible right away: sampling the same value twice with a short gap
    // shows the sections are static (not fading/translating over time).
    const sampleSelector = '[data-hobby-entry]';
    const first = page.locator(sampleSelector).first();
    const transformA = await computedTransform(first);
    await page.waitForTimeout(250); // longer than the 200ms fade cap (Req 8.2)
    const transformB = await computedTransform(first);
    expect(transformB).toBe(transformA);
    expect(isIdentityTransform(transformB)).toBe(true);
  });
});
