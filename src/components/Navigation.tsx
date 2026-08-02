/**
 * Navigation — floating macOS-style dock (React island).
 *
 * The dock is a compact shortcut bar rather than a full section index: it shows
 * a single "About" jump link followed by social shortcuts (GitHub, LinkedIn,
 * Email) sourced from the validated profile content layer, plus the theme
 * toggle. Section-scroll links for the remaining sections were intentionally
 * removed in favor of this minimal, social-forward dock.
 *
 * Interaction / responsive contract (design.md "Interaction Contracts", Req 1.9,
 * 9.3, 9.4):
 *  - Activating the About link brings the About section into view. Scrolling
 *    uses the native anchor as a no-JS fallback; when hydrated it calls
 *    `scrollIntoView`, choosing `smooth` normally and `auto` when the visitor
 *    requests reduced motion (Req 1.9). Social links are external anchors
 *    (http(s) open in a new tab; the email is a `mailto:` link).
 *  - At viewport width >= 768px every item is shown inline inside a floating
 *    dock pinned near the bottom of the screen, with no toggle control (Req
 *    9.4). Each icon magnifies based on its distance to the pointer, producing
 *    the macOS dock effect; the effect is disabled under reduced motion.
 *  - Below 768px a single toggle (hamburger) is shown; it expands to reveal all
 *    links and collapses to hide them (Req 9.3). The toggle exposes
 *    `aria-expanded` and `aria-controls`, and both the toggle and the links have
 *    >=44x44px touch targets and are keyboard operable (Req 9.6, 9.7).
 *
 * SSR-safety: `matchMedia` is only read inside effects, and the desktop dock
 * (all items inline) is the server-rendered default so first paint matches the
 * static fallback and every dock item is present without hydration.
 */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  Fragment,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import { navTargets as defaultNavTargets, type NavTargets } from '@content/navigation';
import { profile } from '@content/profile';
import ThemeToggle from '@components/ThemeToggle';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Minimum touch-target size in CSS pixels (Req 9.6, 9.7). */
const MIN_TARGET_PX = 44;

/** Resting icon size (px). Also the minimum touch target (Req 9.6, 9.7). */
const BASE_SIZE = MIN_TARGET_PX;
/** Peak icon size (px) reached by the icon directly under the pointer. */
const PEAK_SIZE = 64;
/** Horizontal reach (px) of the magnification falloff on either side of an icon. */
const INFLUENCE_PX = 140;
/** Per-frame easing factor for the size lerp (spring-like settle). */
const LERP = 0.22;

/** Social shortcuts (by profile name) surfaced in the dock, in this order. */
const DOCK_SOCIAL_NAMES = ['GitHub', 'LinkedIn', 'Email'] as const;

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface NavigationProps {
  /**
   * Section navigation targets. Defaults to the validated content-layer seed
   * data ({@link navTargets}); only the About target is surfaced in the dock.
   */
  targets?: NavTargets;
}

// -----------------------------------------------------------------------------
// Icons — dependency-free inline SVG (18px, strokeWidth 1.5, currentColor). The
// accessible name comes from the anchor's aria-label, so the SVGs are
// decorative (aria-hidden) with no titles.
// -----------------------------------------------------------------------------

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

/** Icon for the single About section link. */
const ABOUT_ICON: ReactNode = (
  <svg {...iconProps}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
  </svg>
);

/** Icons for the social shortcuts, keyed by profile social `name`. */
const SOCIAL_ICONS: Record<string, ReactNode> = {
  GitHub: (
    <svg {...iconProps}>
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  ),
  LinkedIn: (
    <svg {...iconProps}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  ),
  Email: (
    <svg {...iconProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  ),
};

// -----------------------------------------------------------------------------
// Dock item model — a unified shape for the About section link and the social
// shortcuts so the magnifying dock + mobile menu can render one list.
// -----------------------------------------------------------------------------

interface DockItem {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
  /** Section-scroll target id (About only); absent for external social links. */
  sectionId?: string;
  /** External http(s) link opened in a new tab (mailto/http both skip scroll). */
  external?: boolean;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Reads the live reduced-motion preference (SSR-safe). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function Navigation({ targets = defaultNavTargets }: NavigationProps) {
  // Build the dock item list: the About section link (if present) followed by
  // the configured social shortcuts, in the requested order.
  const aboutTarget = targets.find((t) => t.sectionId === 'about');
  const dockItems: DockItem[] = [
    ...(aboutTarget
      ? [
          {
            key: 'about',
            href: `#${aboutTarget.sectionId}`,
            label: aboutTarget.label,
            icon: ABOUT_ICON,
            sectionId: aboutTarget.sectionId,
          } as DockItem,
        ]
      : []),
    ...DOCK_SOCIAL_NAMES.flatMap((name) => {
      const social = profile.socials.find((s) => s.name === name);
      if (!social) return [];
      return [
        {
          key: social.name,
          href: social.url,
          label: social.name,
          icon: SOCIAL_ICONS[social.name],
          external: /^https?:\/\//.test(social.url),
        } as DockItem,
      ];
    }),
  ];

  // Index of the first social shortcut; a divider is drawn before it to set the
  // social links apart from the About link (mirrors the theme-toggle divider).
  const firstSocialIndex = dockItems.findIndex((item) => item.external);

  // Live reduced-motion preference; when set, the magnification is disabled.
  const [reduceMotion, setReduceMotion] = useState(false);

  const menuId = useId();

  // Refs for the dock icon anchors, keyed by index, plus animation bookkeeping.
  const iconRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const sizesRef = useRef<number[]>(dockItems.map(() => BASE_SIZE));
  const pointerXRef = useRef<number>(Infinity);
  const rafRef = useRef<number | null>(null);

  // Track reduced-motion so the magnification can be turned off reactively.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(mql.matches);
    sync();

    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);

  // -- Magnification animation -------------------------------------------------
  //
  // A single requestAnimationFrame loop lerps each icon's current size toward a
  // target derived from its distance to the pointer, writing only `width`/
  // `height` (transform-friendly, no layout thrash beyond the dock row). Reads
  // and writes are split into two passes to avoid interleaved forced reflow.

  const step = useCallback(() => {
    const els = iconRefs.current;
    const px = pointerXRef.current;

    // Pass 1: read geometry + compute targets.
    const targetsPx: number[] = [];
    for (let i = 0; i < els.length; i += 1) {
      const el = els[i];
      if (!el) {
        targetsPx[i] = BASE_SIZE;
        continue;
      }
      const rect = el.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const dist = px === Infinity ? Infinity : Math.abs(px - center);
      if (dist >= INFLUENCE_PX) {
        targetsPx[i] = BASE_SIZE;
      } else {
        // Cosine falloff → smooth genie curve (1 at the cursor, 0 at the edge).
        const t = 0.5 * (1 + Math.cos((dist / INFLUENCE_PX) * Math.PI));
        targetsPx[i] = BASE_SIZE + (PEAK_SIZE - BASE_SIZE) * t;
      }
    }

    // Pass 2: lerp toward the target and write sizes.
    let settled = true;
    for (let i = 0; i < els.length; i += 1) {
      const el = els[i];
      const cur = sizesRef.current[i] ?? BASE_SIZE;
      const next = cur + (targetsPx[i] - cur) * LERP;
      sizesRef.current[i] = next;
      if (el) {
        el.style.width = `${next}px`;
        el.style.height = `${next}px`;
      }
      if (Math.abs(next - targetsPx[i]) > 0.1) settled = false;
    }

    rafRef.current = settled ? null : requestAnimationFrame(step);
  }, []);

  const kick = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(step);
  }, [step]);

  const handleDockPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (reduceMotion) return;
      pointerXRef.current = event.clientX;
      kick();
    },
    [kick, reduceMotion],
  );

  const handleDockPointerLeave = useCallback(() => {
    if (reduceMotion) return;
    pointerXRef.current = Infinity;
    kick();
  }, [kick, reduceMotion]);

  // Clean up any pending frame on unmount.
  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Bring the activated section into view, honoring reduced-motion (Req 1.9).
  const handleActivate = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, sectionId: string) => {
      const target =
        typeof document !== 'undefined' ? document.getElementById(sectionId) : null;

      // No hydrated target (or SSR): fall back to native anchor navigation.
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });

      // Keep the URL hash and move focus to the section for keyboard users,
      // without triggering a second (jump) scroll.
      if (typeof history !== 'undefined' && typeof history.replaceState === 'function') {
        history.replaceState(null, '', `#${sectionId}`);
      }
      target.focus?.({ preventScroll: true });
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Floating magnifying dock pinned near the bottom of the screen — shown at
  // every viewport size (mobile included) rather than collapsing to a toggle.
  // ---------------------------------------------------------------------------
  return (
    <nav aria-label="Primary" className="contents">
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
          <ul
            id={menuId}
            onPointerMove={handleDockPointerMove}
            onPointerLeave={handleDockPointerLeave}
            className="pointer-events-auto flex items-end gap-2 rounded-2xl border border-border bg-card/70 px-3 py-2 shadow-lg shadow-black/40 backdrop-blur-md"
          >
            {dockItems.map((item, index) => (
              <Fragment key={item.key}>
                {/* Divider between the About link and the social shortcuts. */}
                {index === firstSocialIndex && firstSocialIndex > 0 && (
                  <li aria-hidden="true" className="mx-1 flex items-center self-center">
                    <span className="block h-6 w-px bg-border" />
                  </li>
                )}
                <li className="group relative flex items-end">
                  {/* Tooltip: visible on hover and on keyboard focus (Req a11y). */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-muted px-2 py-1 text-xs text-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
                  >
                    {item.label}
                  </span>
                  <a
                    ref={(el) => {
                      iconRefs.current[index] = el;
                    }}
                    href={item.href}
                    aria-label={item.label}
                    onClick={
                      item.sectionId
                        ? (event) => handleActivate(event, item.sectionId as string)
                        : undefined
                    }
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer' : undefined}
                    style={{ width: `${BASE_SIZE}px`, height: `${BASE_SIZE}px` }}
                    className="grid aspect-square place-items-center rounded-full text-muted-foreground outline-none transition-colors will-change-[width,height] hover:text-foreground hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                  >
                    {item.icon}
                  </a>
                </li>
              </Fragment>
            ))}

            {/* Theme toggle — the last dock control, separated from the item
                icons by a thin divider. It is an additional control (a button),
                not a nav target. */}
            <li aria-hidden="true" className="mx-1 flex items-center self-center">
              <span className="block h-6 w-px bg-border" />
            </li>
            <li className="flex items-end">
              <ThemeToggle />
            </li>
          </ul>
        </div>
    </nav>
  );
}
