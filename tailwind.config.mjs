/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  // Theme switching uses a class on <html> (`.dark` / `.light`), set
  // synchronously by the no-flash init script in Layout.astro. Dark is the
  // default. This enables the `dark:` variant to key off that class.
  darkMode: 'class',
  theme: {
    // Breakpoints span the full 360px–2560px support range (Req 9.1).
    // 'xs' anchors the smallest supported phone width; '4xl' anchors the
    // largest supported desktop width.
    screens: {
      xs: '360px', // smallest supported viewport
      sm: '480px', // hero small/medium image tier boundary (Req 10.2)
      md: '768px', // navigation toggle -> inline links boundary (Req 9.3/9.4)
      lg: '1024px', // hero medium/large image tier boundary (Req 10.2)
      xl: '1280px',
      '2xl': '1536px',
      '3xl': '1920px',
      '4xl': '2560px', // largest supported viewport
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // Semantic theme colors backed by the CSS custom properties defined in
      // src/styles/global.css. Stored as space-separated RGB channels so the
      // `<alpha-value>` placeholder lets utilities like `bg-card/60` work. These
      // are added via `extend` so Tailwind's default palette (neutral-*, sky-*,
      // white, etc.) remains available for decorative accents.
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--muted-foreground) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        'card-foreground': 'rgb(var(--card-foreground) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
        'primary-foreground': 'rgb(var(--primary-foreground) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
      },
      // Reserve the hero's intrinsic aspect ratio (3000:3878, Req 1.2).
      aspectRatio: {
        hero: '3000 / 3878',
      },
    },
  },
  // Tailwind provides the `motion-reduce:` variant out of the box, which is
  // used to render final-state styles when prefers-reduced-motion is set
  // (Req 1.5, 3.5, 4.7, 8.2). Listing it here documents the reliance.
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [],
};
