/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Existing UPSC tokens (preserved) ──────────────────────
        primary: {
          DEFAULT: '#1E3A8A',
          hover:   '#1D4ED8',
          light:   '#EFF6FF',
          dark:    '#1E293B',
        },
        accent: {
          DEFAULT: '#2563EB',
          muted:   '#60A5FA',
        },
        surface: {
          bg:     '#F8FAFC',
          card:   '#FFFFFF',
          border: '#E2E8F0',
        },
        body: {
          text:      '#0F172A',
          secondary: '#64748B',
        },
        status: {
          success: '#16A34A',
          error:   '#DC2626',
          warning: '#D97706',
          info:    '#0284C7',
        },

        // ── TNPSC Command Center tokens ────────────────────────────
        tnpsc: {
          // Sidebar / shell
          sidebar:       '#0D1117',   // near-black navy
          'sidebar-item':'#161B22',   // hover state
          'sidebar-text': '#8B949E',  // muted text
          'sidebar-active': '#635BFF',

          // Main brand
          brand:         '#635BFF',   // primary purple/indigo
          'brand-hover': '#7C75FF',
          'brand-light': '#EEF2FF',
          'brand-dark':  '#4338CA',

          // Surface
          shell:         '#0D1117',   // page bg when sidebar visible
          card:          '#161B22',   // dark card
          'card-border': '#21262D',   // dark card border

          // Status
          active:  '#238636',  // green badge
          closed:  '#6E7681',  // grey badge
          upcoming:'#1F6FEB',  // blue badge
          results: '#A371F7',  // purple badge
        },
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },

      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(15,23,42,0.05), 0 1px 2px -1px rgba(15,23,42,0.05)',
        'card':   '0 4px 6px -1px rgba(15,23,42,0.05), 0 2px 4px -2px rgba(15,23,42,0.05)',
        'modal':  '0 20px 25px -5px rgba(15,23,42,0.1), 0 8px 10px -6px rgba(15,23,42,0.1)',
        'brand':  '0 4px 14px 0 rgba(99,91,255,0.3)',
        'glow':   '0 0 20px rgba(99,91,255,0.15)',
      },

      keyframes: {
        'slide-in-right': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',     opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateX(100%) scale(0.9)' },
          to:   { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.16,1,0.3,1)',
        'slide-in-left':  'slide-in-left 0.3s cubic-bezier(0.16,1,0.3,1)',
        'fade-in':        'fade-in 0.25s ease-out',
        'scale-in':       'scale-in 0.2s cubic-bezier(0.16,1,0.3,1)',
        'toast-in':       'toast-in 0.35s cubic-bezier(0.16,1,0.3,1)',
        'spin-slow':      'spin-slow 2s linear infinite',
      },
    },
  },
  plugins: [],
}
