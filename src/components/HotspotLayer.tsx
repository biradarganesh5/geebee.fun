/**
 * HotspotLayer — interactive Hero_Image hotspots (React island).
 *
 * Renders the authored {@link Hotspot}s as an overlay on top of the cover-fit
 * Hero_Image. Each hotspot is projected from its resolution-independent
 * normalized coordinate into a pixel position inside the rendered image box via
 * the pure {@link mapHotspotToViewport} function, so it stays glued to its
 * subject (PC, soldering station) across every viewport from 360px to 2560px.
 * Positions are recomputed whenever the rendered box changes size (ResizeObserver
 * plus a window-resize listener).
 *
 * Interaction contract (design.md "Interaction Contracts"):
 *  - Each hotspot is a <button> with a >=44x44px activation target, an
 *    `aria-label`, keyboard focus, and activation by click, tap, and Enter/Space
 *    (native <button> semantics). (Req 2.1, 2.7, 2.8)
 *  - Pointer-enter / keyboard focus applies a highlight within 150ms; pointer-
 *    leave / blur removes it within 150ms. Motion is requested through the
 *    AnimationEngine and mirrored by reduced-motion-consistent CSS. (Req 2.2, 2.3)
 *  - Activation reveals the hotspot's subject content within 300ms without
 *    navigating away. The PC hotspot surfaces a visible control that scrolls the
 *    PC_Specs_Section into view; the soldering hotspot reveals inline PCB-
 *    designing content. (Req 2.4, 2.5, 2.6)
 *  - If a hotspot's content cannot be revealed, the hero and every other hotspot
 *    stay interactive and an "unavailable" indication is shown for that hotspot
 *    only. (Req 2.9)
 *
 * This island owns no content: hotspots and image geometry arrive as props
 * (defaulting to the validated content-layer seed data), keeping the component a
 * pure renderer of the content + logic layers.
 */
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { hotspots as defaultHotspots, type Hotspot } from '@content/hero';
import {
  mapHotspotToViewport,
  type Box,
  type FocalPoint,
} from '@logic/mapHotspotToViewport';
import { getAnimationEngine, type AnimationEngine } from '@animation/AnimationEngine';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface HotspotLayerProps {
  /** Hotspots to render. Defaults to the validated content-layer seed data. */
  hotspots?: Hotspot[];
  /** Intrinsic Hero_Image size. Defaults to the fixed 3000x3878 (Req 1.2). */
  intrinsic?: Box;
  /** Cover-fit focal point. Defaults to center-x / top 25% (Req 1.3). */
  focal?: FocalPoint;
  /**
   * The rendered image box the hotspots are projected into. When omitted the
   * layer measures its own root element (which is expected to overlay the
   * rendered Hero_Image) and recomputes on resize.
   */
  box?: Box;
  /** Id of the PC_Specs_Section the PC hotspot control scrolls to (Req 2.5). */
  scrollTargetId?: string;
}

/** Fixed intrinsic Hero_Image dimensions (Req 1.2). */
const DEFAULT_INTRINSIC: Box = { width: 3000, height: 3878 };
/** Cover-fit focal point: horizontal center, top 25% (Req 1.3). */
const DEFAULT_FOCAL: FocalPoint = { x: 0.5, y: 0.125 };
/** Minimum activation target in CSS pixels (Req 2.1, 9.7). */
const MIN_TARGET_PX = 44;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function HotspotLayer({
  hotspots = defaultHotspots,
  intrinsic = DEFAULT_INTRINSIC,
  focal = DEFAULT_FOCAL,
  box: boxProp,
  scrollTargetId = 'pc-specs',
}: HotspotLayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<AnimationEngine | null>(null);

  // The rendered image box we project hotspots into. Either supplied by the
  // caller or measured from our own root element.
  const [box, setBox] = useState<Box | null>(boxProp ?? null);
  // The currently revealed hotspot (at most one open at a time).
  const [activeId, setActiveId] = useState<string | null>(null);
  // Hotspots whose content could not be revealed (Req 2.9). Others stay live.
  const [unavailableIds, setUnavailableIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  // Lazily obtain the shared AnimationEngine on first interaction so importing/
  // server-rendering this island never touches `window`.
  const getEngine = useCallback((): AnimationEngine => {
    if (engineRef.current === null) engineRef.current = getAnimationEngine();
    return engineRef.current;
  }, []);

  // -- Box measurement + resize recomputation (Req 2.1 across viewports) -----
  useLayoutEffect(() => {
    if (boxProp) {
      setBox(boxProp);
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setBox({ width: rect.width, height: rect.height });
    };
    measure();

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(el);
    }
    window.addEventListener('resize', measure);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [boxProp]);

  // -- Highlight (Req 2.2 / 2.3 / 2.8) ---------------------------------------
  const handleHighlight = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) => {
      getEngine().highlight(event.currentTarget);
    },
    [getEngine],
  );

  const handleRemoveHighlight = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) => {
      getEngine().removeHighlight(event.currentTarget);
    },
    [getEngine],
  );

  // -- Reveal-ability check (drives the Req 2.9 fallback) --------------------
  const canReveal = useCallback(
    (hotspot: Hotspot): boolean => {
      // The PC hotspot's related content is a control that brings the
      // PC_Specs_Section into view; if that section is absent the content
      // cannot be revealed.
      if (hotspot.subject === 'pc') {
        return typeof document !== 'undefined' && document.getElementById(scrollTargetId) !== null;
      }
      // The soldering hotspot reveals inline static PCB-designing content.
      return true;
    },
    [scrollTargetId],
  );

  // -- Activation (Req 2.4 / 2.5 / 2.6 / 2.8 / 2.9) --------------------------
  const activate = useCallback(
    (hotspot: Hotspot) => {
      const id = hotspot.id;
      // Toggle an already-open hotspot closed.
      if (activeId === id) {
        setActiveId(null);
        return;
      }
      try {
        if (!canReveal(hotspot)) throw new Error(`cannot reveal content for "${id}"`);
        setUnavailableIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setActiveId(id);
      } catch {
        // Reveal failed: keep the hero + other hotspots interactive and show an
        // "unavailable" indication for this hotspot only (Req 2.9).
        setActiveId(null);
        setUnavailableIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }
    },
    [activeId, canReveal],
  );

  // -- PC hotspot: scroll the PC_Specs_Section into view (Req 2.5) -----------
  const scrollToSpecs = useCallback(
    (hotspotId: string) => {
      const el = typeof document !== 'undefined' ? document.getElementById(scrollTargetId) : null;
      if (!el) {
        // Target vanished between reveal and activation: degrade gracefully.
        setActiveId(null);
        setUnavailableIds((prev) => {
          const next = new Set(prev);
          next.add(hotspotId);
          return next;
        });
        return;
      }
      // Respect the visitor's scroll-behavior; global CSS forces `auto` under
      // reduced motion, so we don't override it here.
      el.scrollIntoView({ block: 'start' });
    },
    [scrollTargetId],
  );

  return (
    <div
      ref={containerRef}
      data-testid="hotspot-layer"
      aria-label="Interactive workspace hotspots"
      className="pointer-events-none absolute inset-0 z-10"
    >
      {box !== null &&
        hotspots.map((hotspot) => {
          const point = mapHotspotToViewport(
            { x: hotspot.x, y: hotspot.y },
            intrinsic,
            box,
            focal,
          );
          const isActive = activeId === hotspot.id;
          const isUnavailable = unavailableIds.has(hotspot.id);
          const panelId = `${hotspot.id}-panel`;

          return (
            <div
              key={hotspot.id}
              className="pointer-events-none absolute"
              style={{ left: `${point.x}px`, top: `${point.y}px`, transform: 'translate(-50%, -50%)' }}
            >
              <button
                type="button"
                aria-label={hotspot.label}
                aria-expanded={isActive}
                aria-controls={panelId}
                data-hotspot-id={hotspot.id}
                data-hotspot-subject={hotspot.subject}
                onPointerEnter={handleHighlight}
                onPointerLeave={handleRemoveHighlight}
                onFocus={handleHighlight}
                onBlur={handleRemoveHighlight}
                onClick={() => activate(hotspot)}
                style={{ minWidth: `${MIN_TARGET_PX}px`, minHeight: `${MIN_TARGET_PX}px` }}
                className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border-2 border-white/70 bg-white/10 text-white shadow-lg outline-none backdrop-blur-sm transition duration-150 ease-out motion-reduce:transition-none hover:border-white hover:bg-white/25 focus-visible:ring-4 focus-visible:ring-sky-400/80 data-[highlight=on]:border-white data-[highlight=on]:bg-white/25"
              >
                {/* Decorative pulse dot; the accessible name comes from aria-label. */}
                <span aria-hidden="true" className="block h-3 w-3 rounded-full bg-white" />
              </button>

              {isUnavailable && (
                <p
                  role="status"
                  aria-live="polite"
                  className="pointer-events-auto absolute left-1/2 top-full mt-2 w-max max-w-[16rem] -translate-x-1/2 rounded-md bg-red-950/90 px-3 py-2 text-sm text-red-100 shadow-lg"
                >
                  Content is currently unavailable.
                </p>
              )}

              {isActive && !isUnavailable && (
                <div
                  id={panelId}
                  role="region"
                  aria-label={`${hotspot.label} details`}
                  className="pointer-events-auto absolute left-1/2 top-full mt-3 w-max max-w-[20rem] -translate-x-1/2 rounded-lg border border-border bg-card/95 p-4 text-left text-card-foreground shadow-xl transition duration-200 ease-out motion-reduce:transition-none"
                >
                  {hotspot.subject === 'pc' ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Take a closer look at the full build.
                      </p>
                      <button
                        type="button"
                        onClick={() => scrollToSpecs(hotspot.id)}
                        className="pointer-events-auto inline-flex min-h-[44px] items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-150 ease-out motion-reduce:transition-none hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Jump to PC specs
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-card-foreground">PCB designing bench</h3>
                      <p className="text-sm text-muted-foreground">
                        This is where hobby PCBs come to life: schematics in KiCad, hand-routed
                        boards, and a fine-tip iron for surface-mount soldering and rework.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
