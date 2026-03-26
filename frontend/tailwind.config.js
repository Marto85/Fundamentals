/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body:    ['DM Sans', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bg:      '#05080F',
        surface: '#0C1120',
        card:    '#101828',
        border:  '#1E2D40',
        gold:    '#F59E0B',
        emerald: '#10B981',
        rose:    '#F43F5E',
        sky:     '#38BDF8',
        muted:   '#64748B',
        text:    '#E2E8F0',
        subtle:  '#94A3B8',
      },
    },
  },
  plugins: [],
}
