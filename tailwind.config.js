/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Outfit', 'sans-serif'],
      },
      colors: {
        surface: {
          primary: 'rgb(var(--bg-primary))',
          secondary: 'rgb(var(--bg-secondary))',
          card: 'rgb(var(--bg-card))',
          'card-hover': 'rgb(var(--bg-card-hover))',
          elevated: 'rgb(var(--bg-elevated))',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent))',
          hover: 'rgb(var(--accent-hover))',
          muted: 'rgba(var(--accent), 0.15)',
        },
        txt: {
          primary: 'rgb(var(--text-primary))',
          secondary: 'rgb(var(--text-secondary))',
          muted: 'rgb(var(--text-muted))',
        },
      },
      borderColor: {
        subtle: 'rgba(var(--border-subtle), 0.06)',
        medium: 'rgba(var(--border-subtle), 0.1)',
        strong: 'rgba(var(--border-subtle), 0.16)',
      },
      boxShadow: {
        glow: '0 0 20px rgba(var(--accent), 0.15)',
        'glow-lg': '0 0 40px rgba(var(--accent), 0.2)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        card: '0 4px 30px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(var(--accent), 0.1)' },
          '50%': { boxShadow: '0 0 25px rgba(var(--accent), 0.2)' },
        },
      },
    },
  },
  plugins: [],
}
