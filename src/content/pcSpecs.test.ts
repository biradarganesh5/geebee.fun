import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PcComponents, PcCategory, pcComponents } from './pcSpecs';

// The eleven canonical categories the schema demands (each exactly once).
const CATEGORIES = PcCategory.options;

/**
 * Arbitrary single component: any of the eleven categories paired with an
 * arbitrary string value (may be empty, so empty-value invalid cases are
 * exercised).
 */
const componentArb = fc.record({
  category: fc.constantFrom(...CATEGORIES),
  value: fc.string(),
});

/**
 * Candidate arrays of arbitrary length (0–15) with arbitrary components, so the
 * generator naturally covers wrong-length, duplicate-category, and empty-value
 * cases as well as occasionally valid shapes.
 */
const candidateArb = fc.array(componentArb, { minLength: 0, maxLength: 15 });

/** Mirror of the schema's acceptance rule, computed independently. */
function shouldBeValid(candidate: { category: string; value: string }[]): boolean {
  if (candidate.length !== 11) return false;
  if (candidate.some((c) => c.value.length < 1)) return false;
  const uniqueCategories = new Set(candidate.map((c) => c.category));
  return uniqueCategories.size === 11;
}

describe('PcComponents — validation', () => {
  // Feature: portfolio-website, Property 12: PC components validation enforces eleven unique components
  // Validates: Requirements 5.1
  it('Property 12: parse succeeds iff exactly 11 unique-category, non-empty-value entries', () => {
    fc.assert(
      fc.property(candidateArb, (candidate) => {
        const result = PcComponents.safeParse(candidate);
        expect(result.success).toBe(shouldBeValid(candidate));
      }),
      { numRuns: 100 },
    );
  });

  // Feature: portfolio-website, Property 12: PC components validation enforces eleven unique components
  // Validates: Requirements 5.1
  it('Property 12: a full unique-category set with non-empty values always parses', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 11, maxLength: 11 }),
        (values) => {
          const full = CATEGORIES.map((category, i) => ({
            category,
            value: values[i],
          }));
          expect(PcComponents.safeParse(full).success).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects a duplicate category (eleven entries, only ten distinct)', () => {
    const dup = CATEGORIES.map((category) => ({ category, value: 'x' }));
    dup[10] = { category: CATEGORIES[0], value: 'x' };
    expect(PcComponents.safeParse(dup).success).toBe(false);
  });

  it('rejects an empty value among eleven unique categories', () => {
    const withEmpty = CATEGORIES.map((category, i) => ({
      category,
      value: i === 3 ? '' : 'x',
    }));
    expect(PcComponents.safeParse(withEmpty).success).toBe(false);
  });

  it('rejects wrong length (ten and twelve entries)', () => {
    const ten = CATEGORIES.slice(0, 10).map((category) => ({ category, value: 'x' }));
    expect(PcComponents.safeParse(ten).success).toBe(false);
    const twelve = [
      ...CATEGORIES.map((category) => ({ category, value: 'x' })),
      { category: CATEGORIES[0], value: 'x' },
    ];
    expect(PcComponents.safeParse(twelve).success).toBe(false);
  });

  it('accepts the seeded pcComponents data', () => {
    expect(PcComponents.safeParse(pcComponents).success).toBe(true);
  });
});
