import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0f172a', card: '#1e293b', border: '#334155' },
        buy: '#22c55e',
        sell: '#ef4444',
        hold: '#eab308',
      },
    },
  },
  plugins: [],
};

export default config;
