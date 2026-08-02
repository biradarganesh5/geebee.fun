import { describe, it, expect } from 'vitest';
import { Projects, Project, projects } from './projects';

describe('projects content', () => {
  it('parses the seed projects cleanly', () => {
    expect(() => Projects.parse(projects)).not.toThrow();
  });

  it('contains the two real projects with tags', () => {
    const titles = projects.map((p) => p.title);
    expect(titles).toContain('AI-Driven Pipeline Failure Notifier');
    expect(titles).toContain('ECS to EKS Production Migration');
    for (const p of projects) {
      expect(p.tags.length).toBeGreaterThan(0);
      expect(p.dates).toBe('2025');
    }
  });

  it('rejects a project with an empty title', () => {
    expect(
      Project.safeParse({
        title: '',
        description: 'a'.repeat(30),
        dates: '2025',
        tags: [],
      }).success,
    ).toBe(false);
  });

  it('rejects a too-short description', () => {
    expect(
      Project.safeParse({
        title: 'X',
        description: 'short',
        dates: '2025',
        tags: [],
      }).success,
    ).toBe(false);
  });

  it('rejects an empty projects list', () => {
    expect(Projects.safeParse([]).success).toBe(false);
  });
});
