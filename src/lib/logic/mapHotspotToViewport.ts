/**
 * Pure logic: hotspot projection.
 *
 * Projects a resolution-independent, normalized hero coordinate into a pixel
 * `Point` inside the rendered (cover-fit) hero image box. This keeps every
 * hotspot (PC, soldering station, ...) glued to its subject across every
 * viewport from 360px to 2560px.
 *
 * Requirements: 2.1, 2.7
 *
 * NOTE ON THE SHARED COVER-FIT MATH:
 * The design (see design.md "Key Interfaces") calls for a sibling module
 * `computeCoverTransform.ts` that exports `computeCoverTransform`, `Box`,
 * `FocalPoint`, and `CoverTransform`. That module is implemented under a
 * separate task (2.3) and is not present yet. To avoid a build-time dependency
 * on code that does not exist, this file replicates the exact same cover-fit
 * scale/offset math locally (see `coverFit` below) and defines structurally
 * compatible `Box` / `FocalPoint` types. Because TypeScript uses structural
 * typing, these definitions interoperate with the sibling module's exports.
 * When `computeCoverTransform.ts` lands, `coverFit` here can be replaced with a
 * direct import of `computeCoverTransform` with no behavioral change.
 */

/** A rectangular size in pixels (intrinsic image size or display box size). */
export interface Box {
  width: number;
  height: number;
}

/** A pixel coordinate within the rendered image box. */
export interface Point {
  x: number;
  y: number;
}

/** A coordinate normalized to [0,1]x[0,1] relative to the intrinsic image. */
export interface NormalizedPoint {
  x: number;
  y: number;
}

/**
 * An `object-position`-style focal point, normalized 0..1. For the hero image
 * the design uses (x: 0.5, y: 0.125) = horizontal center, top 25% region.
 */
export interface FocalPoint {
  x: number;
  y: number;
}

/**
 * Result of the cover-fit computation: a single uniform scale applied to the
 * intrinsic image plus the pixel offset of the image origin within the box.
 * Mirrors the sibling `CoverTransform` interface.
 */
interface CoverFit {
  scale: number;
  offsetX: number;
  offsetY: number;
  renderedWidth: number;
  renderedHeight: number;
}

/**
 * Cover-fit transform, preserving aspect ratio. Picks the uniform scale that
 * makes the intrinsic image fully cover the display box, then positions the
 * scaled image so the focal point of the image aligns with the focal point of
 * the box. Because we scale to cover, `renderedWidth >= box.width` and
 * `renderedHeight >= box.height`, so both offsets are non-positive.
 *
 * This is intentionally identical to what `computeCoverTransform` produces.
 */
function coverFit(intrinsic: Box, box: Box, focal: FocalPoint): CoverFit {
  const scale = Math.max(box.width / intrinsic.width, box.height / intrinsic.height);
  const renderedWidth = intrinsic.width * scale;
  const renderedHeight = intrinsic.height * scale;
  const offsetX = focal.x * (box.width - renderedWidth);
  const offsetY = focal.y * (box.height - renderedHeight);
  return { scale, offsetX, offsetY, renderedWidth, renderedHeight };
}

/**
 * Projects a normalized hero coordinate into a pixel `Point` within the
 * rendered image box.
 *
 * A normalized coordinate `(nx, ny)` maps to the image location that sits at
 * fraction `nx` across and `ny` down the intrinsic image. Under the cover-fit
 * transform that location renders at:
 *
 *   x = offsetX + nx * renderedWidth
 *   y = offsetY + ny * renderedHeight
 *
 * Since `nx, ny ∈ [0,1]`, the result always lies within the rendered image
 * rectangle `[offsetX, offsetX + renderedWidth] x [offsetY, offsetY + renderedHeight]`,
 * which is the property validated by task 3.2.
 *
 * @param norm      normalized hotspot coordinate in [0,1]x[0,1]
 * @param intrinsic intrinsic image size (e.g. 3000x3878)
 * @param box       the display box the image is cover-fit into
 * @param focal     the cover-fit focal point (center-x, top 25% for the hero)
 */
export function mapHotspotToViewport(
  norm: NormalizedPoint,
  intrinsic: Box,
  box: Box,
  focal: FocalPoint,
): Point {
  const { offsetX, offsetY, renderedWidth, renderedHeight } = coverFit(intrinsic, box, focal);
  return {
    x: offsetX + norm.x * renderedWidth,
    y: offsetY + norm.y * renderedHeight,
  };
}
