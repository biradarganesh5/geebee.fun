# geebee.fun

Personal portfolio website built with [Astro](https://astro.build/), React islands, and Tailwind CSS. The site is static-first: pages render to HTML at build time, and React only hydrates the interactive regions (hero hotspots, stat counters, navigation, image compare slider, theme toggle).

## Tech stack

- **Astro 4** — static site output (`output: 'static'`)
- **React 18** — interactive islands via `@astrojs/react`
- **Tailwind CSS 3** — responsive styling and motion-reduce variants
- **GSAP** — animations
- **Zod** — content schema validation
- **Vitest** — unit and content-validation tests
- **Playwright** — cross-device e2e tests

## Getting started

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

To expose the server on your local network:

```bash
npm run dev -- --host
```

The site runs at http://localhost:4321/.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Astro dev server |
| `npm run build` | Validate content, type-check, and build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run unit tests with Vitest |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run validate:content` | Validate content modules against their Zod schemas |

## Project structure

```
public/            Static assets (images, favicon)
scripts/           Build helpers (e.g. hero asset generation)
src/
  components/      Astro components + React islands
  content/         Typed, schema-validated content modules
  pages/           Astro routes
tests/             Unit and e2e tests
```

## Content

Page content lives in `src/content` as typed modules, each validated by a Zod schema at build time. `npm run build` runs content validation and `astro check` before producing the static output in `dist/`.
