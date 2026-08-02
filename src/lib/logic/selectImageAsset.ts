/**
 * Responsive hero image tier.
 */
export type ImageTier = 'small' | 'medium' | 'large';

/**
 * Selects the hero image asset tier matched to the visitor's viewport width.
 *
 * Req 10.2:
 * - `small`  for widths at or below 480px
 * - `medium` for widths from 481px to 1024px inclusive
 * - `large`  for widths above 1024px
 *
 * @param viewportWidth - The visitor's viewport width in CSS pixels.
 * @returns The matching {@link ImageTier}.
 */
export function selectImageAsset(viewportWidth: number): ImageTier {
  if (viewportWidth <= 480) {
    return 'small';
  }
  if (viewportWidth <= 1024) {
    return 'medium';
  }
  return 'large';
}
