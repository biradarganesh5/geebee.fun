import { z } from 'zod';

/**
 * The eight navigable sections of the Portfolio_Site.
 *
 * Req 1.8: the Navigation_Control provides one distinct activatable target for
 * each of the About, Skills, Experience, Projects, Homelab, Hobbies,
 * Certifications, and Contact sections.
 */
export const SectionId = z.enum([
  'about',
  'skills',
  'experience',
  'projects',
  'homelab',
  'hobbies',
  'certifications',
  'contact',
]);
export type SectionId = z.infer<typeof SectionId>;

/**
 * A single navigation target: the section it activates plus its display label.
 */
export const NavTarget = z.object({
  sectionId: SectionId,
  label: z.string().min(1),
});
export type NavTarget = z.infer<typeof NavTarget>;

/**
 * The set of section navigation targets surfaced by the dock.
 *
 * The dock was reworked into a minimal, social-forward shortcut bar: it no
 * longer indexes every section. This schema therefore requires a non-empty list
 * of targets with distinct sectionIds (each a valid {@link SectionId}), rather
 * than a full bijection over all sections.
 */
export const NavTargets = z
  .array(NavTarget)
  .min(1)
  .refine(
    (n) => new Set(n.map((t) => t.sectionId)).size === n.length,
    'each navigation target must reference a distinct section',
  );
export type NavTargets = z.infer<typeof NavTargets>;

/**
 * Seed navigation targets with human-friendly labels, validated at module load.
 * Only the About jump link is surfaced in the dock; the remaining dock slots are
 * social shortcuts rendered by the Navigation island from the profile layer.
 */
export const navTargets: NavTargets = NavTargets.parse([
  { sectionId: 'about', label: 'About' },
]);
