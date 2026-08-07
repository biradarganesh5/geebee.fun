// @vitest-environment node
// Astro's Container API renders through esbuild, which requires a real Node
// TextEncoder. jsdom's TextEncoder breaks esbuild's Uint8Array invariant, so
// this content-presence suite runs in the Node environment (it asserts on the
// rendered HTML string and needs no DOM).
import { describe, it, expect, beforeAll } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import reactRenderer from '@astrojs/react/server.js';
import HomelabSection from './HomelabSection.astro';
import { homelabComponents, services } from '../content/homelab';

/**
 * Unit tests for homelab content presence (Task 11.2).
 *
 * Renders HomelabSection.astro through Astro's Container API and asserts that
 * every required hardware component and all six self-hosted services (each
 * with its purpose text) appear in the rendered HTML.
 *
 * Covers Req 4.1 (TrueNAS storage server), Req 4.2 (mini PC cluster on a
 * 4-port gigabit switch), Req 4.3 (i5 master node + worker mini PCs running
 * k3s and Proxmox), and Req 4.4 (the exact six services with purposes).
 */
describe('HomelabSection content presence', () => {
  let html: string;

  beforeAll(async () => {
    const container = await AstroContainer.create();
    // HomelabSection embeds the ImageCompareSlider React island (client:visible),
    // so the container needs the React renderer registered to render it.
    container.addServerRenderer({ name: '@astrojs/react', renderer: reactRenderer });
    container.addClientRenderer({
      name: '@astrojs/react',
      entrypoint: '@astrojs/react/client.js',
    });
    html = await container.renderToString(HomelabSection);
  });

  // --- Req 4.1 / 4.2 / 4.3: hardware components render (titles + descriptions) ---

  it('renders every homelab hardware component title and description (Req 4.1–4.3)', () => {
    for (const component of homelabComponents) {
      expect(html).toContain(component.title);
      expect(html).toContain(component.description);
    }
  });

  it('describes the TrueNAS storage server (Req 4.1)', () => {
    expect(html).toContain('TrueNAS');
    expect(html.toLowerCase()).toContain('storage');
  });

  it('describes the mini PC cluster on a 4-port gigabit switch (Req 4.2)', () => {
    expect(html.toLowerCase()).toContain('mini pc');
    expect(html.toLowerCase()).toContain('cluster');
    expect(html.toLowerCase()).toContain('4-port gigabit switch');
  });

  it('describes the i5 master node + worker mini PCs running k3s and Proxmox (Req 4.3)', () => {
    const lower = html.toLowerCase();
    expect(lower).toContain('master k3s node');
    expect(lower).toContain('worker node');
    expect(lower).toContain('k3s');
    expect(lower).toContain('proxmox');
  });

  // --- Req 4.4: exactly the six services, each with its purpose text ---

  const expectedServices = [
    'Jellyfin',
    'Immich',
    'Seafile',
    'qBittorrent',
    'WireGuard',
    'Vaultwarden',
  ] as const;

  it('renders all six self-hosted services (Req 4.4)', () => {
    for (const name of expectedServices) {
      expect(html).toContain(name);
    }
  });

  it('renders each service with its purpose text (Req 4.4)', () => {
    for (const service of services) {
      expect(html).toContain(service.name);
      expect(html).toContain(service.purpose);
    }
  });

  it('lists exactly the six named services (Req 4.4)', () => {
    const rendered = expectedServices.filter((name) => html.includes(name));
    expect(rendered).toHaveLength(6);
    expect(services.map((s) => s.name).sort()).toEqual(
      [...expectedServices].sort(),
    );
  });
});
