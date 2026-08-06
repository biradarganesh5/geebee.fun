/**
 * ImageCompareSlider — before/after image comparison slider (React island).
 *
 * A reimplementation (no copied code) of the inspiration's HomelabDiff idea:
 * two images stacked in a fixed aspect-ratio box, where the top ("before")
 * layer is clipped horizontally by a draggable vertical divider, progressively
 * revealing the bottom ("after") layer underneath.
 *
 * Interaction contract:
 *  - The divider is draggable by mouse AND touch (unified Pointer Events) and is
 *    also fully keyboard-operable: the handle is a `role="slider"` with
 *    `tabIndex=0`, `aria-valuemin/valuenow/valuemax`, and an `aria-label`.
 *    Left/Down decrease the split, Right/Up increase it, Home/End jump to the
 *    extremes. The split is always clamped to 0–100%. (keyboard + a11y)
 *  - The handle presents a >=44x44px activation target.
 *  - Motion (the smoothing transition applied when snapping via keyboard) is
 *    suppressed while dragging and under `prefers-reduced-motion` via the
 *    `motion-reduce:` variant layered on the global reduced-motion safety net.
 *
 * PLACEHOLDER-READY: `beforeSrc` / `afterSrc` may be empty (no images added
 * yet). When a layer's `src` is empty OR the image fails to load, that layer
 * renders a tasteful dashed-border placeholder panel (label text + icon, using
 * the theme tokens `bg-card` / `border-border` / `text-muted-foreground`)
 * instead of a broken image — the component looks intentional with no images.
 * The per-layer error handling mirrors the site-wide image-error contract
 * (unmount the broken <img>, swap in a same-sized styled panel, no layout
 * shift, no broken-image icon).
 *
 * The island owns no content: every image, label, and geometry value arrives as
 * props, so it stays a pure renderer.
 */
import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface ImageCompareSliderProps {
  /** Top ("before") layer image URL. Empty renders a placeholder panel. */
  beforeSrc?: string;
  /** Bottom ("after") layer image URL. Empty renders a placeholder panel. */
  afterSrc?: string;
  /** Corner / placeholder label for the before layer. */
  beforeLabel?: string;
  /** Corner / placeholder label for the after layer. */
  afterLabel?: string;
  /** Descriptive alternative text applied to both layer images. */
  alt?: string;
  /** Explicit CSS aspect ratio for the comparison box (e.g. "3 / 4"). */
  aspectRatio?: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Slider bounds, in percent. */
const MIN = 0;
const MAX = 100;
/** Keyboard nudge step, in percent. */
const STEP = 2;
/** Minimum handle activation target in CSS pixels. */
const MIN_TARGET_PX = 44;

/** Clamp a split position into the valid 0–100% range. */
function clampPosition(value: number): number {
  return Math.max(MIN, Math.min(MAX, value));
}

// -----------------------------------------------------------------------------
// Placeholder panel
// -----------------------------------------------------------------------------

/**
 * Tasteful stand-in shown when a layer has no image (empty src) or the image
 * fails to load. A dashed-border box carrying the layer's label and a small
 * image glyph, styled entirely with theme tokens.
 */
function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div
      data-testid="compare-placeholder"
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-card px-4 text-center text-muted-foreground"
    >
      {/* Decorative image glyph; the accessible label is the text below. */}
      <svg
        aria-hidden="true"
        className="h-8 w-8 opacity-70"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path d="M21 16l-4.5-4.5L5 20" />
      </svg>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Comparison layer
// -----------------------------------------------------------------------------

interface CompareLayerProps {
  src: string;
  label: string;
  alt: string;
  /** Which bottom corner the small label badge sits in. */
  corner: 'left' | 'right';
}

/**
 * A single stacked layer: renders the image (with error fallback) plus a small
 * corner label badge, OR a placeholder panel when there is no usable image.
 */
function CompareLayer({ src, label, alt, corner }: CompareLayerProps) {
  const [errored, setErrored] = useState(false);
  const showPlaceholder = src.length === 0 || errored;

  if (showPlaceholder) {
    return <PlaceholderPanel label={label} />;
  }

  const cornerClass =
    corner === 'left' ? 'bottom-3 left-3' : 'bottom-3 right-3';

  return (
    <>
      <img
        src={src}
        alt={alt}
        draggable={false}
        loading="lazy"
        decoding="async"
        onError={() => setErrored(true)}
        className="h-full w-full select-none object-cover"
      />
      <span
        className={`pointer-events-none absolute ${cornerClass} rounded bg-card/80 px-2 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm`}
      >
        {label}
      </span>
    </>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ImageCompareSlider({
  beforeSrc = '',
  afterSrc = '',
  beforeLabel = 'Schematic',
  afterLabel = 'Photo',
  alt = 'Before and after comparison',
  aspectRatio = '3 / 4',
}: ImageCompareSliderProps) {
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Project a client X coordinate onto the 0–100% split, clamped to bounds.
  const setFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    setPosition(clampPosition(((clientX - rect.left) / rect.width) * 100));
  }, []);

  // -- Pointer drag (unifies mouse + touch) ----------------------------------
  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      setDragging(true);
      setFromClientX(event.clientX);
      // Keep receiving move/up events even if the pointer leaves the element.
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [setFromClientX],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      setFromClientX(event.clientX);
    },
    [dragging, setFromClientX],
  );

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    setDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  // -- Keyboard operation (Left/Right/Up/Down/Home/End) ----------------------
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      let next: number;
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          next = clampPosition(position - STEP);
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          next = clampPosition(position + STEP);
          break;
        case 'Home':
          next = MIN;
          break;
        case 'End':
          next = MAX;
          break;
        default:
          return;
      }
      event.preventDefault();
      setPosition(next);
    },
    [position],
  );

  const rounded = Math.round(position);

  const boxStyle: CSSProperties = { aspectRatio };
  // Clip the top layer from the right edge, revealing the bottom layer.
  const beforeClipStyle: CSSProperties = {
    clipPath: `inset(0 ${100 - position}% 0 0)`,
  };
  const dividerStyle: CSSProperties = { left: `${position}%` };

  return (
    <div
      ref={containerRef}
      data-testid="image-compare-slider"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={boxStyle}
      className="relative w-full touch-none select-none overflow-hidden rounded-lg border border-border bg-card"
    >
      {/* Bottom ("after") layer — fully visible, revealed by the clip above. */}
      <div className="absolute inset-0">
        <CompareLayer src={afterSrc} label={afterLabel} alt={alt} corner="right" />
      </div>

      {/* Top ("before") layer — clipped horizontally by the divider. */}
      <div className="absolute inset-0" style={beforeClipStyle}>
        <CompareLayer src={beforeSrc} label={beforeLabel} alt={alt} corner="left" />
      </div>

      {/* Divider + draggable / focusable handle. */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Before and after comparison slider"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={rounded}
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
        style={dividerStyle}
        className={`absolute inset-y-0 z-10 -translate-x-1/2 cursor-ew-resize outline-none ${
          dragging ? '' : 'transition-[left] duration-100 ease-out'
        } motion-reduce:transition-none`}
        data-testid="image-compare-handle"
      >
        {/* The visible divider line. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-white"
        />
        {/* The grab target — centered on the divider, >=44x44px. */}
        <span
          aria-hidden="true"
          style={{ minWidth: `${MIN_TARGET_PX}px`, minHeight: `${MIN_TARGET_PX}px` }}
          className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 6l-4 6 4 6" />
            <path d="M15 6l4 6-4 6" />
          </svg>
        </span>
      </div>
    </div>
  );
}
