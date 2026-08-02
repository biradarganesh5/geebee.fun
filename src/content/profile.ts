import { z } from 'zod';

/**
 * Profile content layer: personal identity, contact, and social links used by
 * the minimal hero, contact affordances, and the social dock.
 *
 * Defines the Zod schema, the inferred TypeScript type, and the validated seed
 * data parsed at module load so invalid content fails fast (build-time +
 * test-time validation), matching the pattern in the sibling content modules.
 */

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

/** ISO calendar date in `YYYY-MM-DD` form (e.g. birthday). */
const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected an ISO date (YYYY-MM-DD)');

/**
 * A single social / contact link.
 *
 * - `name` is the display name of the destination (GitHub, LinkedIn, ...).
 * - `url` is the target; http(s) links and `mailto:` links are both allowed.
 * - `handle` is an optional short display handle (e.g. a username).
 * - `navbar` flags whether the link surfaces in the social dock.
 */
export const SocialLink = z.object({
  name: z.string().min(1),
  url: z
    .string()
    .min(1)
    .refine(
      (u) => /^https?:\/\//.test(u) || u.startsWith('mailto:'),
      'expected an http(s) URL or a mailto: link',
    ),
  handle: z.string().min(1).optional(),
  navbar: z.boolean(),
});
export type SocialLink = z.infer<typeof SocialLink>;

/**
 * The profile content model backing the minimal hero, contact, and dock.
 *
 * - `name` is fixed to "Ganesh Biradar" and `initials` to "GB".
 * - `birthday` is an ISO date string.
 * - `location` is a human-readable location string.
 * - `description` is a concise one-liner tagline.
 * - `avatarUrl` points at the avatar asset (a UI initials fallback covers its
 *   absence).
 * - `email` is the primary contact address.
 * - `socials` is a non-empty list of social / contact links.
 */
export const ProfileSchema = z.object({
  name: z.literal('Ganesh Biradar'),
  initials: z.literal('GB'),
  birthday: IsoDate,
  location: z.string().min(1),
  description: z.string().min(1).max(200),
  avatarUrl: z.string().min(1),
  email: z.string().email(),
  socials: z.array(SocialLink).min(1),
});
export type Profile = z.infer<typeof ProfileSchema>;

// -----------------------------------------------------------------------------
// Seed data (parsed at module load)
// -----------------------------------------------------------------------------

/**
 * Validated profile content. Parsing at module load guarantees the fixed
 * name/initials, the ISO birthday format, a valid email, and the presence of at
 * least one social link before render.
 *
 * NOTE: `location` is a placeholder guess ('India') — the resume source does
 * not state a precise city, so this should be confirmed/refined by the owner.
 */
export const profile: Profile = ProfileSchema.parse({
  name: 'Ganesh Biradar',
  initials: 'GB',
  birthday: '1999-08-22',
  location: 'Pune, MH',
  description:
    'Certified DevOps Engineer/Nerd. I love building things and helping people. Currently looking for work.',
  avatarUrl: '/images/avatar.jpg',
  email: 'biradarganesh5@gmail.com',
  socials: [
    {
      name: 'GitHub',
      url: 'https://github.com/biradarganesh5',
      handle: 'biradarganesh5',
      navbar: true,
    },
    {
      name: 'LinkedIn',
      url: 'https://linkedin.com/in/ganeshbiradarrr',
      handle: 'ganeshbiradarrr',
      navbar: true,
    },
    {
      name: 'Portfolio',
      url: 'https://geebee.fun',
      handle: 'geebee.fun',
      navbar: true,
    },
    {
      name: 'Email',
      url: 'mailto:biradarganesh5@gmail.com',
      handle: 'biradarganesh5@gmail.com',
      navbar: true,
    },
  ],
});
