import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ResumeContent } from './resume';

// Feature: portfolio-website, Property 14: Resume employers and projects validation
//
// Validates: Requirements 6.2, 6.4
//
// ResumeContent.safeParse succeeds only when:
//   - there are exactly 3 employers, each with a non-empty role and non-empty
//     start/end period (Req 6.2), and
//   - there are exactly 2 projects, each with a description of 20..300 chars (Req 6.4),
//   - and the remaining constraints hold (headline non-empty, yearsExperience >= 3,
//     >= 4 non-empty achievements, formalResumeUrl string).
//
// The generators intentionally mix valid and invalid shapes (wrong employer
// count, wrong project count, description length 19 or 301, empty role) so both
// acceptance and rejection paths are exercised.

const EMPLOYER_NAMES = ['AmberStudent', 'IAMOPS', 'Mactores'] as const;
const PROJECT_NAMES = [
  'AI-Driven Pipeline Failure Notifier',
  'ECS to EKS Production Migration',
] as const;

// A string of an exact length (used to hit description boundary lengths).
const stringOfLength = (n: number) =>
  fc.string({ minLength: n, maxLength: n }).map((s) =>
    // fast-check may produce surrogate pairs; normalize to exact length by
    // padding/truncating with a plain ASCII fill so `.length` is deterministic.
    (s.padEnd(n, 'x')).slice(0, n),
  );

// Employer entry generator. When `valid` we honor the min(1) constraints;
// otherwise we may emit empty role/start/end.
const employmentArb = (valid: boolean) =>
  fc.record({
    employer: fc.constantFrom(...EMPLOYER_NAMES),
    role: valid ? fc.string({ minLength: 1, maxLength: 40 }) : fc.constant(''),
    start: valid ? fc.string({ minLength: 1, maxLength: 20 }) : fc.constant(''),
    end: valid ? fc.string({ minLength: 1, maxLength: 20 }) : fc.constant(''),
  });

// A valid project whose description length is drawn per-example from 20..300.
const validProjectArb = fc.record({
  name: fc.constantFrom(...PROJECT_NAMES),
  description: fc.integer({ min: 20, max: 300 }).chain((n) => stringOfLength(n)),
});

// A fully valid candidate.
const validCandidateArb = fc.record({
  headline: fc.string({ minLength: 1, maxLength: 200 }),
  yearsExperience: fc.integer({ min: 3, max: 40 }),
  employers: fc.tuple(
    employmentArb(true),
    employmentArb(true),
    employmentArb(true),
  ),
  achievements: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
    minLength: 4,
    maxLength: 8,
  }),
  projects: fc.tuple(validProjectArb, validProjectArb),
  formalResumeUrl: fc.webUrl(),
});

describe('ResumeContent schema (Property 14)', () => {
  it('accepts only content with exactly 3 employers and 2 valid-length projects', () => {
    fc.assert(
      fc.property(validCandidateArb, (candidate) => {
        // Sanity: constraints are all honored, so parse must succeed.
        const result = ResumeContent.safeParse(candidate);
        expect(result.success).toBe(true);
      }),
      { numRuns: 150 },
    );
  });

  it('rejects candidates that violate employer/project constraints', () => {
    // Each arbitrary produces a candidate that violates exactly one rule.
    const invalidCandidateArb = fc.oneof(
      // Wrong employer count: 2 employers.
      validCandidateArb.map((c) => ({
        ...c,
        employers: [c.employers[0], c.employers[1]],
      })),
      // Wrong employer count: 4 employers.
      validCandidateArb.map((c) => ({
        ...c,
        employers: [...c.employers, c.employers[0]],
      })),
      // Wrong project count: 1 project.
      validCandidateArb.map((c) => ({ ...c, projects: [c.projects[0]] })),
      // Wrong project count: 3 projects.
      validCandidateArb.map((c) => ({
        ...c,
        projects: [...c.projects, c.projects[0]],
      })),
      // Description too short (19 chars).
      fc.tuple(validCandidateArb, stringOfLength(19)).map(([c, desc]) => ({
        ...c,
        projects: [
          { ...c.projects[0], description: desc },
          c.projects[1],
        ],
      })),
      // Description too long (301 chars).
      fc.tuple(validCandidateArb, stringOfLength(301)).map(([c, desc]) => ({
        ...c,
        projects: [
          c.projects[0],
          { ...c.projects[1], description: desc },
        ],
      })),
      // Empty role on an employer.
      validCandidateArb.map((c) => ({
        ...c,
        employers: [{ ...c.employers[0], role: '' }, c.employers[1], c.employers[2]],
      })),
    );

    fc.assert(
      fc.property(invalidCandidateArb, (candidate) => {
        const result = ResumeContent.safeParse(candidate);
        expect(result.success).toBe(false);
      }),
      { numRuns: 150 },
    );
  });
});
