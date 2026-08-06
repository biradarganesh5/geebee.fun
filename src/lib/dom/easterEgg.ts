/**
 * easterEgg — a small, self-contained "this site is self-hosted" easter egg.
 *
 * The site is served from Ganesh's own homelab (a k3s cluster of mini PCs +
 * TrueNAS), so this module winks at anyone who goes looking under the hood:
 *
 *  1. {@link printHomelabConsoleBanner} prints a styled banner to the browser
 *     console — the classic "hello, curious developer" easter egg — announcing
 *     that the page they're viewing is running on hardware at home.
 *  2. {@link initKonamiEasterEgg} listens for the Konami code
 *     (↑ ↑ ↓ ↓ ← → ← → B A) and, when entered, pops a tasteful little toast
 *     saying the same thing, then auto-dismisses it.
 *
 * Both are purely decorative and degrade to nothing: they never block render,
 * never throw into the page, and respect `prefers-reduced-motion` for the
 * toast animation. Everything is guarded so it is a no-op during SSR.
 */

/** The message shared by the console banner and the toast. */
const HOMELAB_MESSAGE =
  'This very page is self-hosted — served from my homelab, a k3s cluster of mini PCs and a TrueNAS box humming away at home. No big cloud here, just hardware I can reach out and touch.';

/** Attribute/id used to ensure only one toast exists at a time. */
const TOAST_ID = 'homelab-easter-egg-toast';

/** The Konami code sequence (KeyboardEvent.key values, case-insensitive). */
export const KONAMI_SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
] as const;

/**
 * Print a styled, multi-line banner to the console announcing that the site is
 * self-hosted on the homelab. Safe to call anywhere; a no-op if there's no
 * usable console. Never throws.
 */
export function printHomelabConsoleBanner(): void {
  try {
    if (typeof console === 'undefined' || typeof console.log !== 'function') {
      return;
    }

    const title = '%c🏡  Yep — this site runs on my homelab.';
    const body = `%c${HOMELAB_MESSAGE}\n\nPoke around, and if you build one too, say hi. 👋`;

    const titleStyle = [
      'font-size:14px',
      'font-weight:700',
      'padding:6px 0',
      'color:#38bdf8', // sky-400, matches the site accent
    ].join(';');

    const bodyStyle = [
      'font-size:12px',
      'line-height:1.5',
      'color:#a3a3a3', // neutral-400, muted foreground
    ].join(';');

    console.log(`${title}\n${body}`, titleStyle, bodyStyle);
  } catch {
    // A cosmetic console message must never affect the page.
  }
}

/**
 * Build (once) and return the toast element that announces the self-hosting.
 * Styled with the site's semantic color tokens so it matches both themes.
 */
function createToast(doc: Document): HTMLElement {
  const toast = doc.createElement('div');
  toast.id = TOAST_ID;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  toast.style.cssText = [
    'position:fixed',
    'left:1rem',
    'bottom:1rem',
    'z-index:2147483647',
    'max-width:min(22rem, calc(100vw - 2rem))',
    'padding:0.875rem 1rem',
    'border-radius:0.75rem',
    'border:1px solid rgb(var(--border))',
    'background:rgb(var(--card))',
    'color:rgb(var(--card-foreground))',
    'box-shadow:0 10px 30px rgba(0,0,0,0.35)',
    'font-size:0.875rem',
    'line-height:1.45',
    // Start hidden/offset; a rAF flips these for a gentle slide-in.
    'opacity:0',
    'transform:translateY(0.75rem)',
    'transition:opacity 220ms ease, transform 220ms ease',
  ].join(';');

  const heading = doc.createElement('div');
  heading.style.cssText =
    'font-weight:600;margin-bottom:0.25rem;color:rgb(var(--primary))';
  heading.textContent = 'Served fresh from the homelab';

  const text = doc.createElement('div');
  text.style.cssText = 'color:rgb(var(--muted-foreground))';
  text.textContent = HOMELAB_MESSAGE;

  toast.append(heading, text);
  return toast;
}

/**
 * Show the self-hosting toast (idempotent — re-triggering just resets the
 * dismiss timer). Slides in, then auto-dismisses after a few seconds. Respects
 * reduced-motion by skipping the transition. Never throws.
 */
export function showHomelabToast(doc: Document = document): void {
  try {
    const existing = doc.getElementById(TOAST_ID);
    if (existing) {
      // Restart the dismiss timer if it's already on screen.
      const restart = Number(existing.dataset.dismissAt);
      if (!Number.isNaN(restart)) existing.dataset.dismissAt = String(Date.now());
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const toast = createToast(doc);
    doc.body.appendChild(toast);

    const reveal = (): void => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    };

    if (prefersReducedMotion) {
      toast.style.transition = 'none';
      reveal();
    } else {
      // Next frame so the initial (hidden) styles are committed first.
      requestAnimationFrame(reveal);
    }

    const remove = (): void => {
      const done = (): void => toast.remove();
      if (prefersReducedMotion) {
        done();
        return;
      }
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(0.75rem)';
      toast.addEventListener('transitionend', done, { once: true });
      // Safety net in case the transitionend never fires.
      setTimeout(done, 400);
    };

    // Dismiss on click, or automatically after ~12s.
    toast.addEventListener('click', remove, { once: true });
    setTimeout(remove, 12000);
  } catch {
    // The toast is a treat, not a requirement — swallow any failure.
  }
}

/**
 * Wire up the Konami-code listener. When the sequence
 * (↑ ↑ ↓ ↓ ← → ← → B A) is entered, {@link showHomelabToast} fires.
 * Returns a disposer that removes the listener. No-op / safe during SSR.
 */
export function initKonamiEasterEgg(
  target: Document | null = typeof document !== 'undefined' ? document : null,
): () => void {
  const noop = (): void => {};
  if (!target || typeof target.addEventListener !== 'function') return noop;

  let progress = 0;

  const onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key;
    const expected = KONAMI_SEQUENCE[progress];
    const matches =
      key === expected ||
      // Letters (b/a) should match regardless of Shift/caps.
      (typeof key === 'string' && key.toLowerCase() === expected.toLowerCase());

    if (matches) {
      progress += 1;
      if (progress === KONAMI_SEQUENCE.length) {
        progress = 0;
        showHomelabToast(target as Document);
      }
    } else {
      // Allow a mismatch to also be the start of a fresh sequence.
      progress = key === KONAMI_SEQUENCE[0] ? 1 : 0;
    }
  };

  target.addEventListener('keydown', onKeyDown);
  return () => target.removeEventListener('keydown', onKeyDown);
}

/** Id of the visible self-hosting badge rendered in the page footer. */
export const BADGE_ID = 'homelab-badge';

/**
 * Wire the visible footer badge so clicking it shows the toast. Returns a
 * disposer that removes the listener. No-op if the badge isn't present.
 */
export function initHomelabBadge(doc: Document = document): () => void {
  const noop = (): void => {};
  const badge = doc.getElementById(BADGE_ID);
  if (!badge) return noop;

  const onClick = (): void => showHomelabToast(doc);
  badge.addEventListener('click', onClick);
  return () => badge.removeEventListener('click', onClick);
}

/**
 * Convenience initializer: print the console banner, arm the Konami code, and
 * wire the visible footer badge. Returns a disposer for the listeners. Safe to
 * call during SSR (no-op).
 */
export function initHomelabEasterEgg(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }
  printHomelabConsoleBanner();
  const disposeKonami = initKonamiEasterEgg(document);
  const disposeBadge = initHomelabBadge(document);
  return () => {
    disposeKonami();
    disposeBadge();
  };
}
