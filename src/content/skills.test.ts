import { describe, it, expect } from 'vitest';
import { Skills, skills } from './skills';

describe('skills content', () => {
  it('parses the seed skills cleanly', () => {
    expect(() => Skills.parse(skills)).not.toThrow();
  });

  it('is non-empty and free of duplicates', () => {
    expect(skills.length).toBeGreaterThan(0);
    expect(new Set(skills).size).toBe(skills.length);
  });

  it('rejects an empty list', () => {
    expect(Skills.safeParse([]).success).toBe(false);
  });

  it('rejects duplicate entries', () => {
    expect(Skills.safeParse(['AWS', 'AWS']).success).toBe(false);
  });

  it('rejects empty labels', () => {
    expect(Skills.safeParse(['AWS', '']).success).toBe(false);
  });
});
