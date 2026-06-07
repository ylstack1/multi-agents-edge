/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'hub-dark': '#0f0f0f',
        'hub-card': '#1a1a2e',
        'hub-surface': '#16213e',
        'hub-accent': '#0f3460',
        'hub-highlight': '#533483',
        'hub-text': '#e0e0e0',
        'hub-text-secondary': '#a0a0b0',
        'hub-border': '#2a2a3e',
        'hub-success': '#4caf50',
        'hub-error': '#f44336',
        'hub-warning': '#ff9800',
      },
      fontFamily: {
        mono: ['ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};