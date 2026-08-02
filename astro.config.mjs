// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// Astro 4 static-first configuration for the Portfolio_Site.
// React islands hydrate only interactive regions (hotspots, PC specs, nav).
// Tailwind provides responsive breakpoints and motion-reduce variants.
// https://astro.build/config
export default defineConfig({
  output: 'static',
  // Hide the dev-only toolbar/overlay that appears at the bottom of the page.
  devToolbar: {
    enabled: false,
  },
  integrations: [
    react(),
    tailwind({
      // We manage the base reset ourselves via global.css.
      applyBaseStyles: true,
    }),
  ],
});
