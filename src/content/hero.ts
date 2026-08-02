/**
 * Hero + hotspot content layer.
 *
 * Defines the Zod schemas for the Landing_Page Hero_Image content and its
 * interactive Hotspots, the TypeScript types inferred from those schemas, and
 * the validated seed data. All content is parsed through the schemas at module
 * load so invalid content fails fast (build-time + test-time validation).
 *
 * Requirements: 1.2 (aspect ratio 3000:3878), 1.3 (focal center-x / top 25%),
 * 1.7 (name + tagline 1..160 chars), 2.1 (>=2 hotspots incl. PC + soldering,
 * each with a 44px minimum activation target).
 */
import { z } from 'zod';

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

/**
 * The set of responsive Hero_Image asset references. Each tier is served to a
 * viewport-matched width (Req 10.2); `lqip` is a base64/URL blur placeholder
 * shown until the full image decodes (Req 10.1).
 */
export const HeroAssetsSchema = z.object({
  lqip: z.string(),
  small: z.string(),
  medium: z.string(),
  large: z.string(),
});

/**
 * Hero_Image content model.
 *
 * - `name` is fixed to "Ganesh Biradar" (Req 1.7).
 * - `tagline` is an introductory line of 1..160 characters (Req 1.7).
 * - `intrinsicWidth`/`intrinsicHeight` fix the 3000:3878 aspect ratio (Req 1.2).
 * - `focal` is the normalized object-position focal point: horizontal center
 *   and top 25% of the image (Req 1.3).
 */
export const HeroContentSchema = z.object({
  name: z.literal('Ganesh Biradar'),
  tagline: z.string().min(1).max(160),
  intrinsicWidth: z.literal(3000),
  intrinsicHeight: z.literal(3878),
  focal: z.object({ x: z.literal(0.5), y: z.literal(0.125) }),
  assets: HeroAssetsSchema,
});

/** The subjects a Hotspot can represent on the Hero_Image (Req 2.1, 2.5, 2.6). */
export const HotspotSubjectSchema = z.enum(['pc', 'soldering']);

/**
 * A single interactive Hotspot overlaid on the Hero_Image.
 *
 * `x`/`y` are resolution-independent normalized coordinates in [0, 1] relative
 * to the intrinsic image, projected into the rendered box at runtime. Each
 * Hotspot declares a `minTargetPx` of 44 for its minimum activation target
 * (Req 2.1).
 */
export const HotspotSchema = z.object({
  id: z.string(),
  subject: HotspotSubjectSchema,
  label: z.string().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  minTargetPx: z.literal(44),
});

/**
 * The collection of Hotspots. Must contain at least two hotspots including one
 * over the PC and one over the soldering station (Req 2.1).
 */
export const HotspotsSchema = z
  .array(HotspotSchema)
  .refine(
    (h) =>
      h.some((x) => x.subject === 'pc') &&
      h.some((x) => x.subject === 'soldering'),
    'must include a PC and a soldering hotspot'
  )
  .refine((h) => h.length >= 2, 'at least two hotspots');

// -----------------------------------------------------------------------------
// Inferred types
// -----------------------------------------------------------------------------

export type HeroAssets = z.infer<typeof HeroAssetsSchema>;
export type HeroContent = z.infer<typeof HeroContentSchema>;
export type HotspotSubject = z.infer<typeof HotspotSubjectSchema>;
export type Hotspot = z.infer<typeof HotspotSchema>;
export type Hotspots = z.infer<typeof HotspotsSchema>;

// -----------------------------------------------------------------------------
// Seed data (parsed at module load)
// -----------------------------------------------------------------------------

/**
 * Validated Hero_Image content. Parsing at module load guarantees the fixed
 * name/dimensions/focal point and the tagline bounds hold before render.
 */
export const heroContent: HeroContent = HeroContentSchema.parse({
  name: 'Ganesh Biradar',
  tagline:
    'AWS-certified DevOps engineer by day, homelab-hoarding, PCB-soldering, k3s-clustering nerd by night.',
  intrinsicWidth: 3000,
  intrinsicHeight: 3878,
  focal: { x: 0.5, y: 0.125 },
  assets: {
    // Blurred low-quality image placeholder (LQIP) generated from the real
    // workspace photo (scripts/gen-hero-assets.mjs), shown until the full
    // image decodes.
    lqip: 'data:image/jpeg;base64,/9j/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAfABgDASIAAhEBAxEB/8QAGAAAAwEBAAAAAAAAAAAAAAAAAAMFAQT/xAAhEAABAwQCAwEAAAAAAAAAAAABAAIDBBESIQUiFTEyQf/EABcBAAMBAAAAAAAAAAAAAAAAAAACAwT/xAAbEQACAwADAAAAAAAAAAAAAAAAAQIREgMTIf/aAAwDAQACEQMRAD8AnU8pJsQu4Qgsz/FPpoi2QaPtWn4inwH0nlOiMuKU34yQ+QGUtDdIRNGWOuCNoVe5lIrKoc3lIWsHQEhZ5SN79ixUNjXO1dVaXicmh8hWZuh0hNRVnL56oTamERC1rhCN2GT/2Q==',
    small: '/images/hero/hero-small.jpg',
    medium: '/images/hero/hero-medium.jpg',
    large: '/images/hero/hero-large.jpg',
  },
});

/**
 * Validated Hotspots for the Hero_Image. Coordinates are normalized to the
 * intrinsic image: the PC sits left-of-center on the desk, the soldering
 * station is to the right. Both carry a 44px minimum activation target.
 */
export const hotspots: Hotspots = HotspotsSchema.parse([
  {
    id: 'hotspot-pc',
    subject: 'pc',
    label: 'Main gaming PC — see the full build specs',
    x: 0.38,
    y: 0.52,
    minTargetPx: 44,
  },
  {
    id: 'hotspot-soldering',
    subject: 'soldering',
    label: 'Soldering station — PCB designing bench',
    x: 0.72,
    y: 0.58,
    minTargetPx: 44,
  },
]);
