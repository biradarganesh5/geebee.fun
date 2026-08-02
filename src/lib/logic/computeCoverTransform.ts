/**
 * Cover-fit geometry for the Hero_Image.
 *
 * The Hero_Image is a portrait photograph with a fixed intrinsic aspect ratio
 * of 3000:3878. When it is displayed in a box whose dimensions differ from the
 * image, we scale it uniformly so it fully covers the box in both axes (no
 * gaps) while preserving its aspect ratio, then offset it so a chosen focal
 * point (center-x, top 25%) stays visible.
 *
 * This module is a side-effect-free pure-logic utility (Requirements 1.2, 1.3)
 * and is the target of property-based tests (Design Properties 1 and 2).
 */

/** A width/height pair in pixels. */
export interface Box {
  width: number;
  height: number;
}

/**
 * An `object-position`-style focal point, normalized to 0..1 relative to the
 * intrinsic image. For the Hero_Image this is `{ x: 0.5, y: 0.125 }`
 * (horizontal center, top 25%) per Requirement 1.3.
 */
export interface FocalPoint {
  x: number;
  y: number;
}

/**
 * The result of fitting the intrinsic image into a display box with cover
 * semantics: a single uniform `scale`, the pixel `offsetX`/`offsetY` of the
 * image origin within the box, and the resulting rendered dimensions.
 */
export interface CoverTransform {
  /** Uniform scale applied to the intrinsic image (same for both axes). */
  scale: number;
  /** Pixel offset of the rendered image's origin within the box (<= 0). */
  offsetX: number;
  offsetY: number;
  /** Rendered image dimensions after scaling (>= box in both axes). */
  renderedWidth: number;
  renderedHeight: number;
}

/** Clamp a value into the inclusive `[min, max]` range. */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Computes a uniform cover-fit transform that scales the `intrinsic` image to
 * fully cover the display `box` while preserving the intrinsic aspect ratio
 * (Requirement 1.2), then offsets it so the `focal` point remains visible
 * inside the box (Requirement 1.3).
 *
 * Guarantees (see Design Properties 1 and 2):
 * - `renderedWidth / renderedHeight === intrinsic.width / intrinsic.height`
 *   (single uniform scale, so no stretching or skewing).
 * - `renderedWidth >= box.width` and `renderedHeight >= box.height`
 *   (the image fully covers the box with no gaps).
 * - `offsetX <= 0` and `offsetY <= 0` (the box's origin sits within the image).
 * - The focal point projects to `(focal.x * box.width, focal.y * box.height)`,
 *   which always lies inside the box.
 *
 * @param intrinsic The natural pixel dimensions of the image (e.g. 3000x3878).
 * @param box       The display area the image must cover.
 * @param focal     The normalized focal point to keep visible (0..1 per axis).
 */
export function computeCoverTransform(
  intrinsic: Box,
  box: Box,
  focal: FocalPoint
): CoverTransform {
  // Guard against degenerate inputs to avoid division by zero / NaN.
  const intrinsicWidth = intrinsic.width > 0 ? intrinsic.width : 1;
  const intrinsicHeight = intrinsic.height > 0 ? intrinsic.height : 1;
  const boxWidth = box.width > 0 ? box.width : 0;
  const boxHeight = box.height > 0 ? box.height : 0;

  // Cover-fit uses the LARGER of the two axis ratios so the scaled image spans
  // the box in both dimensions. A single scale keeps the aspect ratio intact.
  const scale = Math.max(boxWidth / intrinsicWidth, boxHeight / intrinsicHeight);

  const renderedWidth = intrinsicWidth * scale;
  const renderedHeight = intrinsicHeight * scale;

  // Normalize the focal point into [0, 1] so offsets stay within valid range.
  const focalX = clamp(focal.x, 0, 1);
  const focalY = clamp(focal.y, 0, 1);

  // Align the image's focal point with the same normalized position in the box
  // (object-position semantics). Because rendered dimensions are >= the box,
  // `(box - rendered)` is <= 0, so both offsets are non-positive and the image
  // continues to fully cover the box.
  const minOffsetX = boxWidth - renderedWidth; // <= 0
  const minOffsetY = boxHeight - renderedHeight; // <= 0

  const offsetX = clamp(focalX * (boxWidth - renderedWidth), minOffsetX, 0);
  const offsetY = clamp(focalY * (boxHeight - renderedHeight), minOffsetY, 0);

  return { scale, offsetX, offsetY, renderedWidth, renderedHeight };
}
