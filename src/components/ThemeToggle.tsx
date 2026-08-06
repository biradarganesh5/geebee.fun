/**
 * ThemeToggle — light/dark theme switch (React island).
 *
 * Toggles the site between the default dark theme and the light theme by
 * swapping the `.dark`/`.light` class on the <html> element and persisting the
 * choice to localStorage under the `theme` key. The initial class is set
 * synchronously by the no-flash init script in Layout.astro; this island reads
 * that class on mount and stays in sync with it, so there is never a flash and
 * SSR/first paint never depends on hydration.
 *
 * SSR-safety: the DOM and localStorage are only read inside effects/handlers,
 * never during render. Until the mount effect runs, `theme` is `null` and the
 * button renders the dark-default (moon) icon, matching the server output.
 *
 * Accessibility: a native <button> with a stable `aria-label` ("Toggle theme"),
 * full keyboard operability, and a >=44x44px activation target (Req 9.6, 9.7).
 * The sun/moon glyphs are decorative (aria-hidden); the accessible name comes
 * from the aria-label.
 */
import { useEffect, useRef, useState } from 'react';

type Theme = 'light' | 'dark';

/** Minimum touch-target size in CSS pixels (Req 9.6, 9.7). */
const MIN_TARGET_PX = 44;

/** Easter-egg image floated up from the toggle when switching to light mode. */
const EYES_IMAGE_SRC = '/images/profile/my-eyes.jpeg';

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

/** Sun glyph — shown while the light theme is active. */
const SunIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

/** Moon glyph — shown while the dark theme is active (also the SSR default). */
const MoonIcon = (
  <svg {...iconProps}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export default function ThemeToggle() {
  // `null` until mounted so render never reads the DOM; the server-rendered
  // markup (dark default) is preserved until hydration.
  const [theme, setTheme] = useState<Theme | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // On mount, adopt whatever the no-flash init script decided (the class on
  // <html>), keeping the button icon in sync with the actual theme.
  useEffect(() => {
    const current: Theme = document.documentElement.classList.contains('light')
      ? 'light'
      : 'dark';
    setTheme(current);
  }, []);

  const toggle = () => {
    const root = document.documentElement;
    const next: Theme = root.classList.contains('light') ? 'dark' : 'light';
    root.classList.remove('light', 'dark');
    root.classList.add(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Persistence is best-effort; the in-page toggle still works without it.
    }
    setTheme(next);

    // Easter egg: switching to light mode floats the "my eyes" image up from
    // the toggle button ("light mode burns my eyes"). Purely decorative.
    if (next === 'light') flyEyes();
  };

  /**
   * Spawns the easter-egg image at the toggle button and animates it floating
   * up the screen, then removes it. Uses the Web Animations API so it needs no
   * global CSS, appends to <body> so it is never clipped by the dock, and is
   * skipped entirely under a reduced-motion preference.
   */
  const flyEyes = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const size = Math.round(Math.min(180, window.innerWidth * 0.42));

    const img = document.createElement('img');
    img.src = EYES_IMAGE_SRC;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    Object.assign(img.style, {
      position: 'fixed',
      left: `${rect.left + rect.width / 2 - size / 2}px`,
      top: `${rect.top + rect.height / 2 - size / 2}px`,
      width: `${size}px`,
      height: 'auto',
      borderRadius: '16px',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35)',
      objectFit: 'cover',
      pointerEvents: 'none',
      zIndex: '9999',
      willChange: 'transform, opacity',
    } satisfies Partial<CSSStyleDeclaration>);

    document.body.appendChild(img);

    const remove = () => img.remove();

    if (typeof img.animate !== 'function') {
      // No WAAPI support: show briefly, then remove.
      window.setTimeout(remove, 1200);
      return;
    }

    // Rise up the screen with a little pop-in and a gentle fade-out at the top.
    const rise = Math.round(Math.min(window.innerHeight * 0.75, rect.top - 24));
    const animation = img.animate(
      [
        { transform: 'translateY(0) scale(0.4)', opacity: 0 },
        { transform: 'translateY(-24px) scale(1)', opacity: 1, offset: 0.08 },
        // Steady, even rise that stays fully visible for most of the animation.
        { transform: `translateY(-${rise * 0.9}px) scale(1)`, opacity: 1, offset: 0.88 },
        { transform: `translateY(-${rise}px) scale(0.95)`, opacity: 0 },
      ],
      { duration: 2000, easing: 'linear' },
    );

    animation.onfinish = remove;
    animation.oncancel = remove;
    // Safety net in case the animation events never fire.
    window.setTimeout(remove, 2400);
  };

  const isLight = theme === 'light';

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      aria-pressed={isLight}
      style={{ minWidth: `${MIN_TARGET_PX}px`, minHeight: `${MIN_TARGET_PX}px` }}
      className="grid aspect-square place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
    >
      {isLight ? SunIcon : MoonIcon}
    </button>
  );
}
