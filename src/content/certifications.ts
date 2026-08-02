import { z } from 'zod';

/**
 * The three AWS certifications showcased in the Certifications_Section.
 *
 * Req 7.1: exactly "AWS Certified Solutions Architect – Professional",
 * "AWS Certified Solutions Architect – Associate", and
 * "AWS Certified Advanced Networking – Specialty".
 *
 * Note: the separator in each name is an en-dash (U+2013, "–"), matching the
 * requirement text exactly.
 */
export const CertificationName = z.enum([
  'AWS Certified Solutions Architect – Professional',
  'AWS Certified Solutions Architect – Associate',
  'AWS Certified Advanced Networking – Specialty',
]);
export type CertificationName = z.infer<typeof CertificationName>;

/**
 * A single certification: its name, the image reference used to display it, and
 * descriptive alt text.
 *
 * Req 7.2: each certification carries exactly one image reference.
 * Req 7.5: non-empty alt text serves as the fallback label if the image fails
 * to load.
 */
export const Certification = z.object({
  name: CertificationName,
  imageUrl: z.string(),
  altText: z.string().min(1),
});
export type Certification = z.infer<typeof Certification>;

/**
 * The complete set of certifications.
 *
 * Req 7.1 / 7.2: exactly three entries, each naming a distinct certification.
 */
export const Certifications = z
  .array(Certification)
  .length(3)
  .refine(
    (c) => new Set(c.map((x) => x.name)).size === 3,
    'three distinct certifications',
  );
export type Certifications = z.infer<typeof Certifications>;

/**
 * Seed certifications with placeholder image paths and descriptive alt text,
 * validated at module load so invalid content fails fast.
 */
export const certifications: Certifications = Certifications.parse([
  {
    name: 'AWS Certified Solutions Architect – Associate',
    imageUrl: '/images/certs/saa.png',
    altText: 'AWS Certified Solutions Architect – Associate certification badge',
  },
  {
    name: 'AWS Certified Solutions Architect – Professional',
    imageUrl: '/images/certs/sap.png',
    altText: 'AWS Certified Solutions Architect – Professional certification badge',
  },
  {
    name: 'AWS Certified Advanced Networking – Specialty',
    imageUrl: '/images/certs/ans.png',
    altText: 'AWS Certified Advanced Networking – Specialty certification badge',
  },
]);
