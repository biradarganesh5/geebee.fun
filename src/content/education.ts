import { z } from 'zod';

/**
 * Education content layer: academic history sourced from the Education section
 * of `main.md`.
 *
 * Defines the Zod schema, the inferred TypeScript type, and the validated seed
 * data parsed at module load so invalid content fails fast (build-time +
 * test-time validation), matching the sibling content modules.
 */

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

/**
 * A single education entry.
 *
 * - `school` and `degree` are required non-empty strings.
 * - `start` is optional (the source only lists a completion year).
 * - `end` is the completion year/date.
 * - `detail` is an optional extra (e.g. CGPA).
 */
export const EducationEntry = z.object({
  school: z.string().min(1),
  degree: z.string().min(1),
  start: z.string().min(1).optional(),
  end: z.string().min(1),
  detail: z.string().min(1).optional(),
});
export type EducationEntry = z.infer<typeof EducationEntry>;

/** The education collection: a non-empty list of entries. */
export const Education = z.array(EducationEntry).min(1);
export type Education = z.infer<typeof Education>;

// -----------------------------------------------------------------------------
// Seed data (parsed at module load)
// -----------------------------------------------------------------------------

/**
 * Validated education history, sourced from `main.md`, validated at module load
 * so invalid content fails fast.
 */
export const education: Education = Education.parse([
  {
    school: 'Mumbai University',
    degree: 'Bachelor of Engineering in Computer Engineering',
    end: '2022',
    detail: '7.25/10.0 CGPA',
  },
]);
