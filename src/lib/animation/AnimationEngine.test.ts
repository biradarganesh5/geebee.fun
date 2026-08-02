import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  createAnimationEngine,
  isInFinalVisibleState,
  type AnimationEngineConfig,
  type GsapLike,
  type RevealOptions,
  type ScrollTriggerInstanceLike,
  type ScrollTriggerLike,
} from './AnimationEngine';
import type { MotionKind, MotionSpec } from '@logic/resolveMotion';

// ---------------------------------------------------------------------------
// Injectable test fakes
// ---------------------------------------------------------------------------

interface TweenCall {
  target: unknown;
  vars: Record<string, unknown>;
}

interface GsapRecorder {
  gsap: GsapLike;
  set: TweenCall[];
  to: TweenCall[];
  fromTo: Array<{ target: unknown; fromVars: Record<string, unknown>; toVars: Record<string, unknown> }>;
  /** Total number of "motion" tweens (fromTo + to) that were driven. */
  tweenCount(): number;
}

/**
 * A fake GSAP core that RECORDS every call and drives `onComplete`
 * synchronously, so a normal-completion path finishes within the test tick.
 */
function makeCompletingGsap(): GsapRecorder {
  const rec: GsapRecorder = {
    gsap: {} as GsapLike,
    set: [],
    to: [],
    fromTo: [],
    tweenCount() {
      return this.to.length + this.fromTo.length;
    },
  };

  rec.gsap = {
    set(target, vars) {
      rec.set.push({ target, vars });
      return {};
    },
    to(target, vars) {
      rec.to.push({ target, vars });
      const onComplete = vars.onComplete;
      if (typeof onComplete === 'function') (onComplete as () => void)();
      return {};
    },
    fromTo(target, fromVars, toVars) {
      rec.fromTo.push({ target, fromVars, toVars });
      const onComplete = toVars.onComplete;
      if (typeof onComplete === 'function') (onComplete as () => void)();
      return {};
    },
    killTweensOf() {
      /* no-op */
    },
  };

  return rec;
}

/**
 * A fake GSAP core whose every method THROWS, used to force a start failure so
 * the engine's fallback-to-final-state wrapper must engage.
 */
const throwingGsap: GsapLike = {
  set() {
    throw new Error('forced gsap.set failure');
  },
  to() {
    throw new Error('forced gsap.to failure');
  },
  fromTo() {
    throw new Error('forced gsap.fromTo failure');
  },
  killTweensOf() {
    throw new Error('forced gsap.killTweensOf failure');
  },
};

interface ScrollTriggerRecorder {
  scrollTrigger: ScrollTriggerLike;
  created: Array<Record<string, unknown>>;
}

/**
 * A fake ScrollTrigger that RECORDS every `create` and, when `fire` is true,
 * invokes the registered `onEnter` synchronously (simulating the target
 * scrolling into view).
 */
function makeScrollTrigger(fire: boolean): ScrollTriggerRecorder {
  const rec: ScrollTriggerRecorder = { scrollTrigger: {} as ScrollTriggerLike, created: [] };
  const instance: ScrollTriggerInstanceLike = { kill() {} };
  rec.scrollTrigger = {
    create(vars) {
      rec.created.push(vars);
      if (fire && typeof vars.onEnter === 'function') (vars.onEnter as () => void)();
      return instance;
    },
  };
  return rec;
}

// ---------------------------------------------------------------------------
// Target + input helpers
// ---------------------------------------------------------------------------

/**
 * Builds a fresh target that starts hidden/inert (opacity 0, aria-hidden) with
 * real content so the assertions can prove content + interactivity are intact
 * once the target reaches its final visible state.
 */
function makeTarget(): HTMLElement {
  const el = document.createElement('section');
  el.setAttribute('aria-hidden', 'true');
  el.style.opacity = '0';
  const button = document.createElement('button');
  button.textContent = 'Interactive content';
  el.appendChild(button);
  document.body.appendChild(el);
  return el;
}

/** Asserts the target ended in its fully visible, interactive final state. */
function assertFinalVisibleAndInteractive(el: HTMLElement): void {
  expect(isInFinalVisibleState(el)).toBe(true);
  // Interactivity intact: not hidden from assistive tech, opacity restored.
  expect(el.getAttribute('aria-hidden')).toBeNull();
  expect(el.style.opacity).toBe('1');
  expect(el.style.pointerEvents).not.toBe('none');
  // No residual soft focus-in blur remains in the final visible state.
  expect(['none', '', 'blur(0px)']).toContain(el.style.filter);
  // Content intact.
  expect(el.querySelector('button')).not.toBeNull();
}

const ALL_KINDS: readonly MotionKind[] = ['translate', 'scale', 'rotate', 'parallax', 'fade'];

const motionSpecArb: fc.Arbitrary<MotionSpec> = fc.record({
  kind: fc.constantFrom(...ALL_KINDS),
  // Wide ranges (incl. values well beyond the engine's bounds) to exercise
  // clamping and the completion/failure paths uniformly.
  startDelayMs: fc.double({ min: 0, max: 100_000, noNaN: true }),
  durationMs: fc.double({ min: 0, max: 100_000, noNaN: true }),
});

const revealOptsArb: fc.Arbitrary<RevealOptions> = fc.record({
  startDelayMs: fc.double({ min: 0, max: 100_000, noNaN: true }),
  durationMs: fc.double({ min: 0, max: 100_000, noNaN: true }),
  motion: motionSpecArb,
});

// ---------------------------------------------------------------------------
// Task 7.2 — Property 5: Animations always end in the fully visible final state
// ---------------------------------------------------------------------------

describe('AnimationEngine — final-state guarantee (Property 5)', () => {
  // Feature: portfolio-website, Property 5: Animations always end in the fully visible final state
  // Validates: Requirements 3.6, 4.6, 8.4
  it('Property 5: heroEntrance/reveal/transition always end fully visible under completion, failure, and reduced motion', () => {
    fc.assert(
      fc.property(revealOptsArb, fc.constantFrom('normal', 'failure', 'reduced'), (opts, scenario) => {
        // Build a config for the chosen scenario.
        const config: AnimationEngineConfig = { logger: () => {} };
        if (scenario === 'normal') {
          config.gsap = makeCompletingGsap().gsap;
          config.scrollTrigger = makeScrollTrigger(true).scrollTrigger;
          config.prefersReducedMotion = false;
        } else if (scenario === 'failure') {
          // Forced start failure: every gsap call throws.
          config.gsap = throwingGsap;
          config.scrollTrigger = makeScrollTrigger(true).scrollTrigger;
          config.prefersReducedMotion = false;
        } else {
          // Reduced motion: motion collapses to immediate/fade.
          config.gsap = makeCompletingGsap().gsap;
          config.scrollTrigger = makeScrollTrigger(true).scrollTrigger;
          config.prefersReducedMotion = true;
        }

        const engine = createAnimationEngine(config);

        // heroEntrance — target must end fully visible.
        const hero = makeTarget();
        engine.heroEntrance(hero);
        assertFinalVisibleAndInteractive(hero);

        // reveal — target must end fully visible.
        const revealTarget = makeTarget();
        engine.reveal(revealTarget, opts);
        assertFinalVisibleAndInteractive(revealTarget);

        // transition — the incoming section must end fully visible.
        const outgoing = makeTarget();
        const incoming = makeTarget();
        engine.transition(outgoing, incoming, opts);
        assertFinalVisibleAndInteractive(incoming);

        // Clean up DOM between runs.
        for (const el of [hero, revealTarget, outgoing, incoming]) el.remove();
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Task 7.3 — Unit tests: reduced-motion collapse, once-per-load, timing bounds
// ---------------------------------------------------------------------------

describe('AnimationEngine — reduced-motion collapse', () => {
  // Req 1.5 / 3.5 / 8.2: motion reveals collapse to an immediate final state.
  it('collapses a motion reveal to the final visible state with no motion tween', () => {
    const gsap = makeCompletingGsap();
    const st = makeScrollTrigger(true);
    const engine = createAnimationEngine({
      prefersReducedMotion: true,
      gsap: gsap.gsap,
      scrollTrigger: st.scrollTrigger,
    });

    const target = makeTarget();
    const opts: RevealOptions = {
      startDelayMs: 50,
      durationMs: 600,
      motion: { kind: 'translate', startDelayMs: 50, durationMs: 600 },
    };
    engine.reveal(target, opts);

    // Ends fully visible immediately...
    assertFinalVisibleAndInteractive(target);
    // ...with no scroll trigger scheduled and no motion tween driven.
    expect(st.created).toHaveLength(0);
    expect(gsap.tweenCount()).toBe(0);
  });

  // Req 1.5: hero collapses to its final resting state with no entrance tween.
  it('collapses the hero entrance to the final visible state with no tween', () => {
    const gsap = makeCompletingGsap();
    const engine = createAnimationEngine({
      prefersReducedMotion: true,
      gsap: gsap.gsap,
      scrollTrigger: makeScrollTrigger(false).scrollTrigger,
    });

    const hero = makeTarget();
    engine.heroEntrance(hero);

    assertFinalVisibleAndInteractive(hero);
    expect(gsap.tweenCount()).toBe(0);
  });
});

describe('AnimationEngine — once-per-load reveal', () => {
  // Req 3.3 / 4.6: a reveal is scheduled at most once per page load per target.
  it('schedules the scroll trigger exactly once per target even when reveal is called twice', () => {
    const gsap = makeCompletingGsap();
    // Do not fire onEnter so we only observe scheduling, not completion.
    const st = makeScrollTrigger(false);
    const engine = createAnimationEngine({
      prefersReducedMotion: false,
      gsap: gsap.gsap,
      scrollTrigger: st.scrollTrigger,
    });

    const target = makeTarget();
    const opts: RevealOptions = {
      startDelayMs: 0,
      durationMs: 500,
      motion: { kind: 'translate', startDelayMs: 0, durationMs: 500 },
    };

    engine.reveal(target, opts);
    engine.reveal(target, opts);

    expect(st.created).toHaveLength(1);
    expect(st.created[0].trigger).toBe(target);
  });

  it('schedules independently for distinct targets', () => {
    const gsap = makeCompletingGsap();
    const st = makeScrollTrigger(false);
    const engine = createAnimationEngine({
      prefersReducedMotion: false,
      gsap: gsap.gsap,
      scrollTrigger: st.scrollTrigger,
    });

    const a = makeTarget();
    const b = makeTarget();
    const opts: RevealOptions = {
      startDelayMs: 0,
      durationMs: 500,
      motion: { kind: 'translate', startDelayMs: 0, durationMs: 500 },
    };

    engine.reveal(a, opts);
    engine.reveal(b, opts);

    expect(st.created).toHaveLength(2);
  });
});

describe('AnimationEngine — timing bounds wiring', () => {
  // The engine passes SECONDS to gsap; convert back to ms for assertions.
  const toMs = (seconds: unknown): number => (seconds as number) * 1000;

  // Req 1.4: hero begins <=200ms and completes <=2000ms.
  it('clamps hero entrance start <=200ms and duration <=2000ms', () => {
    const gsap = makeCompletingGsap();
    const engine = createAnimationEngine({
      prefersReducedMotion: false,
      gsap: gsap.gsap,
      scrollTrigger: makeScrollTrigger(true).scrollTrigger,
    });

    engine.heroEntrance(makeTarget());

    expect(gsap.fromTo).toHaveLength(1);
    const { toVars } = gsap.fromTo[0];
    expect(toMs(toVars.delay)).toBeLessThanOrEqual(200);
    expect(toMs(toVars.duration)).toBeLessThanOrEqual(2000);
  });

  // Req 8.3: transition begins <=100ms and completes within 300-800ms.
  it('clamps transition start <=100ms and duration into 300-800ms (large request)', () => {
    const gsap = makeCompletingGsap();
    const engine = createAnimationEngine({
      prefersReducedMotion: false,
      gsap: gsap.gsap,
      scrollTrigger: makeScrollTrigger(true).scrollTrigger,
    });

    const opts: RevealOptions = {
      startDelayMs: 99_999,
      durationMs: 99_999,
      motion: { kind: 'fade', startDelayMs: 99_999, durationMs: 99_999 },
    };
    engine.transition(makeTarget(), makeTarget(), opts);

    // Two motion tweens (outgoing + incoming) share the clamped timing.
    expect(gsap.to.length).toBeGreaterThanOrEqual(2);
    for (const call of gsap.to) {
      expect(toMs(call.vars.delay)).toBeLessThanOrEqual(100);
      expect(toMs(call.vars.duration)).toBeGreaterThanOrEqual(300);
      expect(toMs(call.vars.duration)).toBeLessThanOrEqual(800);
    }
  });

  it('clamps transition duration UP to the 300ms floor (tiny request)', () => {
    const gsap = makeCompletingGsap();
    const engine = createAnimationEngine({
      prefersReducedMotion: false,
      gsap: gsap.gsap,
      scrollTrigger: makeScrollTrigger(true).scrollTrigger,
    });

    const opts: RevealOptions = {
      startDelayMs: 5,
      durationMs: 10,
      motion: { kind: 'fade', startDelayMs: 5, durationMs: 10 },
    };
    engine.transition(makeTarget(), makeTarget(), opts);

    expect(gsap.to.length).toBeGreaterThanOrEqual(2);
    for (const call of gsap.to) {
      expect(toMs(call.vars.duration)).toBeGreaterThanOrEqual(300);
    }
  });

  // Req 2.2 / 7.3: highlight applies within 150ms.
  it('clamps highlight duration <=150ms', () => {
    const gsap = makeCompletingGsap();
    const engine = createAnimationEngine({
      prefersReducedMotion: false,
      gsap: gsap.gsap,
      scrollTrigger: makeScrollTrigger(true).scrollTrigger,
    });

    engine.highlight(makeTarget());

    expect(gsap.to).toHaveLength(1);
    expect(toMs(gsap.to[0].vars.duration)).toBeLessThanOrEqual(150);
  });
});
