import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { HeroContentSchema } from './hero';

// Feature: portfolio-website, Property 8: Hero content validation enforces tagline bounds
//
// Validates: Requirements 1.7
//
// Starting from valid base hero content, varying only the tagline:
//   HeroContentSchema parse succeeds iff the tagline length is in [1, 160].
//   Length 0 or > 160 must fail; length 1..160 must succeed.
describe('HeroContentSchema tagline bounds (Property 8)', () => {
  // A valid base that satisfies every other field of the schema. Only the
  // tagline is mutated per-run so the tagline bound is the sole variable.
  const baseHero = {
    name: 'Ganesh Biradar' as const,
    intrinsicWidth: 3000 as const,
    intrinsicHeight: 3878 as const,
    focal: { x: 0.5 as const, y: 0.125 as const },
    assets: {
      lqip: 'data:image/png;base64,AAAA',
      small: '/images/hero/hero-small.avif',
      medium: '/images/hero/hero-medium.avif',
      large: '/images/hero/hero-large.avif',
    },
  };

  const withTagline = (tagline: string) => ({ ...baseHero, tagline });

  it('accepts iff tagline length is 1..160, rejects length 0 or >160', () => {
    // Bias generation toward the exact boundaries (0, 1, 160, 161) while also
    // covering random lengths inside and outside the valid range.
    const lengthArb = fc.oneof(
      { weight: 2, arbitrary: fc.constantFrom(0, 1, 160, 161) },
      { weight: 3, arbitrary: fc.integer({ min: 1, max: 160 }) },
      { weight: 3, arbitrary: fc.integer({ min: 161, max: 1000 }) },
      { weight: 1, arbitrary: fc.constant(0) },
    );

    fc.assert(
      fc.property(
        lengthArb,
        // Use non-empty character content so length is the only factor.
        fc.string({ unit: fc.constantFrom('a', 'b', 'Z', '9', ' ', '🚀') }),
        (targetLength, sampleChars) => {
          // Build a string of exactly targetLength characters (code units).
          const filler = (sampleChars + 'x').replace(/\s/g, 'x') || 'x';
          let tagline = '';
          while (tagline.length < targetLength) {
            tagline += filler;
          }
          tagline = tagline.slice(0, targetLength);
          expect(tagline.length).toBe(targetLength);

          const result = HeroContentSchema.safeParse(withTagline(tagline));
          const shouldPass = targetLength >= 1 && targetLength <= 160;
          expect(result.success).toBe(shouldPass);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('honors the exact boundary values', () => {
    expect(HeroContentSchema.safeParse(withTagline('')).success).toBe(false);
    expect(HeroContentSchema.safeParse(withTagline('a')).success).toBe(true);
    expect(HeroContentSchema.safeParse(withTagline('a'.repeat(160))).success).toBe(true);
    expect(HeroContentSchema.safeParse(withTagline('a'.repeat(161))).success).toBe(false);
  });
});
