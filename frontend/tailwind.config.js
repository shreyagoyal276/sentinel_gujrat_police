/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Grounded neutral dark command backgrounds
        'cmd-bg':       '#0b0c0e',
        'cmd-sidebar':  '#101216',
        'cmd-panel':    '#14171d',
        'cmd-panel2':   '#191d24',
        'cmd-card':     '#1e232c',
        // Crisp neutral borders
        'cmd-border':   '#2c323c',
        'cmd-border-lt':'#3a424f',
        // Gujarat Police Maroon Brand Colors
        'maroon': {
          50:  '#fdf2f4',
          100: '#fce7eb',
          200: '#f9d2d9',
          300: '#f4aebb',
          400: '#ec7f93',
          500: '#de516e',
          600: '#c73252',
          700: '#a6243f',
          800: '#8c1f36',
          900: '#751e31',
          950: '#420b17',
        },
        'cmd-maroon':      '#751e31',
        'cmd-maroon-lt':   '#8c1f36',
        'cmd-maroon-dark': '#420b17',
        'cmd-maroon-bg':   '#22090e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'beacon': 'beacon 2s ease-in-out infinite',
      },
      keyframes: {
        beacon: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(140,31,54,0.7)', transform: 'scale(0.95)' },
          '70%': { boxShadow: '0 0 0 6px rgba(140,31,54,0)', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
