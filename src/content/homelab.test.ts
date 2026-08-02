import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Services } from './homelab';

// Feature: portfolio-website, Property 11: Homelab services validation enforces the exact six services
//
// Validates: Requirements 4.4
//
// Services.safeParse(candidate) succeeds IFF the candidate array lists exactly
// the six named services Jellyfin, Immich, Seafile, qBittorrent, WireGuard, and
// Vaultwarden (each appearing exactly once) and every service's purpose is
// 1..280 chars.

const SERVICES = [
  'Jellyfin',
  'Immich',
  'Seafile',
  'qBittorrent',
  'WireGuard',
  'Vaultwarden',
] as const;

const COUNT = SERVICES.length;

/**
 * Independent reference oracle for validity, derived directly from the
 * acceptance criteria (Req 4.4) rather than from the schema implementation.
 */
function isValidServices(candidate: unknown): boolean {
  if (!Array.isArray(candidate)) return false;
  if (candidate.length !== COUNT) return false;
  const names = new Set<string>();
  for (const item of candidate) {
    if (typeof item !== 'object' || item === null) return false;
    const { name, purpose } = item as { name?: unknown; purpose?: unknown };
    if (typeof name !== 'string') return false;
    if (!(SERVICES as readonly string[]).includes(name)) return false;
    if (typeof purpose !== 'string') return false;
    if (purpose.length < 1 || purpose.length > 280) return false;
    names.add(name);
  }
  // exactly-once for each of the services => that many distinct names
  return names.size === COUNT;
}

// A purpose string generator biased toward the 1 and 280 length boundaries
// as well as the invalid 0 and 281 lengths.
const purposeArb = fc.oneof(
  { weight: 6, arbitrary: fc.string({ minLength: 1, maxLength: 280 }) },
  { weight: 1, arbitrary: fc.constant('') }, // invalid: length 0
  { weight: 1, arbitrary: fc.string({ minLength: 1, maxLength: 1 }) }, // boundary: length 1
  {
    weight: 1,
    arbitrary: fc
      .integer({ min: 280, max: 280 })
      .map((n) => 'x'.repeat(n)),
  }, // boundary: length 280
  {
    weight: 1,
    arbitrary: fc
      .integer({ min: 281, max: 400 })
      .map((n) => 'x'.repeat(n)),
  }, // invalid: length > 280
);

// A name generator: mostly one of the valid enum names, occasionally an
// invalid name to exercise the enum constraint.
const nameArb = fc.oneof(
  { weight: 9, arbitrary: fc.constantFrom(...SERVICES) },
  { weight: 1, arbitrary: fc.string() }, // possibly-invalid arbitrary name
);

const serviceArb = fc.record({ name: nameArb, purpose: purposeArb });

// Candidate arrays across many shapes: wrong lengths, duplicates, missing
// entries, and (via the exact-permutation branch) valid permutations.
const candidateArb = fc.oneof(
  // arbitrary-length arrays of arbitrary services (covers wrong length,
  // duplicates, missing names, invalid purposes)
  { weight: 6, arbitrary: fc.array(serviceArb, { minLength: 0, maxLength: 9 }) },
  // exactly-COUNT arrays (stresses the distinctness / purpose-bounds logic)
  {
    weight: 3,
    arbitrary: fc.array(serviceArb, { minLength: COUNT, maxLength: COUNT }),
  },
  // guaranteed-valid permutations: shuffle the names, valid purposes
  {
    weight: 3,
    arbitrary: fc
      .tuple(
        fc.shuffledSubarray([...SERVICES], {
          minLength: COUNT,
          maxLength: COUNT,
        }),
        fc.array(fc.string({ minLength: 1, maxLength: 280 }), {
          minLength: COUNT,
          maxLength: COUNT,
        }),
      )
      .map(([names, purposes]) =>
        names.map((name, i) => ({ name, purpose: purposes[i] })),
      ),
  },
);

describe('Services schema (homelab self-hosted services)', () => {
  it('parses successfully iff exactly the six named services with valid purposes (Property 11)', () => {
    fc.assert(
      fc.property(candidateArb, (candidate) => {
        const result = Services.safeParse(candidate);
        expect(result.success).toBe(isValidServices(candidate));
      }),
      { numRuns: 300 },
    );
  });

  it('accepts the exact six services (any permutation)', () => {
    const valid = [
      { name: 'WireGuard', purpose: 'VPN' },
      { name: 'Jellyfin', purpose: 'Media' },
      { name: 'qBittorrent', purpose: 'Torrents' },
      { name: 'Seafile', purpose: 'Files' },
      { name: 'Immich', purpose: 'Photos' },
      { name: 'Vaultwarden', purpose: 'Passwords' },
    ];
    expect(Services.safeParse(valid).success).toBe(true);
  });

  it('rejects a duplicated service (missing one of the six)', () => {
    const dup = [
      { name: 'Jellyfin', purpose: 'Media' },
      { name: 'Jellyfin', purpose: 'Media again' },
      { name: 'Seafile', purpose: 'Files' },
      { name: 'qBittorrent', purpose: 'Torrents' },
      { name: 'WireGuard', purpose: 'VPN' },
      { name: 'Vaultwarden', purpose: 'Passwords' },
    ];
    expect(Services.safeParse(dup).success).toBe(false);
  });

  it('rejects wrong array lengths', () => {
    const five = SERVICES.slice(0, 5).map((name) => ({ name, purpose: 'p' }));
    const seven = [
      ...SERVICES.map((name) => ({ name, purpose: 'p' })),
      { name: 'Jellyfin', purpose: 'extra' },
    ];
    expect(Services.safeParse(five).success).toBe(false);
    expect(Services.safeParse(seven).success).toBe(false);
  });

  it('rejects purpose of length 0 or greater than 280', () => {
    const build = (purpose: string) =>
      SERVICES.map((name) => ({
        name,
        purpose: name === 'Jellyfin' ? purpose : 'ok',
      }));
    expect(Services.safeParse(build('')).success).toBe(false);
    expect(Services.safeParse(build('x'.repeat(281))).success).toBe(false);
    expect(Services.safeParse(build('x'.repeat(280))).success).toBe(true);
  });
});
