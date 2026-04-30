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
        },
        app: {
          DEFAULT: '#F7F9FC',
          card: '#FFFFFF',
          active: '#EAF4FF',
          muted: '#5B6B7A',
          border: '#E5E7EB',
          softBorder: '#C7DAF2'
        },
        brand: {
          DEFAULT: '#005EB8',
          secondary: '#1565C0'
        },
        cta: {
          DEFAULT: '#F9B51B'
        }
      },
      borderRadius: {
        lg: '0.625rem',
        xl: '0.875rem',
        full: '9999px'
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'sans-serif'],
        body: ['var(--font-manrope)', 'sans-serif']
      },
      boxShadow: {
        soft: '0 10px 20px -18px rgba(6, 33, 63, 0.3)',
        panel: '0 16px 32px -28px rgba(5, 30, 58, 0.34)'
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
