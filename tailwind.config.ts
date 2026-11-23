import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        desk: {
          canvas: 'rgb(var(--bg-canvas) / <alpha-value>)',
          surface: 'rgb(var(--bg-surface) / <alpha-value>)',
          'surface-muted': 'rgb(var(--bg-surface-muted) / <alpha-value>)',
          hover: 'rgb(var(--bg-hover) / <alpha-value>)',
          border: 'rgb(var(--border-subtle) / <alpha-value>)',
          'border-strong': 'rgb(var(--border-strong) / <alpha-value>)',
          heading: 'rgb(var(--text-heading) / <alpha-value>)',
          body: 'rgb(var(--text-body) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
          primary: 'rgb(var(--primary) / <alpha-value>)',
          'primary-hover': 'rgb(var(--primary-hover) / <alpha-value>)',
          'primary-fg': 'rgb(var(--primary-fg) / <alpha-value>)',
          accent: 'rgb(var(--accent) / <alpha-value>)',
          'accent-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
          'accent-fg': 'rgb(var(--accent-fg) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
      },
      animation: {
        shake: 'shake 0.35s ease-in-out',
      },
    },
  },
  plugins: [],
};

export default config;
