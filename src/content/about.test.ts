import { describe, it, expect } from 'vitest';
import { AboutSchema, aboutContent } from './about';

describe('about content', () => {
  it('parses the seed blurb cleanly', () => {
    expect(() => AboutSchema.parse(aboutContent)).not.toThrow();
  });

  it('is a concise, non-empty first-person blurb', () => {
    expect(aboutContent.aboutText.length).toBeGreaterThanOrEqual(20);
    expect(aboutContent.aboutText.length).toBeLessThanOrEqual(600);
    expect(aboutContent.aboutText).toMatch(/^I'm|^I /);
  });

  it('rejects an empty blurb', () => {
    expect(AboutSchema.safeParse({ aboutText: '' }).success).toBe(false);
  });

  it('rejects an over-long blurb', () => {
    expect(
      AboutSchema.safeParse({ aboutText: 'x'.repeat(601) }).success,
    ).toBe(false);
  });
});
