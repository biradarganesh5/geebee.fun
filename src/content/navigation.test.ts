import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { NavTargets } from './navigation';

// Feature: portfolio-website, Property 9: Navigation targets are a non-empty set
// of distinct, well-formed section targets.
//
// The dock was reworked into a minimal, social-forward shortcut bar, so the
// navigation targets no longer form a full bijection over every section.
//
// For any candidate navigation-target array, NavTargets.safeParse succeeds if
// and only if the array is non-empty, every item is a well-formed NavTarget (a
// valid sectionId plus a non-empty label), and every sectionId is distinct.

const SECTION_IDS = [
  'about',
  'skills',
  'experience',
  'projects',
  'homelab',
  'hobbies',
  'certifications',
  'contact',
] as const;

const SECTION_COUNT = SECTION_IDS.length;

type Candidate = { sectionId: unknown; label: unknown };

/**
 * Reference oracle, independent of Zod: the array is valid iff it is non-empty,
 * every item is a well-formed target (valid sectionId + non-empty string
 * label), and every sectionId is distinct.
 */
function isValid(candidate: Candidate[]): boolean {
  if (candidate.length < 1) return false;

  const seen = new Set<string>();
  for (const item of candidate) {
    if (typeof item.sectionId !== 'string') return false;
    if (!(SECTION_IDS as readonly string[]).includes(item.sectionId)) return false;
    if (typeof item.label !== 'string' || item.label.length < 1) return false;
    seen.add(item.sectionId);
  }
  return seen.size === candidate.length;
}

describe('NavTargets schema (Property 9)', () => {
  it('parse succeeds iff the targets are a non-empty set of distinct, well-formed targets', () => {
    // A sectionId arbitrary that is mostly valid but occasionally an unknown
    // string, so we exercise wrong-section cases as well as the valid enum.
    const sectionIdArb = fc.oneof(
      { weight: 9, arbitrary: fc.constantFrom(...SECTION_IDS) },
      { weight: 1, arbitrary: fc.constantFrom('resume', 'blog', '', 'ABOUT') },
    );

    // Labels are mostly non-empty but sometimes empty to exercise the min(1) rule.
    const labelArb = fc.oneof(
      { weight: 9, arbitrary: fc.string({ minLength: 1, maxLength: 20 }) },
      { weight: 1, arbitrary: fc.constant('') },
    );

    const targetArb = fc.record({ sectionId: sectionIdArb, label: labelArb });

    // Generate arrays of varied lengths (including empty and with duplicates)
    // to cover empty, duplicate-section, and invalid-item cases.
    const candidateArb = fc.array(targetArb, { minLength: 0, maxLength: 12 });

    // A generator for guaranteed-valid subsets: a shuffled, distinct subset of
    // sections with non-empty labels, ensuring the success side is exercised.
    const validSubsetArb = fc
      .shuffledSubarray([...SECTION_IDS], { minLength: 1, maxLength: SECTION_COUNT })
      .chain((ids) =>
        fc.tuple(
          ...ids.map((id) =>
            fc
              .string({ minLength: 1, maxLength: 20 })
              .map((label) => ({ sectionId: id, label })),
          ),
        ),
      )
      .map((items) => items as Candidate[]);

    const arb = fc.oneof(
      { weight: 3, arbitrary: candidateArb as fc.Arbitrary<Candidate[]> },
      { weight: 2, arbitrary: validSubsetArb },
    );

    fc.assert(
      fc.property(arb, (candidate) => {
        const result = NavTargets.safeParse(candidate);
        expect(result.success).toBe(isValid(candidate));
      }),
      { numRuns: 200 },
    );
  });

  it('accepts the canonical single About target', () => {
    expect(NavTargets.safeParse([{ sectionId: 'about', label: 'About' }]).success).toBe(
      true,
    );
  });

  it('accepts a distinct multi-section subset', () => {
    const valid = [
      { sectionId: 'about', label: 'About' },
      { sectionId: 'projects', label: 'Projects' },
    ];
    expect(NavTargets.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty list, duplicates, invalid sections, and empty labels', () => {
    // Empty list.
    expect(NavTargets.safeParse([]).success).toBe(false);

    // Duplicate section id.
    const duplicate = [
      { sectionId: 'about', label: 'About' },
      { sectionId: 'about', label: 'About again' },
    ];
    expect(NavTargets.safeParse(duplicate).success).toBe(false);

    // Unknown section id.
    const unknown = [{ sectionId: 'resume', label: 'Resume' }];
    expect(NavTargets.safeParse(unknown).success).toBe(false);

    // Empty label makes a target non-activatable.
    const emptyLabel = [{ sectionId: 'about', label: '' }];
    expect(NavTargets.safeParse(emptyLabel).success).toBe(false);
  });
});
