import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Landscape phones are wide enough for the md: layout but only ~390px tall.
      // Declared after the width screens, so short: wins where both apply.
      screens: {
        short: { raw: '(max-height: 520px)' },
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        border: 'hsl(var(--border))',
        ring: 'hsl(var(--ring))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        wood: {
          bg: '#804d2e',
          light: '#b3734a',
          dark: '#4d2813',
          ink: '#261309',
          text: '#f4e7c3',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
