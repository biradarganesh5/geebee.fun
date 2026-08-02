import { describe, it, expect } from 'vitest';
import { Education, education } from './education';

describe('education content', () => {
  it('parses the seed education cleanly', () => {
    expect(() => Education.parse(education)).not.toThrow();
  });

  it('has the Mumbai University entry', () => {
    expect(education).toHaveLength(1);
    const [entry] = education;
    expect(entry.school).toBe('Mumbai University');
    expect(entry.degree).toBe(
      'Bachelor of Engineering in Computer Engineering',
    );
    expect(entry.end).toBe('2022');
    expect(entry.detail).toBe('7.25/10.0 CGPA');
  });

  it('rejects an empty list', () => {
    expect(Education.safeParse([]).success).toBe(false);
  });

  it('rejects an entry missing the required end field', () => {
    expect(
      Education.safeParse([{ school: 'X', degree: 'Y' }]).success,
    ).toBe(false);
  });
});
