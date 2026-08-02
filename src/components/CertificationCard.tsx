/**
 * CertificationCard — an interactive AWS certification badge (React island).
 *
 * Renders exactly one image for a single certification (Req 7.2) with its
 * non-empty alt text (Req 7.1), plus a persistent text caption naming the
 * certification.
 *
 * Interaction contract (design.md "Interaction Contracts", Req 7.3/7.4):
 *  - Pointer hover or keyboard focus applies a visual transformation that
 *    visibly changes the image's appearance within 200ms; ending the hover /
 *    focus reverts it within 200ms. Motion is requested through the shared
 *    {@link AnimationEngine} (the same facade used by every other section), so
 *    reduced-motion resolution and animation-failure fallbacks are centralized.
 *    A reduced-motion-consistent CSS filter change (driven by the engine's
 *    `data-highlight` flag and by native hover/focus) guarantees a visible,
 *    instant transformation even when the scale motion is collapsed away.
 *
 * Image-load-failure contract (design.md "Interaction Contracts", Req 7.5):
 *  - If the certification image fails to load, the card swaps the <img> for a
 *    styled box — sized to the same reserved aspect-ratio slot so the layout
 *    does not shift — that shows the certification name label plus an
 *    "Image unavailable" indication. No broken-image icon is ever shown.
 *
 * This island owns no content: the name, image reference, and alt text arrive
 * as props from the validated `content/certifications.ts` module, keeping the
 * component a pure renderer of the content layer.
 */
import {
  useCallback,
  useEffect,
  useRef,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
  useState,
} from 'react';

import { getAnimationEngine, type AnimationEngine } from '@animation/AnimationEngine';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface CertificationCardProps {
  /** The certification's display name (Req 7.1) and fallback label (Req 7.5). */
  name: string;
  /** The single image reference for this certification (Req 7.2). */
  imageUrl: string;
  /** Non-empty descriptive alt text (Req 7.1). */
  altText: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function CertificationCard({ name, imageUrl, altText }: CertificationCardProps) {
  const engineRef = useRef<AnimationEngine | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // Flips to true if the image fails to load, triggering the Req 7.5 fallback.
  const [imageFailed, setImageFailed] = useState(false);

  // Because this island hydrates lazily (client:visible) and the image uses
  // native `loading="lazy"`, the browser can fire the native `error` event
  // *before* React attaches its `onError` handler. In that race the handler
  // never runs and the fallback never mounts. On mount, inspect the real DOM
  // node: a load that has finished (`complete`) with no rendered pixels
  // (`naturalWidth === 0`) means the image already failed, so flip to the
  // Req 7.5 / 10.4 fallback. The `onError` handler below still covers failures
  // that happen after hydration.
  useEffect(() => {
    const img = imgRef.current;
    if (img !== null && img.complete && img.naturalWidth === 0) {
      setImageFailed(true);
    }
  }, []);

  // Lazily obtain the shared AnimationEngine on first interaction so importing /
  // server-rendering this island never touches `window`.
  const getEngine = useCallback((): AnimationEngine => {
    if (engineRef.current === null) engineRef.current = getAnimationEngine();
    return engineRef.current;
  }, []);

  // -- Transform on hover / focus (Req 7.3) ----------------------------------
  const applyTransform = useCallback(
    (event: ReactPointerEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) => {
      getEngine().highlight(event.currentTarget);
    },
    [getEngine],
  );

  // -- Revert when hover / focus ends (Req 7.4) ------------------------------
  const revertTransform = useCallback(
    (event: ReactPointerEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) => {
      getEngine().removeHighlight(event.currentTarget);
    },
    [getEngine],
  );

  return (
    <figure className="flex flex-col items-center gap-2">
      {/*
        The interactive, keyboard-focusable frame. The AnimationEngine scales
        this element on hover/focus (<=150ms, well within the 200ms bound) and
        reverts on leave/blur. The CSS filter changes below are driven by native
        hover/focus and by the engine's `data-highlight` flag, so a visible
        transformation still happens instantly under reduced motion.
      */}
      <div
        role="group"
        aria-label={name}
        tabIndex={0}
        data-cert-frame
        onPointerEnter={applyTransform}
        onPointerLeave={revertTransform}
        onFocus={applyTransform}
        onBlur={revertTransform}
        className="group relative flex aspect-square w-full items-center justify-center rounded-lg outline-none transition duration-150 ease-out will-change-transform motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        {imageFailed ? (
          // Req 7.5: image failed — show the certification name + an
          // "image unavailable" indication in place, no broken-image icon.
          <div
            role="img"
            aria-label={`${name} — image unavailable`}
            data-cert-fallback
            className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/60 px-4 text-center"
          >
            <span className="text-base font-semibold leading-tight text-card-foreground">
              {name}
            </span>
            <span className="text-sm text-muted-foreground">Image unavailable</span>
          </div>
        ) : (
          <img
            ref={imgRef}
            src={imageUrl}
            alt={altText}
            // Req 10.3: certification images are below-the-fold, non-critical
            // media. They use native `loading="lazy"` — resilient and zero-JS
            // safe — so the browser defers them until near the viewport. New
            // content images that need the explicit one-viewport-height trigger
            // opt into the shared IntersectionObserver loader via
            // `ImageWithFallback`'s `lazy` prop / a `data-lazy` attribute.
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-contain transition duration-150 ease-out motion-reduce:transition-none group-hover:brightness-110 group-hover:saturate-150 group-focus-within:brightness-110 group-focus-within:saturate-150 group-data-[highlight=on]:brightness-110 group-data-[highlight=on]:saturate-150"
          />
        )}
      </div>

      {/* Persistent text label so the certification is always identifiable,
          independent of image load state. */}
      <figcaption className="text-center text-xs font-medium leading-snug text-muted-foreground">
        {name}
      </figcaption>
    </figure>
  );
}
