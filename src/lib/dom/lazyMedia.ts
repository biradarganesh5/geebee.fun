/**
 * lazyMedia — shared client utility for below-the-fold, non-critical media.
 *
 * Requirement 10.3: "WHEN a section below the Landing_Page comes within one
 * Viewport height of the Visitor's current scroll position, THE Portfolio_Site
 * SHALL begin loading that section's non-critical media."
 *
 * Native `loading="lazy"` already defers offscreen images, but the browser's
 * lazy `rootMargin` is implementation-defined and typically larger than one
 * viewport. To satisfy the explicit "within one viewport height" trigger this
 * utility drives an {@link IntersectionObserver} whose `rootMargin` is exactly
 * one viewport height (`100% 0px` — one full viewport above and below), and
 * promotes an element's real `src`/`srcset` from its `data-src`/`data-srcset`
 * only once it enters that margin.
 *
 * Opt-in model: only elements carrying the `data-lazy` attribute (with a
 * `data-src` and/or `data-srcset`) are managed here. The Hero_Image is
 * above-the-fold/critical (`fetchpriority="high"`, eager) and is NOT marked
 * `data-lazy`, so it is never deferred by this utility.
 *
 * Resilience (design.md "Error Handling" — degrade to visible content):
 *  - If `IntersectionObserver` is unavailable, or observer setup throws, every
 *    managed element is promoted immediately (eager) so nothing stays hidden.
 *  - Elements should also keep a native `loading="lazy"` hint as a second line
 *    of defense: even if this script never runs, the browser still loads them.
 */

/** Attribute marking a media element as managed by this lazy loader. */
export const LAZY_ATTR = 'data-lazy';

/**
 * `rootMargin` covering exactly one viewport height above and below the
 * viewport, so loading begins when the element is within one viewport height of
 * the current scroll position (Req 10.3).
 */
export const ONE_VIEWPORT_ROOT_MARGIN = '100% 0px';

/** Default selector for opt-in lazy media. */
const DEFAULT_SELECTOR = `[${LAZY_ATTR}]`;

export interface InitLazyMediaOptions {
  /** Scroll root; defaults to the viewport (null). */
  root?: Element | Document | null;
  /** Override the trigger margin; defaults to one viewport height. */
  rootMargin?: string;
  /** Override the opt-in selector; defaults to `[data-lazy]`. */
  selector?: string;
  /** Document/scope to query for lazy media; defaults to `document`. */
  scope?: Document | Element;
}

/**
 * Promote a single lazy media element to its real source: copy `data-srcset`
 * to `srcset` and `data-src` to `src`, then clear the lazy markers so it is not
 * processed again. Safe to call more than once (idempotent) and safe for any
 * element type that uses `src`/`srcset` (`<img>`, `<source>`, `<video>`, …).
 */
export function promoteLazyMedia(el: Element): void {
  // `srcset` must be assigned before `src` so a responsive `<img>`/`<source>`
  // can pick the best candidate rather than eagerly fetching the `src`.
  const dataSrcset = el.getAttribute('data-srcset');
  if (dataSrcset !== null) {
    el.setAttribute('srcset', dataSrcset);
    el.removeAttribute('data-srcset');
  }

  const dataSrc = el.getAttribute('data-src');
  if (dataSrc !== null) {
    el.setAttribute('src', dataSrc);
    el.removeAttribute('data-src');
  }

  // Clear the opt-in marker and flag as loaded so observers/fallbacks skip it.
  el.removeAttribute(LAZY_ATTR);
  el.setAttribute('data-lazy-loaded', 'true');
}

/**
 * Promote every currently-matched lazy media element immediately. Used as the
 * resilient fallback when IntersectionObserver is unavailable or setup fails,
 * so no opt-in media is ever left permanently unloaded.
 */
export function promoteAllLazyMedia(
  scope: Document | Element = document,
  selector: string = DEFAULT_SELECTOR,
): void {
  const nodes = scope.querySelectorAll(selector);
  nodes.forEach((node) => promoteLazyMedia(node));
}

/**
 * Initialize lazy loading of below-the-fold non-critical media.
 *
 * Observes every opt-in (`data-lazy`) element and promotes it to its real
 * source once it comes within one viewport height of the current scroll
 * position (Req 10.3). Returns a disposer that disconnects the observer.
 *
 * Degrades gracefully: if `IntersectionObserver` is missing or setup throws,
 * all matched media are promoted immediately instead of being deferred.
 */
export function initLazyMedia(options: InitLazyMediaOptions = {}): () => void {
  const {
    root = null,
    rootMargin = ONE_VIEWPORT_ROOT_MARGIN,
    selector = DEFAULT_SELECTOR,
    scope = document,
  } = options;

  const noop = (): void => {};

  // No IntersectionObserver support → load everything now so nothing is hidden.
  if (typeof IntersectionObserver === 'undefined') {
    promoteAllLazyMedia(scope, selector);
    return noop;
  }

  try {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          promoteLazyMedia(entry.target);
          obs.unobserve(entry.target);
        }
      },
      { root, rootMargin, threshold: 0 },
    );

    const nodes = scope.querySelectorAll(selector);
    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  } catch {
    // Any failure wiring up the observer must not leave media unloaded.
    promoteAllLazyMedia(scope, selector);
    return noop;
  }
}
