// @vitest-environment node
//
// Runs in the node environment (not jsdom): the Astro Container API renders the
// component to an HTML string server-side, so no DOM is required, and jsdom's
// TextEncoder shim otherwise breaks esbuild's Uint8Array invariant during the
// .astro compile step.
import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import SocialLinks from './SocialLinks.astro';
import { profile } from '../content/profile';

/**
 * Unit tests for SocialLinks.astro.
 *
 * Renders the component to an HTML string with Astro's Container API and
 * asserts against the markup. Covers: reading profile.socials, the
 * filterNavbar prop, external vs mailto link behavior, accessibility
 * (aria-label + title), theme-token colors, and the per-social inline icons.
 */
describe('SocialLinks', () => {
  const render = (props: Record<string, unknown> = {}) =>
    AstroContainer.create().then((c) =>
      c.renderToString(SocialLinks, { props }),
    );

  it('renders a link for every social in profile.socials by default', async () => {
    const html = await render();
    for (const social of profile.socials) {
      expect(html).toContain(`href="${social.url}"`);
      expect(html).toContain(`aria-label="${social.name}"`);
      expect(html).toContain(`title="${social.name}"`);
    }
    const linkCount = (html.match(/<a\b/g) ?? []).length;
    expect(linkCount).toBe(profile.socials.length);
  });

  it('shows only navbar socials when filterNavbar is true', async () => {
    const html = await render({ filterNavbar: true });
    const expected = profile.socials.filter((s) => s.navbar);
    const linkCount = (html.match(/<a\b/g) ?? []).length;
    expect(linkCount).toBe(expected.length);
    for (const social of expected) {
      expect(html).toContain(`href="${social.url}"`);
    }
  });

  it('opens http(s) links in a new tab with rel=noopener; mailto stays in-page', async () => {
    const html = await render();

    // The GitHub (http) link opens in a new tab safely.
    const githubTag = html.match(/<a\b[^>]*href="https:\/\/github\.com[^"]*"[^>]*>/i);
    expect(githubTag).not.toBeNull();
    expect(githubTag![0]).toMatch(/target="_blank"/);
    expect(githubTag![0]).toMatch(/rel="noopener noreferrer"/);

    // The mailto link stays in-page (no target / rel).
    const mailTag = html.match(/<a\b[^>]*href="mailto:[^"]*"[^>]*>/i);
    expect(mailTag).not.toBeNull();
    expect(mailTag![0]).not.toMatch(/target=/);
    expect(mailTag![0]).not.toMatch(/rel=/);
  });

  it('uses theme-token colors on the links', async () => {
    const html = await render();
    expect(html).toMatch(/text-muted-foreground/);
    expect(html).toMatch(/hover:text-foreground/);
  });

  it('renders 18px currentColor inline SVG icons for each social', async () => {
    const html = await render();
    const svgCount = (html.match(/<svg\b/g) ?? []).length;
    expect(svgCount).toBe(profile.socials.length);
    // Icons are 18px and paint in currentColor (inherit the link color).
    expect(html).toMatch(/width="18"/);
    expect(html).toMatch(/height="18"/);
    expect(html).toMatch(/currentColor/);
    // Decorative icons are hidden from assistive tech.
    expect(html).toMatch(/aria-hidden="true"/);
  });

  it('forwards an extra class onto the container', async () => {
    const html = await render({ class: 'custom-social-class' });
    expect(html).toContain('custom-social-class');
  });
});
