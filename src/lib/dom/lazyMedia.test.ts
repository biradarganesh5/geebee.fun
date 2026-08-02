/**
 * Unit tests for the lazyMedia utility (Req 10.3).
 *
 * Covers:
 *  - `promoteLazyMedia` copies data-src/data-srcset to src/srcset, clears the
 *    lazy markers, and is idempotent.
 *  - `initLazyMedia` uses a one-viewport-height rootMargin, promotes elements
 *    only once they intersect, and unobserves them afterward.
 *  - Resilient fallbacks: when IntersectionObserver is missing or observer
 *    setup throws, all opt-in media are promoted immediately so nothing is
 *    left hidden.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LAZY_ATTR,
  ONE_VIEWPORT_ROOT_MARGIN,
  initLazyMedia,
  promoteAllLazyMedia,
  promoteLazyMedia,
} from './lazyMedia';

// -----------------------------------------------------------------------------
// A controllable IntersectionObserver mock: tests can trigger intersection.
// -----------------------------------------------------------------------------

interface MockObserverInstance {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Set<Element>;
  disconnected: boolean;
  self: IntersectionObserver;
}

let observers: MockObserverInstance[] = [];

function installMockIntersectionObserver(): void {
  class MockIO {
    callback: IntersectionObserverCallback;
    options: IntersectionObserverInit | undefined;
    observed = new Set<Element>();
    disconnected = false;

    constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = cb;
      this.options = options;
      observers.push({
        callback: cb,
        options,
        observed: this.observed,
        disconnected: false,
        self: this as unknown as IntersectionObserver,
      });
    }

    observe(el: Element): void {
      this.observed.add(el);
    }

    unobserve(el: Element): void {
      this.observed.delete(el);
    }

    disconnect(): void {
      this.disconnected = true;
      this.observed.clear();
      const rec = observers.find((o) => o.self === (this as unknown as IntersectionObserver));
      if (rec) rec.disconnected = true;
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  vi.stubGlobal('IntersectionObserver', MockIO as unknown as typeof IntersectionObserver);
}

/** Fire an intersection for the given elements on the most recent observer. */
function triggerIntersection(els: Element[], isIntersecting = true): void {
  const rec = observers[observers.length - 1];
  const entries = els.map(
    (target) => ({ target, isIntersecting }) as unknown as IntersectionObserverEntry,
  );
  rec.callback(entries, rec.self);
}

function makeLazyImg(src: string, srcset?: string): HTMLImageElement {
  const img = document.createElement('img');
  img.setAttribute(LAZY_ATTR, 'true');
  img.setAttribute('data-src', src);
  if (srcset !== undefined) img.setAttribute('data-srcset', srcset);
  document.body.appendChild(img);
  return img;
}

afterEach(() => {
  observers = [];
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

// -----------------------------------------------------------------------------
// promoteLazyMedia
// -----------------------------------------------------------------------------

describe('promoteLazyMedia', () => {
  it('copies data-src/data-srcset to src/srcset and clears lazy markers', () => {
    const img = makeLazyImg('/images/cert.avif', '/images/cert.avif 800w');

    promoteLazyMedia(img);

    expect(img.getAttribute('src')).toBe('/images/cert.avif');
    expect(img.getAttribute('srcset')).toBe('/images/cert.avif 800w');
    expect(img.hasAttribute('data-src')).toBe(false);
    expect(img.hasAttribute('data-srcset')).toBe(false);
    expect(img.hasAttribute(LAZY_ATTR)).toBe(false);
    expect(img.getAttribute('data-lazy-loaded')).toBe('true');
  });

  it('promotes an element that only has data-src', () => {
    const img = makeLazyImg('/images/only-src.webp');

    promoteLazyMedia(img);

    expect(img.getAttribute('src')).toBe('/images/only-src.webp');
    expect(img.hasAttribute('srcset')).toBe(false);
  });

  it('is idempotent (a second call does not change or re-add anything)', () => {
    const img = makeLazyImg('/images/cert.avif');
    promoteLazyMedia(img);
    const after = img.outerHTML;

    promoteLazyMedia(img);

    expect(img.outerHTML).toBe(after);
  });
});

// -----------------------------------------------------------------------------
// initLazyMedia — IntersectionObserver path
// -----------------------------------------------------------------------------

describe('initLazyMedia with IntersectionObserver', () => {
  beforeEach(() => {
    installMockIntersectionObserver();
  });

  it('uses a one-viewport-height rootMargin (Req 10.3)', () => {
    makeLazyImg('/a.jpg');
    initLazyMedia();

    expect(observers).toHaveLength(1);
    expect(observers[0].options?.rootMargin).toBe(ONE_VIEWPORT_ROOT_MARGIN);
    expect(ONE_VIEWPORT_ROOT_MARGIN).toBe('100% 0px');
  });

  it('does not load media before it intersects', () => {
    const img = makeLazyImg('/a.jpg');
    initLazyMedia();

    expect(img.hasAttribute('src')).toBe(false);
    expect(img.hasAttribute(LAZY_ATTR)).toBe(true);
    expect(observers[0].observed.has(img)).toBe(true);
  });

  it('promotes and unobserves an element once it comes within one viewport', () => {
    const img = makeLazyImg('/a.jpg', '/a.jpg 400w');
    initLazyMedia();

    triggerIntersection([img]);

    expect(img.getAttribute('src')).toBe('/a.jpg');
    expect(img.getAttribute('srcset')).toBe('/a.jpg 400w');
    expect(observers[0].observed.has(img)).toBe(false);
  });

  it('leaves non-intersecting elements untouched', () => {
    const a = makeLazyImg('/a.jpg');
    const b = makeLazyImg('/b.jpg');
    initLazyMedia();

    triggerIntersection([a], true);

    expect(a.getAttribute('src')).toBe('/a.jpg');
    expect(b.hasAttribute('src')).toBe(false);
    expect(b.hasAttribute(LAZY_ATTR)).toBe(true);
  });

  it('ignores entries that are not intersecting', () => {
    const img = makeLazyImg('/a.jpg');
    initLazyMedia();

    triggerIntersection([img], false);

    expect(img.hasAttribute('src')).toBe(false);
    expect(img.hasAttribute(LAZY_ATTR)).toBe(true);
  });

  it('returns a disposer that disconnects the observer', () => {
    makeLazyImg('/a.jpg');
    const dispose = initLazyMedia();

    dispose();

    expect(observers[0].disconnected).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// initLazyMedia — resilient fallbacks
// -----------------------------------------------------------------------------

describe('initLazyMedia resilience', () => {
  it('promotes all media immediately when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const a = makeLazyImg('/a.jpg');
    const b = makeLazyImg('/b.jpg', '/b.jpg 200w');

    initLazyMedia();

    expect(a.getAttribute('src')).toBe('/a.jpg');
    expect(b.getAttribute('src')).toBe('/b.jpg');
    expect(b.getAttribute('srcset')).toBe('/b.jpg 200w');
    expect(a.hasAttribute(LAZY_ATTR)).toBe(false);
  });

  it('promotes all media immediately when observer setup throws', () => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor() {
          throw new Error('boom');
        }
      } as unknown as typeof IntersectionObserver,
    );
    const img = makeLazyImg('/a.jpg');

    // Must not throw, and must still load the media.
    expect(() => initLazyMedia()).not.toThrow();
    expect(img.getAttribute('src')).toBe('/a.jpg');
  });
});

// -----------------------------------------------------------------------------
// promoteAllLazyMedia
// -----------------------------------------------------------------------------

describe('promoteAllLazyMedia', () => {
  it('promotes every opt-in element in scope', () => {
    const a = makeLazyImg('/a.jpg');
    const b = makeLazyImg('/b.jpg');

    promoteAllLazyMedia();

    expect(a.getAttribute('src')).toBe('/a.jpg');
    expect(b.getAttribute('src')).toBe('/b.jpg');
  });

  it('does not touch elements without the opt-in attribute', () => {
    const plain = document.createElement('img');
    plain.setAttribute('data-src', '/should-not-load.jpg');
    document.body.appendChild(plain);

    promoteAllLazyMedia();

    expect(plain.hasAttribute('src')).toBe(false);
    expect(plain.getAttribute('data-src')).toBe('/should-not-load.jpg');
  });
});
