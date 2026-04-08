import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        cardForeground: 'hsl(var(--card-foreground))',
        border: 'hsl(var(--border))',
        ring: 'hsl(var(--ring))',
        muted: 'hsl(var(--muted))',
        mutedForeground: 'hsl(var(--muted-foreground))',
        primary: {
          DEFAULT: '#1565C0',
          dark: '#0A4C78',
          ocean: '#0A5672'
        },
        accent: {
          DEFAULT: '#F2B11B',
          foreground: '#0B1A2F'
        },
        surface: {
          DEFAULT: '#F8F7F4'
        }
      },
      borderRadius: {
        lg: '0.875rem',
        xl: '1.125rem',
        full: '9999px'
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'sans-serif'],
        body: ['var(--font-manrope)', 'sans-serif']
      },
      boxShadow: {
        soft: '0 12px 26px -20px rgba(6, 33, 63, 0.38)',
        panel: '0 18px 46px -34px rgba(5, 30, 58, 0.5)'
      },
      backgroundImage: {
        'hero-grid':
          'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)'
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        rise: 'rise 500ms ease-out forwards'
      }
    }
  },
  plugins: []
};

export default config;
