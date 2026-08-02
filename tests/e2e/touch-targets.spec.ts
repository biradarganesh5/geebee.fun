import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Touch-target size + pointer/touch activation e2e coverage.
 *
 * Validates:
 *  - Req 9.7: every interactive element (nav links / toggle, hero hotspots, PC
 *    spec buttons, certification cards, resume link) renders with a minimum
 *    touch-target size of 44x44 CSS pixels.
 *  - Req 9.6: every interactive element activates in response to BOTH pointer
 *    input (mouse click) and touch input (tap). We drive representative
 *    interactive elements — a hero hotspot and a PC spec button — with a real
 *    pointer click on a desktop context and with a tap on a touch context, and
 *    assert the expected content reveal in each case.
 *
 * The DOM contracts asserted here come from the interactive islands:
 *   - Navigation:       nav[aria-label="Primary"] a  +  the mobile toggle button
 *   - HotspotLayer:     button[data-hotspot-id] / [data-hotspot-subject]
 *   - PcSpecsShowcase:  [data-testid="pc-specs-showcase"] button[data-category]
 *   - CertificationCard:[data-cert-frame]
 *   - ResumeSection:    #resume-formal-link  (degrades to #resume-unavailable)
 */

// Minimum touch-target dimension in CSS pixels (Req 9.6, 9.7). A sub-pixel
// tolerance absorbs layout rounding without weakening the 44px contract.
const MIN_TARGET_PX = 44;
const TOLERANCE_PX = 0.5;

/** Assert a located element renders at least 44x44 CSS px (Req 9.7). */
async function assertMinTouchTarget(locator: Locator, label: string): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, `${label} should have a rendered bounding box`).not.toBeNull();
  expect(
    box!.width,
    `${label} width should be >= ${MIN_TARGET_PX}px (got ${box!.width})`,
  ).toBeGreaterThanOrEqual(MIN_TARGET_PX - TOLERANCE_PX);
  expect(
    box!.height,
    `${label} height should be >= ${MIN_TARGET_PX}px (got ${box!.height})`,
  ).toBeGreaterThanOrEqual(MIN_TARGET_PX - TOLERANCE_PX);
}

/** Scroll a section into view by id and wait for it to settle. */
async function revealSection(page: Page, sectionId: string): Promise<void> {
  await page.locator(`#${sectionId}`).scrollIntoViewIfNeeded();
}

// -----------------------------------------------------------------------------
// Req 9.7 — touch-target sizes at a desktop-width viewport.
// A wide viewport keeps the navigation links inline (>=768px, Req 9.4) so every
// nav target is measurable alongside the other interactive elements.
// -----------------------------------------------------------------------------
test.describe('touch targets — desktop layout (Req 9.7)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('every interactive element renders at least 44x44 CSS px', async ({ page }) => {
    await page.goto('/');

    // Nav links (inline at >=768px). Exactly the five section targets (Req 1.8).
    const navLinks = page.locator('nav[aria-label="Primary"] a[href^="#"]');
    await expect(navLinks).toHaveCount(5);
    const navCount = await navLinks.count();
    for (let i = 0; i < navCount; i++) {
      const link = navLinks.nth(i);
      const label = (await link.textContent())?.trim() || `nav link ${i}`;
      await assertMinTouchTarget(link, `nav link "${label}"`);
    }

    // Hero hotspots — hydrated + projected client-side (>=2, incl. PC + soldering).
    const hotspots = page.locator('button[data-hotspot-id]');
    await expect(hotspots).toHaveCount(2);
    const hotspotCount = await hotspots.count();
    for (let i = 0; i < hotspotCount; i++) {
      const hotspot = hotspots.nth(i);
      const subject = await hotspot.getAttribute('data-hotspot-subject');
      await assertMinTouchTarget(hotspot, `hero hotspot "${subject}"`);
    }

    // PC spec buttons — all eleven components (Req 5.1).
    await revealSection(page, 'pc-specs');
    const specButtons = page.locator(
      '[data-testid="pc-specs-showcase"] button[data-category]',
    );
    await expect(specButtons).toHaveCount(11);
    const specCount = await specButtons.count();
    for (let i = 0; i < specCount; i++) {
      const button = specButtons.nth(i);
      const category = await button.getAttribute('data-category');
      await assertMinTouchTarget(button, `PC spec button "${category}"`);
    }

    // Certification cards — the three interactive badge frames (Req 7.1/7.2).
    await revealSection(page, 'certifications');
    const certCards = page.locator('[data-cert-frame]');
    await expect(certCards).toHaveCount(3);
    const certCount = await certCards.count();
    for (let i = 0; i < certCount; i++) {
      await assertMinTouchTarget(certCards.nth(i), `certification card ${i}`);
    }

    // Resume link. It degrades to an inline "unavailable" status if the formal
    // resume asset cannot be retrieved (Req 6.7); accept either the sized,
    // activatable link or the graceful fallback.
    await revealSection(page, 'resume');
    const resumeLink = page.locator('#resume-formal-link');
    if (await resumeLink.isVisible()) {
      await assertMinTouchTarget(resumeLink, 'resume formal link');
    } else {
      await expect(page.locator('#resume-unavailable')).toBeVisible();
    }
  });
});

// -----------------------------------------------------------------------------
// Req 9.7 — the mobile navigation toggle + expanded links.
// Below 768px the Navigation collapses to a single toggle control (Req 9.3).
// Both the toggle and each revealed link must meet the 44x44 target.
// -----------------------------------------------------------------------------
test.describe('touch targets — mobile navigation (Req 9.7)', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test('nav toggle and expanded links render at least 44x44 CSS px', async ({ page }) => {
    await page.goto('/');

    const toggle = page.getByRole('button', { name: /navigation menu/i });
    await expect(toggle).toBeVisible();
    await assertMinTouchTarget(toggle, 'mobile nav toggle');

    // Expand the menu and measure every revealed link.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const navLinks = page.locator('nav[aria-label="Primary"] a[href^="#"]');
    await expect(navLinks).toHaveCount(5);
    const navCount = await navLinks.count();
    for (let i = 0; i < navCount; i++) {
      const link = navLinks.nth(i);
      const label = (await link.textContent())?.trim() || `nav link ${i}`;
      await assertMinTouchTarget(link, `mobile nav link "${label}"`);
    }
  });
});

// -----------------------------------------------------------------------------
// Req 9.6 — pointer (mouse click) activation.
// A hero hotspot and a PC spec button are activated with a real pointer and the
// expected content reveal is asserted.
// -----------------------------------------------------------------------------
test.describe('pointer activation (Req 9.6)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('interactive elements activate on pointer click', async ({ page }) => {
    await page.goto('/');

    // Soldering hotspot reveals inline PCB-designing content (Req 2.6).
    const solderingHotspot = page.locator('button[data-hotspot-subject="soldering"]');
    await expect(solderingHotspot).toBeVisible();
    await solderingHotspot.click();
    await expect(solderingHotspot).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('PCB designing bench')).toBeVisible();

    // PC hotspot surfaces a control that scrolls to the PC specs (Req 2.5).
    const pcHotspot = page.locator('button[data-hotspot-subject="pc"]');
    await pcHotspot.click();
    await expect(pcHotspot).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: /jump to pc specs/i })).toBeVisible();

    // PC spec button reveals its stated value detail on pointer input
    // (Req 5.2/5.3). A hover-capable pointer reveals the detail on pointer-enter
    // (a following click would toggle it closed again), so pointer activation is
    // driven by hover. The retry loop absorbs the client:visible hydration race.
    await revealSection(page, 'pc-specs');
    const cpuButton = page.locator(
      '[data-testid="pc-specs-showcase"] button[data-category="CPU"]',
    );
    await cpuButton.scrollIntoViewIfNeeded();
    await expect(async () => {
      await cpuButton.hover();
      await expect(page.getByText('AMD Ryzen 7 5800X3D')).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
  });
});

// -----------------------------------------------------------------------------
// Req 9.6 — touch (tap) activation.
// The same representative interactive elements are activated by tap in a
// touch-enabled context, asserting the identical content reveal.
// -----------------------------------------------------------------------------
test.describe('touch activation (Req 9.6)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('interactive elements activate on touch tap', async ({ page }) => {
    await page.goto('/');

    // Tap the soldering hotspot → PCB-designing content is revealed (Req 2.6/2.7).
    const solderingHotspot = page.locator('button[data-hotspot-subject="soldering"]');
    await expect(solderingHotspot).toBeVisible();
    await solderingHotspot.tap();
    await expect(solderingHotspot).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('PCB designing bench')).toBeVisible();

    // Tap a PC spec button → its stated value detail is revealed (Req 5.2/5.3).
    // The retry loop absorbs the client:visible hydration race (a tap that lands
    // before hydration is a no-op that leaves the toggle closed, so re-tapping
    // opens it once the island is live).
    await revealSection(page, 'pc-specs');
    const gpuButton = page.locator(
      '[data-testid="pc-specs-showcase"] button[data-category="GPU"]',
    );
    await gpuButton.scrollIntoViewIfNeeded();
    await expect(async () => {
      await gpuButton.tap();
      await expect(page.getByText('AMD Radeon RX 7800XT')).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
  });
});
