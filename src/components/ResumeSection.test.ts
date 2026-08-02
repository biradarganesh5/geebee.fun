// @vitest-environment node
//
// Runs in the node environment (not jsdom): the Astro Container API renders the
// component to an HTML string server-side, so no DOM is required, and jsdom's
// TextEncoder shim otherwise breaks esbuild's Uint8Array invariant during the
// .astro compile step.
import { describe, it, expect, beforeAll } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import ResumeSection from './ResumeSection.astro';
import { resumeContent } from '../content/resume';

/**
 * Unit tests for ResumeSection.astro (task 13.2).
 *
 * Renders the component to an HTML string with Astro's Container API and
 * asserts against the markup. Covers:
 * - Req 6.1: AWS-certified DevOps and Cloud Engineer headline / 3+ years.
 * - Req 6.3: the highlighted achievements are present.
 * - Req 6.5: narrative (non-tabular) layout — no <table>/tabular structure.
 * - Req 6.7: the "temporarily unavailable" fallback is server-rendered hidden
 *   so it can be revealed on resume-retrieval failure.
 */
describe('ResumeSection', () => {
  let html: string;

  beforeAll(async () => {
    const container = await AstroContainer.create();
    html = await container.renderToString(ResumeSection);
  });

  // The lead headline paragraph was intentionally removed from this section;
  // the AWS-certified DevOps summary now lives in the About section instead.
  it('does not render the resume headline lead paragraph', () => {
    expect(html).not.toContain(resumeContent.headline);
  });

  // The achievements highlight list was removed from this section (the key
  // metrics now live in the StatCounters row in the Experience section).
  it('does not render the achievements highlight list', () => {
    expect(html).not.toMatch(/resume__achievements/);
    for (const achievement of resumeContent.achievements) {
      expect(html).not.toContain(achievement);
    }
  });

  // Req 6.5 — narrative, non-tabular layout: no table/tabular column structure.
  it('renders a narrative layout with no tabular column structure', () => {
    expect(html).not.toMatch(/<table[\s>]/i);
    expect(html).not.toMatch(/<thead[\s>]/i);
    expect(html).not.toMatch(/<tbody[\s>]/i);
    expect(html).not.toMatch(/<tr[\s>]/i);
    expect(html).not.toMatch(/<td[\s>]/i);
    expect(html).not.toMatch(/<th[\s>]/i);
    // Employers render as prose ("<role> at <employer>") rather than columns.
    expect(html).toMatch(/at/);
    for (const job of resumeContent.employers) {
      expect(html).toContain(job.employer);
      expect(html).toContain(job.role);
    }
  });

  // The formal-resume link and its "temporarily unavailable" fallback were
  // removed from this section, so neither should appear in the markup.
  it('does not render the formal resume link or unavailable fallback', () => {
    expect(html).not.toMatch(/temporarily unavailable/i);
    expect(html).not.toMatch(/id="resume-formal-link"/i);
    expect(html).not.toMatch(/id="resume-unavailable"/i);
  });
});
