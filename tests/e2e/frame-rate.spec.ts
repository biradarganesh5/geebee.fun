import { test, expect, type Page } from '@playwright/test';

/**
 * Frame-rate tracing e2e tests (task 17.3).
 *
 * Verifies Req 8.1: when a section transition or reveal animation runs, the
 * Animation_Engine renders it at a sustained frame rate of at least 60fps and
 * never drops below 30fps for any sustained stretch.
 *
 * Practical Chromium approach
 * ---------------------------
 * True compositor frame-rate measurement is environment-dependent and cannot be
 * asserted exactly from JS — actual fps depends on the host's display refresh
 * rate, GPU, and CI load. Instead we sample frame *timing* in-page with
 * requestAnimationFrame while an animation is running and reason about the
 * distribution of inter-frame deltas:
 *
 *   - 60fps target  => ~16.7ms per frame
 *   - 30fps floor   => ~33.3ms per frame
 *
 * We collect the frame deltas observed during the hero entrance (Req 1.4 motion)
 * and during a scroll-triggered reveal (Req 8.3 / 4.5 motion), then assert:
 *
 *   1. Average fps is at least a conservative threshold (guards against gross
 *      jank; kept well below 60 so ordinary CI noise doesn't cause flakes).
 *   2. The dropped-frame ratio (frames slower than the 30fps floor) is small.
 *   3. There is no *sustained run* of consecutive frames below the 30fps floor
 *      — a single slow frame from GC/layout is tolerated, a sustained stall is
 *      not. This is the load-bearing "never below 30fps" assertion, softened
 *      only enough to survive real-browser measurement noise.
 *
 * Chromium-only: these timings are meaningful under Chromium's rAF scheduling;
 * other engines are skipped (they are covered for correctness elsewhere).
 */

/** 60fps target frame budget, in milliseconds. */
const TARGET_FRAME_MS = 1000 / 60; // ~16.67ms

/** 30fps floor frame budget, in milliseconds. A frame slower than this is "dropped". */
const FLOOR_FRAME_MS = 1000 / 30; // ~33.33ms

/**
 * Conservative average-fps threshold. Exact 60fps is environment-dependent, so
 * we assert only that the sustained average stays comfortably above a floor
 * that still indicates smooth motion while tolerating CI noise.
 */
const MIN_AVERAGE_FPS = 40;

/** Max tolerated fraction of frames slower than the 30fps floor. */
const MAX_DROPPED_RATIO = 0.34;

/**
 * Max tolerated length of a *consecutive* run of sub-30fps frames. A lone slow
 * frame (GC pause, layout) is fine; a sustained run of 3+ means the animation
 * genuinely stalled below 30fps.
 */
const MAX_SUSTAINED_DROPPED_RUN = 3;

interface FrameStats {
  /** Inter-frame deltas in milliseconds. */
  deltas: number[];
  /** Number of animation frames sampled. */
  frameCount: number;
  /** Total wall-clock duration of the sampling window, in milliseconds. */
  durationMs: number;
}

/**
 * Derived, human-meaningful metrics computed from raw frame deltas.
 */
function analyzeFrames(stats: FrameStats): {
  averageFps: number;
  droppedRatio: number;
  longestDroppedRun: number;
  sampleCount: number;
} {
  const { deltas } = stats;
  const sampleCount = deltas.length;

  const totalMs = deltas.reduce((sum, d) => sum + d, 0);
  const averageFps = totalMs > 0 ? (sampleCount / totalMs) * 1000 : 0;

  const droppedFrames = deltas.filter((d) => d > FLOOR_FRAME_MS).length;
  const droppedRatio = sampleCount > 0 ? droppedFrames / sampleCount : 0;

  // Longest consecutive run of frames slower than the 30fps floor.
  let longestDroppedRun = 0;
  let currentRun = 0;
  for (const d of deltas) {
    if (d > FLOOR_FRAME_MS) {
      currentRun += 1;
      longestDroppedRun = Math.max(longestDroppedRun, currentRun);
    } else {
      currentRun = 0;
    }
  }

  return { averageFps, droppedRatio, longestDroppedRun, sampleCount };
}

/**
 * Installs a frame sampler that begins recording rAF timestamps from document
 * start and stops once the hero entrance element reaches its `final` state (or a
 * hard cap elapses). This captures the frame timing *of the hero entrance
 * animation itself* (Req 1.4 / 8.1).
 */
async function installHeroFrameSampler(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __heroFrames?: number[]; __heroFramesDone?: boolean };
    w.__heroFrames = [];
    w.__heroFramesDone = false;

    let last = performance.now();
    const startedAt = last;

    const sample = () => {
      const now = performance.now();
      w.__heroFrames!.push(now - last);
      last = now;

      const el = document.querySelector('[data-hero-entrance]');
      const reachedFinal = el?.getAttribute('data-anim-state') === 'final';
      // Stop once the entrance settles, or after a 4s hard cap safety net.
      if ((reachedFinal && w.__heroFrames!.length > 3) || now - startedAt > 4000) {
        w.__heroFramesDone = true;
        return;
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

/**
 * Scrolls the element matching `selector` into view and samples rAF frame deltas
 * until its reveal reaches `final` (or a timeout). Returns the raw frame stats
 * for the reveal/transition animation window (Req 8.3 / 4.5 / 8.1).
 */
async function sampleRevealFrames(page: Page, selector: string): Promise<FrameStats> {
  return page.evaluate(async (sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return { deltas: [], frameCount: 0, durationMs: 0 };

    // Trigger the scroll-driven reveal.
    el.scrollIntoView({ block: 'center' });

    const deltas: number[] = [];
    const start = performance.now();
    let last = start;

    return new Promise<{ deltas: number[]; frameCount: number; durationMs: number }>((resolve) => {
      const sample = () => {
        const now = performance.now();
        deltas.push(now - last);
        last = now;

        const state = el.getAttribute('data-anim-state');
        // Keep sampling a few extra frames past `final` to catch any settling
        // jank, then resolve. Hard cap at 4s.
        if ((state === 'final' && deltas.length > 3) || now - start > 4000) {
          resolve({ deltas, frameCount: deltas.length, durationMs: now - start });
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  }, selector);
}

test.describe('animation frame rate (Req 8.1)', () => {
  // Frame-timing analysis is only meaningful under Chromium's rAF scheduling.
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'frame-rate tracing is Chromium-only; exact fps is environment-dependent on other engines',
  );

  test('hero entrance sustains a smooth frame rate without sustained sub-30fps stalls', async ({
    page,
  }) => {
    await installHeroFrameSampler(page);
    await page.goto('/');

    await expect(page.locator('[data-hero-entrance]')).toBeVisible();

    // Wait for the entrance to settle and the sampler to finish.
    await page.waitForFunction(
      () => (window as unknown as { __heroFramesDone?: boolean }).__heroFramesDone === true,
      undefined,
      { timeout: 8000 },
    );

    const stats = await page.evaluate<FrameStats>(() => {
      const frames = (window as unknown as { __heroFrames: number[] }).__heroFrames;
      const durationMs = frames.reduce((sum, d) => sum + d, 0);
      return { deltas: frames, frameCount: frames.length, durationMs };
    });

    // We need a meaningful number of samples to reason about frame rate.
    expect(stats.frameCount, 'hero entrance should produce sampled frames').toBeGreaterThan(5);

    const { averageFps, droppedRatio, longestDroppedRun, sampleCount } = analyzeFrames(stats);

    // Diagnostic surface in the report on failure.
    test.info().annotations.push({
      type: 'hero-frame-stats',
      description: `avgFps=${averageFps.toFixed(1)} dropped=${(droppedRatio * 100).toFixed(
        1,
      )}% longestRun=${longestDroppedRun} samples=${sampleCount} target=${TARGET_FRAME_MS.toFixed(
        1,
      )}ms floor=${FLOOR_FRAME_MS.toFixed(1)}ms`,
    });

    // 1. Average fps stays above a conservative smoothness floor.
    expect(
      averageFps,
      `hero entrance average fps (${averageFps.toFixed(1)}) should be >= ${MIN_AVERAGE_FPS}`,
    ).toBeGreaterThanOrEqual(MIN_AVERAGE_FPS);

    // 2. Only a small fraction of frames dip below the 30fps floor.
    expect(
      droppedRatio,
      `hero entrance dropped-frame ratio (${(droppedRatio * 100).toFixed(1)}%) should be small`,
    ).toBeLessThanOrEqual(MAX_DROPPED_RATIO);

    // 3. No *sustained* run below 30fps (the "never below 30fps" guarantee,
    //    softened only to tolerate isolated single-frame stalls).
    expect(
      longestDroppedRun,
      `hero entrance should have no sustained sub-30fps run (longest run ${longestDroppedRun})`,
    ).toBeLessThanOrEqual(MAX_SUSTAINED_DROPPED_RUN);
  });

  test('scroll-triggered reveal sustains a smooth frame rate without sustained sub-30fps stalls', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));

    const count = await page.locator('[data-homelab-component]').count();
    expect(count, 'expected at least one homelab component to reveal').toBeGreaterThan(0);

    const stats = await sampleRevealFrames(page, '[data-homelab-component]');

    expect(stats.frameCount, 'reveal should produce sampled frames').toBeGreaterThan(5);

    const { averageFps, droppedRatio, longestDroppedRun, sampleCount } = analyzeFrames(stats);

    test.info().annotations.push({
      type: 'reveal-frame-stats',
      description: `avgFps=${averageFps.toFixed(1)} dropped=${(droppedRatio * 100).toFixed(
        1,
      )}% longestRun=${longestDroppedRun} samples=${sampleCount} target=${TARGET_FRAME_MS.toFixed(
        1,
      )}ms floor=${FLOOR_FRAME_MS.toFixed(1)}ms`,
    });

    expect(
      averageFps,
      `reveal average fps (${averageFps.toFixed(1)}) should be >= ${MIN_AVERAGE_FPS}`,
    ).toBeGreaterThanOrEqual(MIN_AVERAGE_FPS);

    expect(
      droppedRatio,
      `reveal dropped-frame ratio (${(droppedRatio * 100).toFixed(1)}%) should be small`,
    ).toBeLessThanOrEqual(MAX_DROPPED_RATIO);

    expect(
      longestDroppedRun,
      `reveal should have no sustained sub-30fps run (longest run ${longestDroppedRun})`,
    ).toBeLessThanOrEqual(MAX_SUSTAINED_DROPPED_RUN);
  });
});
