/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        criterio: {
          negro: '#0a0a0a',
          blanco: '#f5f5f0',
          gris: '#1a1a1a',
          gris2: '#2a2a2a',
          gris3: '#3a3a3a',
          acento: '#c8a96e',
          acento2: '#e8c98e',
          rojo: '#c0392b',
          verde: '#1a6b3a',
          texto: '#d0d0c8',
        }
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
