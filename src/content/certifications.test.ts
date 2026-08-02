import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Certifications } from './certifications';

// Feature: portfolio-website, Property 15: Certifications validation enforces three distinct certs each with one image
//
// Validates: Requirements 7.1, 7.2
//
// Certifications.safeParse succeeds iff the array is exactly the three named
// AWS certifications, each distinct, each carrying an imageUrl and non-empty
// altText. Any deviation (duplicate cert, missing/wrong cert, wrong length,
// empty altText, non-string imageUrl) must fail validation.

// The three certification names use an en-dash (U+2013, "–"), matching the
// requirement text exactly.
const CERT_NAMES = [
  'AWS Certified Solutions Architect – Professional',
  'AWS Certified Solutions Architect – Associate',
  'AWS Certified Advanced Networking – Specialty',
] as const;

/** A well-formed certification entry for a given name. */
function makeCert(name: string, altText = 'badge alt text', imageUrl = '/img/cert.png') {
  return { name, imageUrl, altText };
}

/**
 * Predicate mirroring the schema contract independently of Zod, so the property
 * asserts the schema agrees with the intended semantics rather than tautology.
 */
function isValidCertifications(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 3) return false;
  const names = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) return false;
    const e = entry as Record<string, unknown>;
    if (!CERT_NAMES.includes(e.name as (typeof CERT_NAMES)[number])) return false;
    if (typeof e.imageUrl !== 'string') return false;
    if (typeof e.altText !== 'string' || e.altText.length < 1) return false;
    names.add(e.name as string);
  }
  return names.size === 3;
}

describe('Certifications schema', () => {
  it('accepts/rejects candidate arrays iff they are three distinct named certs each with one image (Property 15)', () => {
    // A single certification arbitrary. Names are drawn from the valid set
    // (biased) plus occasional wrong names; altText can be empty; imageUrl can
    // occasionally be a non-string to exercise the imageUrl contract.
    const certArb = fc.record({
      name: fc.oneof(
        { weight: 8, arbitrary: fc.constantFrom(...CERT_NAMES) },
        { weight: 1, arbitrary: fc.string() },
      ),
      imageUrl: fc.oneof(
        { weight: 9, arbitrary: fc.string() },
        { weight: 1, arbitrary: fc.constant(undefined as unknown as string) },
      ),
      altText: fc.oneof(
        { weight: 3, arbitrary: fc.constant('') },
        { weight: 7, arbitrary: fc.string({ minLength: 1 }) },
      ),
    });

    // Candidate arrays of varying lengths (0..5) so wrong-length cases are hit.
    const candidateArb = fc.array(certArb, { minLength: 0, maxLength: 5 });

    fc.assert(
      fc.property(candidateArb, (candidate) => {
        const result = Certifications.safeParse(candidate);
        expect(result.success).toBe(isValidCertifications(candidate));
      }),
      { numRuns: 300 },
    );
  });

  it('accepts every permutation of the three valid certs', () => {
    fc.assert(
      fc.property(
        fc.constant(null).chain(() => shuffledIndices()),
        (order) => {
          const candidate = order.map((i) => makeCert(CERT_NAMES[i]));
          expect(Certifications.safeParse(candidate).success).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Explicit invalid-case examples for clarity alongside the property.
  it('rejects a duplicated certification', () => {
    const candidate = [
      makeCert(CERT_NAMES[0]),
      makeCert(CERT_NAMES[0]),
      makeCert(CERT_NAMES[1]),
    ];
    expect(Certifications.safeParse(candidate).success).toBe(false);
  });

  it('rejects a missing certification (wrong length)', () => {
    const candidate = [makeCert(CERT_NAMES[0]), makeCert(CERT_NAMES[1])];
    expect(Certifications.safeParse(candidate).success).toBe(false);
  });

  it('rejects an unknown certification name', () => {
    const candidate = [
      makeCert(CERT_NAMES[0]),
      makeCert(CERT_NAMES[1]),
      makeCert('AWS Certified Nonexistent - Made Up'),
    ];
    expect(Certifications.safeParse(candidate).success).toBe(false);
  });

  it('rejects an empty altText', () => {
    const candidate = [
      makeCert(CERT_NAMES[0], ''),
      makeCert(CERT_NAMES[1]),
      makeCert(CERT_NAMES[2]),
    ];
    expect(Certifications.safeParse(candidate).success).toBe(false);
  });

  it('accepts the canonical three distinct certs', () => {
    const candidate = CERT_NAMES.map((n) => makeCert(n));
    expect(Certifications.safeParse(candidate).success).toBe(true);
  });
});

/** Arbitrary producing a permutation of [0,1,2]. */
function shuffledIndices() {
  return fc
    .constant([0, 1, 2])
    .chain((base) => fc.shuffledSubarray(base, { minLength: 3, maxLength: 3 }));
}
