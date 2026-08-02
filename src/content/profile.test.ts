import { describe, it, expect } from 'vitest';
import { ProfileSchema, SocialLink, profile } from './profile';

describe('profile content', () => {
  it('parses the seed profile cleanly', () => {
    expect(() => ProfileSchema.parse(profile)).not.toThrow();
  });

  it('fixes name and initials', () => {
    expect(profile.name).toBe('Ganesh Biradar');
    expect(profile.initials).toBe('GB');
  });

  it('uses an ISO birthday and a valid email', () => {
    expect(profile.birthday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(profile.email).toBe('biradarganesh5@gmail.com');
  });

  it('carries at least one social link, all dock-flagged', () => {
    expect(profile.socials.length).toBeGreaterThan(0);
    for (const s of profile.socials) {
      expect(typeof s.navbar).toBe('boolean');
    }
  });

  it('rejects a malformed birthday', () => {
    const bad = { ...profile, birthday: '22-08-1999' };
    expect(ProfileSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const bad = { ...profile, email: 'not-an-email' };
    expect(ProfileSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts http(s) and mailto social urls but rejects others', () => {
    expect(
      SocialLink.safeParse({ name: 'x', url: 'https://a.b', navbar: true })
        .success,
    ).toBe(true);
    expect(
      SocialLink.safeParse({ name: 'x', url: 'mailto:a@b.c', navbar: false })
        .success,
    ).toBe(true);
    expect(
      SocialLink.safeParse({ name: 'x', url: 'ftp://a.b', navbar: true })
        .success,
    ).toBe(false);
  });
});
