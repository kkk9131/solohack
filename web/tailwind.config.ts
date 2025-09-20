import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        hud: 'var(--hud)',
        neon: 'var(--neon)',
        glow: 'var(--glow)',
      },
      boxShadow: {
        glow: '0 0 20px var(--glow)',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 0 rgba(0,0,0,0)' },
          '50%': { boxShadow: '0 0 24px var(--glow)' },
        },
        typeCursor: {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        glowPulse: 'glowPulse 2s ease-in-out infinite',
        typeCursor: 'typeCursor 1s step-end infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;

