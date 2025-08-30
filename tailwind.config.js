/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b1020',
        panel: '#121937',
        muted: '#8aa0ff',
        text: '#f3f6ff',
        accent: '#5ee6a8',
        danger: '#ff6b6b',
        card: '#0f1530',
      },
      backgroundImage: {
        'gradient-dark': 'linear-gradient(160deg, #0b1020, #0b1530 40%, #0a1130 70%)',
      }
    },
  },
  plugins: [],
}
