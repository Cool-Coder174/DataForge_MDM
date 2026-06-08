/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter', '"Inter Variable"', 'system-ui', '-apple-system', '"Segoe UI"',
          'Roboto', 'Helvetica', 'Arial', 'sans-serif',
        ],
        mono: ['"JetBrains Mono"', '"Roboto Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Refined cool-neutral dark surfaces (Linear / Vercel / Datadog inspired).
        // `darkBorder` is intentionally aligned with zinc-800 so every border in
        // the app reads as one consistent hairline.
        canvas: '#0b0c0f',     // app background (near-black slate, not pure black)
        darkBg: '#0b0c0f',
        darkCard: '#141519',   // cards / sidebar / topbar (one step elevated)
        darkCard2: '#1c1e24',  // inputs / hover / nested surfaces
        darkBorder: '#26272b', // subtle but visible hairline (~zinc-800)
        // Primary / interactive accent (calm enterprise blue ramp).
        brand: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a',
        },
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        'card-dark': '0 1px 2px 0 rgb(0 0 0 / 0.4)',
        elevated: '0 4px 16px -2px rgb(0 0 0 / 0.12), 0 2px 6px -2px rgb(0 0 0 / 0.08)',
        panel: '-8px 0 24px -12px rgb(0 0 0 / 0.45)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.24s ease-out',
      },
    },
  },
  plugins: [],
}
