/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#09090b',
          card: '#121214',
          hover: '#1a1a1e',
          active: '#27272a',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          glow: 'rgba(168, 85, 247, 0.4)',
        },
        jadu: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#9333ea',
          800: '#7e22ce',
          900: '#581c87',
          glow: '#d946ef',
        },
        accent: {
          emerald: '#10b981',
          violet: '#a855f7',
          rose: '#f43f5e',
          amber: '#f59e0b',
          fuchsia: '#d946ef',
          orange: '#f97316',
          gold: '#eab308',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'premium': '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        'glow-purple': '0 0 20px rgba(168, 85, 247, 0.25), 0 0 40px rgba(236, 72, 153, 0.1)',
        'glow-emerald': '0 0 15px rgba(16, 185, 129, 0.25)',
        'glow-brand': '0 0 25px rgba(217, 70, 239, 0.3), 0 0 50px rgba(236, 72, 153, 0.15)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #7c3aed 0%, #db2777 40%, #f97316 70%, #eab308 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(219, 39, 119, 0.1) 40%, rgba(249, 115, 22, 0.08) 70%, rgba(234, 179, 8, 0.05) 100%)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'shimmer': 'shimmer 2.5s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 0.6, transform: 'scale(1)' },
          '50%': { opacity: 1, transform: 'scale(1.02)' },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      }
    },
  },
  plugins: [],
}
