import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Hobbies, HobbyId } from './hobbies';

const HOBBY_IDS = ['homelabbing', 'pcb-designing', '3d-modelling'] as const;

/**
 * A single candidate hobby entry. Labels can be empty (invalid) or non-empty,
 * and style/animation variants are drawn from a small pool so duplicate
 * combinations arise naturally across generated arrays.
 */
const entryArb = fc.record({
  id: fc.constantFrom(...HOBBY_IDS),
  label: fc.string({ maxLength: 8 }),
  styleVariant: fc.constantFrom('s0', 's1', 's2'),
  animationVariant: fc.constantFrom('a0', 'a1', 'a2'),
});

/** Arbitrary candidate arrays of length 0..6 so length and uniqueness both vary. */
const candidateArb = fc.array(entryArb, { minLength: 0, maxLength: 6 });

/** Oracle: is this candidate a valid Hobbies collection per Req 3.1 / 3.2? */
function isValidHobbies(
  candidate: ReadonlyArray<{
    id: string;
    label: string;
    styleVariant: string;
    animationVariant: string;
  }>,
): boolean {
  // Req 3.1: exactly three labeled entries (each label non-empty).
  if (candidate.length !== 3) return false;
  if (candidate.some((e) => e.label.length < 1)) return false;
  if (candidate.some((e) => !HobbyId.safeParse(e.id).success)) return false;
  // Req 3.2: no two entries share the same style+animation combination.
  const combos = new Set(
    candidate.map((e) => `${e.styleVariant}|${e.animationVariant}`),
  );
  return combos.size === candidate.length;
}

describe('Hobbies schema validation', () => {
  // Feature: portfolio-website, Property 10: Hobbies validation enforces exactly three distinct entries
  // Validates: Requirements 3.1, 3.2
  it('Property 10: parse succeeds iff three labeled entries with unique style+animation combos', () => {
    fc.assert(
      fc.property(candidateArb, (candidate) => {
        const result = Hobbies.safeParse(candidate);
        expect(result.success).toBe(isValidHobbies(candidate));
      }),
      { numRuns: 100 },
    );
  });

  it('accepts a canonical valid collection of three distinct entries', () => {
    const valid = [
      { id: 'homelabbing', label: 'Homelabbing', styleVariant: 's0', animationVariant: 'a0' },
      { id: 'pcb-designing', label: 'PCB designing', styleVariant: 's1', animationVariant: 'a1' },
      { id: '3d-modelling', label: '3D modelling', styleVariant: 's2', animationVariant: 'a2' },
    ];
    expect(Hobbies.safeParse(valid).success).toBe(true);
  });

  it('rejects wrong length, empty labels, and duplicate style+animation combos', () => {
    const base = {
      id: 'homelabbing',
      label: 'Homelabbing',
      styleVariant: 's0',
      animationVariant: 'a0',
    };
    // Wrong length (2 entries).
    expect(Hobbies.safeParse([base, base]).success).toBe(false);
    // Empty label.
    expect(
      Hobbies.safeParse([
        { ...base, label: '' },
        { id: 'pcb-designing', label: 'PCB designing', styleVariant: 's1', animationVariant: 'a1' },
        { id: '3d-modelling', label: '3D modelling', styleVariant: 's2', animationVariant: 'a2' },
      ]).success,
    ).toBe(false);
    // Duplicate style+animation combo.
    expect(
      Hobbies.safeParse([
        base,
        { id: 'pcb-designing', label: 'PCB designing', styleVariant: 's0', animationVariant: 'a0' },
        { id: '3d-modelling', label: '3D modelling', styleVariant: 's2', animationVariant: 'a2' },
      ]).success,
    ).toBe(false);
  });
});
