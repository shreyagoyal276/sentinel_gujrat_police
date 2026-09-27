/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Black backgrounds
        'cmd-bg':       '#05070A',
        'cmd-sidebar':  '#080B10',
        // Deep blue panels
        'cmd-panel':    '#0D1624',
        'cmd-panel2':   '#111C2D',
        'cmd-card':     '#162338',
        // Borders
        'cmd-border':   '#26364D',
        // Blue accents
        'cmd-blue':     '#2563EB',
        'cmd-blue-lt':  '#3B82F6',
        // Cream / text
        'cmd-cream':    '#F5EBDD',
        // Red / alerts
        'cmd-red':      '#DC2626',
        'cmd-red-lt':   '#EF4444',
        'cmd-red-bg':   '#3F1116',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'beacon': 'beacon 2s ease-in-out infinite',
        'alert-flash': 'alertFlash 1.5s ease-in-out infinite',
      },
      keyframes: {
        beacon: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(59,130,246,0.7)', transform: 'scale(0.95)' },
          '70%': { boxShadow: '0 0 0 8px rgba(59,130,246,0)', transform: 'scale(1)' },
        },
        alertFlash: {
          '0%, 100%': { borderColor: 'rgba(220,38,38,0.7)', backgroundColor: 'rgba(220,38,38,0.08)' },
          '50%': { borderColor: 'rgba(220,38,38,0.2)', backgroundColor: 'rgba(220,38,38,0.02)' },
        },
      },
    },
  },
  plugins: [],
}
