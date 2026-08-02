// @vitest-environment node
//
// Runs in the node environment (not jsdom): the Astro Container API renders the
// component to an HTML string server-side, so no DOM is required, and jsdom's
// TextEncoder shim otherwise breaks esbuild's Uint8Array invariant during the
// .astro compile step.
import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Avatar from './Avatar.astro';

/**
 * Unit tests for Avatar.astro.
 *
 * Renders the component to an HTML string with Astro's Container API and
 * asserts against the markup. Covers the circular avatar, the reserved box
 * (no layout shift), the initials fallback, and the image error-handling
 * contract (broken image hidden via `onerror` → initials revealed).
 */
describe('Avatar', () => {
  const render = (props: Record<string, unknown>) =>
    AstroContainer.create().then((c) => c.renderToString(Avatar, { props }));

  it('renders an <img> with the given src/alt and reserves the size box', async () => {
    const html = await render({
      src: '/images/avatar.jpg',
      alt: 'Ganesh Biradar',
      initials: 'GB',
      size: 112,
    });
    expect(html).toMatch(/<img\b/i);
    expect(html).toContain('src="/images/avatar.jpg"');
    expect(html).toContain('alt="Ganesh Biradar"');
    // Reserved box (no layout shift): width/height on both root style and img.
    expect(html).toMatch(/width:112px;height:112px/);
    expect(html).toMatch(/width="112"/);
    expect(html).toMatch(/height="112"/);
  });

  it('defaults to a 112px box when size is omitted', async () => {
    const html = await render({
      src: '/images/avatar.jpg',
      alt: 'a',
      initials: 'GB',
    });
    expect(html).toMatch(/width:112px;height:112px/);
  });

  it('is circular and uses the border/muted/foreground theme tokens', async () => {
    const html = await render({ src: '/x.jpg', alt: 'a', initials: 'GB' });
    expect(html).toMatch(/rounded-full/);
    expect(html).toMatch(/border-border/);
    expect(html).toMatch(/bg-muted/);
    expect(html).toMatch(/text-foreground/);
  });

  it('renders the initials fallback and wires the onerror image swap', async () => {
    const html = await render({ src: '/x.jpg', alt: 'a', initials: 'GB' });
    expect(html).toContain('GB');
    // The fallback contract: onerror toggles data-errored on the root so the
    // broken image is hidden (no broken-image icon) and initials show.
    expect(html).toMatch(/data-image-fallback/);
    expect(html).toMatch(/onerror=/);
    expect(html).toMatch(/data-errored/);
  });

  it('shows the initials cleanly with no <img> and pre-errored root when src is empty', async () => {
    const html = await render({ src: '', alt: 'a', initials: 'GB' });
    // No image is requested at all when there is no URL.
    expect(html).not.toMatch(/<img\b/i);
    // Root starts errored so the initials are shown immediately.
    expect(html).toMatch(/data-errored="true"/);
    expect(html).toContain('GB');
  });

  it('forwards an extra class onto the root element', async () => {
    const html = await render({
      src: '/x.jpg',
      alt: 'a',
      initials: 'GB',
      class: 'custom-avatar-class',
    });
    expect(html).toContain('custom-avatar-class');
  });
});
