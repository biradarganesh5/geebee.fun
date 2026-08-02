/**
 * ImageWithFallback — shared image error-fallback primitive (React island).
 *
 * The React counterpart to `ImageWithFallback.astro`, for use *inside* React
 * islands (e.g. content cards) where the image participates in client state.
 * It implements the same site-wide error-handling contract from design.md
 * ("Error Handling"):
 *
 *  - The image renders inside a slot whose dimensions are reserved up front from
 *    an explicit aspect ratio (`aspectRatio`, or derived from `width`/`height`).
 *    The slot holds its size before, during, and after loading, so a load
 *    failure causes NO layout shift (Req 10.4).
 *  - On the img's `onError`, the broken `<img>` is unmounted (so the browser
 *    never paints a broken-image icon) and a styled alt-text box — sized to the
 *    exact same reserved slot — is shown in its place, surfacing the descriptive
 *    alternative text (Req 10.4, and the cert-image fallback contract Req 7.5).
 *
 * The API mirrors the Astro version and stays intentionally small so any content
 * image inside an island can adopt it. `srcSet`/`sizes` are passed through for
 * responsive delivery.
 *
 * NOTE: `HeroImage.astro` and `CertificationCard.tsx` already implement this
 * same contract inline and are intentionally NOT refactored onto this primitive;
 * it exists so any *new* island image can reuse the identical behavior.
 */
import { useState, type CSSProperties } from 'react';

export interface ImageWithFallbackProps {
  /** Image URL. */
  src: string;
  /** Descriptive alternative text; also surfaced in place on load failure. */
  alt: string;
  /** Intrinsic width in px; used to reserve the aspect-ratio slot. */
  width?: number;
  /** Intrinsic height in px; used to reserve the aspect-ratio slot. */
  height?: number;
  /** Explicit CSS aspect ratio (e.g. "3 / 2"). Overrides width/height. */
  aspectRatio?: string;
  /** Extra classes for the root slot element. */
  className?: string;
  /** Extra classes for the inner <img>. */
  imgClassName?: string;
  /** Responsive `sizes` passthrough. */
  sizes?: string;
  /** Responsive `srcSet` passthrough. */
  srcSet?: string;
  /** Native loading hint (defaults to "lazy"). */
  loading?: 'lazy' | 'eager';
  /** Native decoding hint (defaults to "async"). */
  decoding?: 'async' | 'sync' | 'auto';
  /** How the image fills the reserved slot (defaults to "cover"). */
  objectFit?: CSSProperties['objectFit'];
  /** Optional callback invoked when the image fails to load. */
  onError?: () => void;
}

export default function ImageWithFallback({
  src,
  alt,
  width,
  height,
  aspectRatio,
  className,
  imgClassName,
  sizes,
  srcSet,
  loading = 'lazy',
  decoding = 'async',
  objectFit = 'cover',
  onError,
}: ImageWithFallbackProps) {
  const [errored, setErrored] = useState(false);

  // Reserve the slot's dimensions up front so a load failure causes no layout
  // shift (Req 10.4). Prefer an explicit aspectRatio, else derive from w/h.
  const resolvedAspectRatio =
    aspectRatio ?? (width && height ? `${width} / ${height}` : undefined);

  const rootStyle: CSSProperties = {
    position: 'relative',
    display: 'block',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#171717',
    ...(resolvedAspectRatio ? { aspectRatio: resolvedAspectRatio } : {}),
  };

  const handleError = () => {
    setErrored(true);
    onError?.();
  };

  return (
    <div className={className} style={rootStyle} data-image-fallback data-errored={errored || undefined}>
      {!errored ? (
        <img
          className={imgClassName}
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          srcSet={srcSet}
          loading={loading}
          decoding={decoding}
          onError={handleError}
          style={{ display: 'block', width: '100%', height: '100%', objectFit }}
          data-image-fallback-img
        />
      ) : (
        /* Styled alt-text box sized to the same reserved slot; swapping in
           preserves surrounding layout dimensions and shows no broken-image
           icon (Req 10.4). */
        <div
          data-image-fallback-text
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            textAlign: 'center',
            background:
              'radial-gradient(circle at 50% 35%, #262626 0%, #171717 65%, #0a0a0a 100%)',
          }}
        >
          <p style={{ maxWidth: '90%', color: '#d4d4d4', fontSize: '0.9rem', lineHeight: 1.5 }}>
            {alt}
          </p>
        </div>
      )}
    </div>
  );
}
