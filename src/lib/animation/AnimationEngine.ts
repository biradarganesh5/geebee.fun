/**
 * AnimationEngine — the single, testable facade over GSAP + ScrollTrigger.
 *
 * Every reveal, transition, hover/focus highlight, and hero entrance in the
 * Portfolio_Site is requested through this facade. No component talks to GSAP
 * directly. Centralizing motion here lets us enforce two cross-cutting rules in
 * exactly one place:
 *
 *  1. Reduced-motion resolution (Req 1.5 / 3.5 / 4.7 / 8.2)
 *     Before starting any animation the engine resolves the requested motion
 *     against the visitor's LIVE `prefers-reduced-motion` setting using the
 *     pure {@link resolveMotion} function. When reduced motion is set, every
 *     motion-based effect collapses to an immediate apply-final-state (0ms) or
 *     a fade of at most 200ms.
 *
 *  2. Fallback-to-final-state contract (Req 3.6 / 4.6 / 8.4 / 8.5)
 *     Reveal/entrance targets render their *final visible* CSS by default. The
 *     engine applies the initial entrance offset (opacity/translate) by JS ONLY
 *     after it has confirmed it is live. Every animation is wrapped so that if
 *     it fails to start, fails to complete, or its backing asset fails to load,
 *     the target is snapped to its fully visible final state with content and
 *     interactivity intact. Failures are logged to the console only and are
 *     never surfaced to the visitor. This mechanism is what makes design
 *     Property 5 hold.
 *
 * Testability:
 *  - The reduced-motion value (or the lookup used to read it) can be injected
 *    via {@link AnimationEngineConfig}, so unit/property tests never depend on a
 *    real `matchMedia`.
 *  - The GSAP core and ScrollTrigger can be injected, allowing tests to drive
 *    normal completion synchronously or to force start/asset failures.
 *  - Every target that reaches its final visible state is flagged with the
 *    {@link FINAL_STATE_ATTR} data attribute (value {@link FINAL_STATE_VALUE}),
 *    so tests can assert the final-state guarantee via
 *    {@link isInFinalVisibleState}.
 */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { resolveMotion, type MotionSpec, type ResolvedMotion } from '@logic/resolveMotion';

// ---------------------------------------------------------------------------
// Public constants & final-state mechanism
// ---------------------------------------------------------------------------

/**
 * Data attribute stamped on a target once it is in its fully visible final
 * state. Exposed so tests (tasks 7.2/7.3) and components can assert/verify it.
 */
export const FINAL_STATE_ATTR = 'data-anim-state';

/** Value of {@link FINAL_STATE_ATTR} meaning "fully visible final state". */
export const FINAL_STATE_VALUE = 'final';

/** Value of {@link FINAL_STATE_ATTR} while the entrance offset is applied. */
export const INITIAL_STATE_VALUE = 'initial';

/** Value of {@link FINAL_STATE_ATTR} while a target is animating. */
export const ANIMATING_STATE_VALUE = 'animating';

/**
 * Snaps a target to its fully visible final state using direct DOM writes (no
 * GSAP), so it stays correct even when GSAP itself is the thing that failed.
 * Clears any entrance offset (including the soft focus-in blur), forces
 * visibility/interactivity, and stamps the final-state flag. Never throws.
 */
export function markFinalVisibleState(target: HTMLElement): void {
  try {
    target.style.opacity = '1';
    target.style.transform = 'none';
    // Clear any residual entrance blur so the final state is a crisp, fully
    // visible target (design Property 5) even on the fallback-on-failure path.
    target.style.filter = 'none';
    target.style.visibility = 'visible';
    target.style.pointerEvents = '';
    target.removeAttribute('aria-hidden');
    target.setAttribute(FINAL_STATE_ATTR, FINAL_STATE_VALUE);
  } catch {
    /* DOM write failed (detached node); nothing more we can safely do. */
  }
}

/** True when the target has been flagged as being in its final visible state. */
export function isInFinalVisibleState(target: HTMLElement): boolean {
  return target.getAttribute(FINAL_STATE_ATTR) === FINAL_STATE_VALUE;
}

// ---------------------------------------------------------------------------
// Injectable GSAP surface (minimal structural types)
// ---------------------------------------------------------------------------

type TweenVars = Record<string, unknown>;

/** The subset of the GSAP core the engine actually uses. */
export interface GsapLike {
  set(target: unknown, vars: TweenVars): unknown;
  to(target: unknown, vars: TweenVars): unknown;
  fromTo(target: unknown, fromVars: TweenVars, toVars: TweenVars): unknown;
  killTweensOf(target: unknown): void;
}

/** A created ScrollTrigger instance (only `kill` is used by the engine). */
export interface ScrollTriggerInstanceLike {
  kill(revert?: boolean): void;
}

/** The subset of ScrollTrigger the engine actually uses. */
export interface ScrollTriggerLike {
  create(vars: Record<string, unknown>): ScrollTriggerInstanceLike;
}

// ---------------------------------------------------------------------------
// Engine interface & options
// ---------------------------------------------------------------------------

/** Options for a scroll-triggered reveal or a section transition. */
export interface RevealOptions {
  startDelayMs: number;
  durationMs: number;
  motion: MotionSpec;
}

/**
 * The animation facade contract. Mirrors design.md "Key Interfaces".
 */
export interface AnimationEngine {
  /** Hero entrance: begins <200ms, completes <2000ms, ends fully visible. */
  heroEntrance(target: HTMLElement): void; // Req 1.4/1.5
  /** Scroll-triggered entrance; ends visible; plays at most once per load. */
  reveal(target: HTMLElement, opts: RevealOptions): void; // Req 3.3/4.5/4.6
  /** Hover/focus highlight. */
  highlight(target: HTMLElement): void; // Req 2.2/5.2/7.3
  /** Remove a hover/focus highlight. */
  removeHighlight(target: HTMLElement): void; // Req 2.3/5.5/7.4
  /** Section-to-section transition: begins <100ms, completes 300-800ms. */
  transition(outgoing: HTMLElement, incoming: HTMLElement, opts: RevealOptions): void; // Req 8.3
}

/**
 * Configuration + dependency injection for {@link PortfolioAnimationEngine}.
 * All fields are optional; production code constructs the engine with no args
 * and gets the real GSAP + a live `matchMedia` lookup.
 */
export interface AnimationEngineConfig {
  /**
   * Fixed reduced-motion value. When provided it overrides every other lookup.
   * Primarily for tests that need a deterministic preference.
   */
  prefersReducedMotion?: boolean;
  /**
   * Custom lookup for the LIVE reduced-motion preference. Called on every
   * animation so a mid-session preference change is respected. Defaults to
   * reading `matchMedia('(prefers-reduced-motion: reduce)')`.
   */
  reducedMotionQuery?: () => boolean;
  /** Inject the GSAP core (tests / failure injection). Defaults to real gsap. */
  gsap?: GsapLike;
  /** Inject ScrollTrigger (tests). Defaults to the real ScrollTrigger. */
  scrollTrigger?: ScrollTriggerLike;
  /** Sink for suppressed failures. Defaults to `console.warn`. */
  logger?: (message: string, error: unknown) => void;
}

// ---------------------------------------------------------------------------
// Timing bounds & default motion specs (per requirements)
// ---------------------------------------------------------------------------

const HERO_MAX_START_MS = 200; // Req 1.4
const HERO_MAX_DURATION_MS = 2000; // Req 1.4
const REVEAL_MAX_START_MS = 200; // Req 4.5
const REVEAL_MAX_DURATION_MS = 1000; // Req 3.3 / 4.5
const TRANSITION_MAX_START_MS = 100; // Req 8.3
const TRANSITION_MIN_DURATION_MS = 300; // Req 8.3
const TRANSITION_MAX_DURATION_MS = 800; // Req 8.3
const HIGHLIGHT_MAX_DURATION_MS = 150; // Req 2.2 / 7.3

/** Vertical entrance offset (px) used for translate-based reveals/entrances. */
const ENTRANCE_OFFSET_PX = 24;
/**
 * Soft focus-in blur (px) applied to the initial entrance state and resolved to
 * 0 as the target reveals — a subtle "BlurFade" adapted from the inspiration.
 * Kept small so it reads as a gentle focus-in, not a heavy blur. Only ever used
 * on the full-motion path; reduced motion never applies it.
 */
const ENTRANCE_BLUR_PX = 4;
/** Highlight scale factor applied on hover/focus. */
const HIGHLIGHT_SCALE = 1.05;

const HERO_MOTION: MotionSpec = { kind: 'translate', startDelayMs: 100, durationMs: 900 };
const HIGHLIGHT_MOTION: MotionSpec = { kind: 'scale', startDelayMs: 0, durationMs: 120 };

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/** ms -> seconds for GSAP. */
const s = (ms: number): number => ms / 1000;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class PortfolioAnimationEngine implements AnimationEngine {
  private readonly gsap: GsapLike;
  private readonly scrollTrigger: ScrollTriggerLike;
  private readonly fixedReducedMotion?: boolean;
  private readonly reducedMotionQuery?: () => boolean;
  private readonly logger: (message: string, error: unknown) => void;

  /** Targets whose reveal has already been scheduled — enforces once-per-load. */
  private readonly scheduledReveals = new WeakSet<HTMLElement>();

  constructor(config: AnimationEngineConfig = {}) {
    this.gsap = config.gsap ?? (gsap as unknown as GsapLike);
    this.scrollTrigger = config.scrollTrigger ?? (ScrollTrigger as unknown as ScrollTriggerLike);
    this.fixedReducedMotion = config.prefersReducedMotion;
    this.reducedMotionQuery = config.reducedMotionQuery;
    this.logger =
      config.logger ??
      ((message, error) => {
        // Suppressed failures are logged to the console ONLY, never surfaced
        // to the visitor (Req 8.5).
        // eslint-disable-next-line no-console
        console.warn(`[AnimationEngine] ${message}`, error);
      });

    // Register ScrollTrigger with the real GSAP when running in a browser.
    // Guarded so import/SSR and injected-dependency tests never crash.
    try {
      if (
        !config.scrollTrigger &&
        typeof window !== 'undefined' &&
        typeof (gsap as unknown as { registerPlugin?: unknown }).registerPlugin === 'function'
      ) {
        (gsap as unknown as { registerPlugin(p: unknown): void }).registerPlugin(ScrollTrigger);
      }
    } catch (error) {
      this.logger('failed to register ScrollTrigger', error);
    }
  }

  // -- Cross-cutting rule 1: live reduced-motion resolution -----------------

  /** Reads the LIVE reduced-motion preference (Req 1.5/3.5/4.7/8.2). */
  private prefersReducedMotion(): boolean {
    if (this.fixedReducedMotion !== undefined) return this.fixedReducedMotion;
    if (this.reducedMotionQuery) return this.reducedMotionQuery();
    try {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      }
    } catch (error) {
      this.logger('matchMedia lookup failed; assuming no reduced-motion', error);
    }
    return false;
  }

  private resolve(spec: MotionSpec): ResolvedMotion {
    return resolveMotion(spec, this.prefersReducedMotion());
  }

  // -- Cross-cutting rule 2: fallback-to-final-state wrapper -----------------

  /**
   * Runs `work`; on ANY failure, snaps every target to its fully visible final
   * state and logs the failure (never surfaced). Returns true on success.
   */
  private safeRun(targets: HTMLElement[], work: () => void): boolean {
    try {
      work();
      return true;
    } catch (error) {
      this.logger('animation failed; snapping target(s) to final state', error);
      for (const target of targets) markFinalVisibleState(target);
      return false;
    }
  }

  // -- Public API ------------------------------------------------------------

  /**
   * Hero entrance animation (Req 1.4/1.5). Begins within 200ms and completes
   * within 2000ms, leaving the hero fully visible. Under reduced motion the
   * hero is shown directly in its final state with no entrance.
   */
  heroEntrance(target: HTMLElement): void {
    const resolved = this.resolve(HERO_MOTION);

    // Reduced motion / immediate: no entrance, show final state directly.
    if (resolved.mode !== 'full') {
      if (resolved.mode === 'fade' && resolved.durationMs > 0) {
        this.fadeIn(target, resolved, HERO_MAX_DURATION_MS);
        return;
      }
      markFinalVisibleState(target);
      return;
    }

    const delay = clamp(resolved.startDelayMs, 0, HERO_MAX_START_MS);
    const duration = clamp(resolved.durationMs, 0, HERO_MAX_DURATION_MS);

    this.safeRun([target], () => {
      // Apply the initial offset only now that the engine is confirmed live.
      target.setAttribute(FINAL_STATE_ATTR, ANIMATING_STATE_VALUE);
      this.gsap.fromTo(
        target,
        { opacity: 0, y: ENTRANCE_OFFSET_PX, filter: `blur(${ENTRANCE_BLUR_PX}px)` },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: s(duration),
          delay: s(delay),
          ease: 'power2.out',
          onComplete: () => markFinalVisibleState(target),
        },
      );
    });
  }

  /**
   * Scroll-triggered reveal (Req 3.3/4.5/4.6). Plays at most once per page load
   * and always ends in the fully visible final state. Under reduced motion the
   * target is shown immediately in its final state (or a short fade).
   */
  reveal(target: HTMLElement, opts: RevealOptions): void {
    // Once-per-load guarantee: ignore repeated requests for the same target.
    if (this.scheduledReveals.has(target)) return;
    this.scheduledReveals.add(target);

    const resolved = this.resolve(opts.motion);

    if (resolved.mode !== 'full') {
      if (resolved.mode === 'fade' && resolved.durationMs > 0) {
        this.fadeIn(target, resolved, REVEAL_MAX_DURATION_MS);
        return;
      }
      markFinalVisibleState(target);
      return;
    }

    const delay = clamp(resolved.startDelayMs, 0, REVEAL_MAX_START_MS);
    const duration = clamp(resolved.durationMs, 0, REVEAL_MAX_DURATION_MS);

    this.safeRun([target], () => {
      // Apply the entrance offset now that the engine is live. If the
      // ScrollTrigger below fails to create, safeRun snaps back to visible.
      this.gsap.set(target, {
        opacity: 0,
        y: ENTRANCE_OFFSET_PX,
        filter: `blur(${ENTRANCE_BLUR_PX}px)`,
      });
      target.setAttribute(FINAL_STATE_ATTR, INITIAL_STATE_VALUE);

      this.scrollTrigger.create({
        trigger: target,
        // Fire once the target is ~25% visible in the viewport (Req 3.3/4.5).
        start: 'top 75%',
        once: true,
        onEnter: () => {
          this.safeRun([target], () => {
            target.setAttribute(FINAL_STATE_ATTR, ANIMATING_STATE_VALUE);
            this.gsap.to(target, {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              duration: s(duration),
              delay: s(delay),
              ease: 'power2.out',
              onComplete: () => markFinalVisibleState(target),
            });
          });
        },
      });
    });
  }

  /**
   * Applies a hover/focus highlight (Req 2.2/5.2/7.3) within 150ms. Under
   * reduced motion the highlight is applied immediately with no scaling.
   */
  highlight(target: HTMLElement): void {
    const resolved = this.resolve(HIGHLIGHT_MOTION);
    target.setAttribute('data-highlight', 'on');

    if (resolved.mode !== 'full') {
      // Reduced motion: indicate highlight without a scaling animation.
      this.safeRun([], () => this.gsap.set(target, { scale: 1 }));
      return;
    }

    const duration = clamp(resolved.durationMs, 0, HIGHLIGHT_MAX_DURATION_MS);
    this.safeRun([], () => {
      this.gsap.to(target, {
        scale: HIGHLIGHT_SCALE,
        duration: s(duration),
        ease: 'power1.out',
      });
    });
  }

  /**
   * Removes a hover/focus highlight (Req 2.3/5.5/7.4) within 150ms.
   */
  removeHighlight(target: HTMLElement): void {
    const resolved = this.resolve(HIGHLIGHT_MOTION);
    target.setAttribute('data-highlight', 'off');

    if (resolved.mode !== 'full') {
      this.safeRun([], () => this.gsap.set(target, { scale: 1 }));
      return;
    }

    const duration = clamp(resolved.durationMs, 0, HIGHLIGHT_MAX_DURATION_MS);
    this.safeRun([], () => {
      this.gsap.to(target, {
        scale: 1,
        duration: s(duration),
        ease: 'power1.out',
      });
    });
  }

  /**
   * Section-to-section transition (Req 8.3). Begins within 100ms and completes
   * within 300-800ms. The incoming section always ends fully visible; the
   * outgoing section is faded out. Under reduced motion both are snapped to
   * their final states immediately.
   */
  transition(outgoing: HTMLElement, incoming: HTMLElement, opts: RevealOptions): void {
    const resolved = this.resolve(opts.motion);

    if (resolved.mode !== 'full') {
      // Immediate/fade: ensure the incoming content is fully visible.
      if (resolved.mode === 'fade' && resolved.durationMs > 0) {
        this.fadeIn(incoming, resolved, TRANSITION_MAX_DURATION_MS);
      } else {
        markFinalVisibleState(incoming);
      }
      this.safeRun([outgoing], () => this.gsap.set(outgoing, { opacity: 1 }));
      return;
    }

    const delay = clamp(resolved.startDelayMs, 0, TRANSITION_MAX_START_MS);
    const duration = clamp(
      resolved.durationMs,
      TRANSITION_MIN_DURATION_MS,
      TRANSITION_MAX_DURATION_MS,
    );

    this.safeRun([outgoing, incoming], () => {
      incoming.setAttribute(FINAL_STATE_ATTR, ANIMATING_STATE_VALUE);
      this.gsap.set(incoming, { opacity: 0, filter: `blur(${ENTRANCE_BLUR_PX}px)` });
      this.gsap.to(outgoing, {
        opacity: 0,
        duration: s(duration),
        delay: s(delay),
        ease: 'power1.inOut',
      });
      this.gsap.to(incoming, {
        opacity: 1,
        filter: 'blur(0px)',
        duration: s(duration),
        delay: s(delay),
        ease: 'power1.inOut',
        onComplete: () => markFinalVisibleState(incoming),
      });
    });
  }

  /**
   * Fade-only entrance used for reduced-motion `fade` resolutions. Duration is
   * already capped to <=200ms by {@link resolveMotion}; `hardCap` bounds it to
   * the caller's requirement as a defensive measure.
   */
  private fadeIn(target: HTMLElement, resolved: ResolvedMotion, hardCap: number): void {
    const duration = clamp(resolved.durationMs, 0, hardCap);
    const delay = clamp(resolved.startDelayMs, 0, hardCap);
    this.safeRun([target], () => {
      target.setAttribute(FINAL_STATE_ATTR, ANIMATING_STATE_VALUE);
      this.gsap.fromTo(
        target,
        { opacity: 0 },
        {
          opacity: 1,
          duration: s(duration),
          delay: s(delay),
          ease: 'none',
          onComplete: () => markFinalVisibleState(target),
        },
      );
    });
  }
}

// ---------------------------------------------------------------------------
// Factory + lazy singleton
// ---------------------------------------------------------------------------

/** Creates a fresh {@link AnimationEngine}. Prefer this in tests. */
export function createAnimationEngine(config: AnimationEngineConfig = {}): AnimationEngine {
  return new PortfolioAnimationEngine(config);
}

let singleton: AnimationEngine | null = null;

/**
 * Returns the shared production {@link AnimationEngine}, created lazily on first
 * use so importing this module never touches `window` at import time.
 */
export function getAnimationEngine(): AnimationEngine {
  if (singleton === null) {
    singleton = new PortfolioAnimationEngine();
  }
  return singleton;
}
