/**
 * Fluid body typography.
 *
 * Models the same interpolation a CSS `clamp()` produces for body text: a linear
 * ramp between a minimum font size at the smallest supported viewport and a
 * maximum font size at the largest supported viewport, clamped so the computed
 * size never falls below the minimum (nor rises above the maximum) outside that
 * range.
 *
 * Req 9.2: body text renders at a minimum computed font size of 14px across all
 * viewport widths from 360px to 2560px. The chosen minimum (16px) sits
 * comfortably above that 14px floor.
 */

/**
 * Smallest viewport width (CSS px) the fluid ramp is anchored to.
 * Req 9.2 / 9.1: supported range starts at 360px.
 */
export const MIN_VIEWPORT_PX = 360;

/**
 * Largest viewport width (CSS px) the fluid ramp is anchored to.
 * Req 9.2 / 9.1: supported range ends at 2560px.
 */
export const MAX_VIEWPORT_PX = 2560;

/**
 * Body font size (CSS px) at or below {@link MIN_VIEWPORT_PX}.
 * Kept above the 14px accessibility floor mandated by Req 9.2.
 */
export const MIN_BODY_FONT_PX = 16;

/**
 * Body font size (CSS px) at or above {@link MAX_VIEWPORT_PX}.
 */
export const MAX_BODY_FONT_PX = 20;

/**
 * Absolute minimum computed body font size (CSS px) required by Req 9.2.
 */
export const MIN_ACCESSIBLE_FONT_PX = 14;

/**
 * Slope of the linear ramp in px of font size per px of viewport width.
 */
const SLOPE_PER_PX =
  (MAX_BODY_FONT_PX - MIN_BODY_FONT_PX) / (MAX_VIEWPORT_PX - MIN_VIEWPORT_PX);

/**
 * Computes the body font size (in CSS px) for a given viewport width, modeling
 * the behavior of the `clamp()` expression returned by {@link bodyFontClamp}.
 *
 * The size ramps linearly from {@link MIN_BODY_FONT_PX} at {@link MIN_VIEWPORT_PX}
 * to {@link MAX_BODY_FONT_PX} at {@link MAX_VIEWPORT_PX}, and is clamped to those
 * bounds outside the [360, 2560] range. Because the minimum is 16px, the result
 * is always >= 14px (Req 9.2).
 *
 * @param viewportWidth - The visitor's viewport width in CSS pixels.
 * @returns The computed body font size in CSS pixels.
 */
export function computeBodyFontSize(viewportWidth: number): number {
  const preferred =
    MIN_BODY_FONT_PX + SLOPE_PER_PX * (viewportWidth - MIN_VIEWPORT_PX);

  // clamp(MIN, preferred, MAX)
  return Math.min(MAX_BODY_FONT_PX, Math.max(MIN_BODY_FONT_PX, preferred));
}

/**
 * Returns the CSS `clamp()` expression used for body typography in stylesheets.
 *
 * The preferred term is expressed as `intercept(px) + slope(vw)` so browsers
 * interpolate exactly as {@link computeBodyFontSize} models, while the min/max
 * terms guarantee the size never leaves the [16px, 20px] band.
 *
 * @returns A CSS `clamp(min, preferred, max)` string.
 */
export function bodyFontClamp(): string {
  // 1vw === viewportWidth / 100, so px-per-vw factor is SLOPE_PER_PX * 100.
  const slopeVw = SLOPE_PER_PX * 100;
  const interceptPx = MIN_BODY_FONT_PX - SLOPE_PER_PX * MIN_VIEWPORT_PX;

  const preferred = `${round(interceptPx)}px + ${round(slopeVw)}vw`;
  return `clamp(${MIN_BODY_FONT_PX}px, ${preferred}, ${MAX_BODY_FONT_PX}px)`;
}

/**
 * Rounds to 4 decimal places to keep the generated CSS compact and stable.
 */
function round(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}
