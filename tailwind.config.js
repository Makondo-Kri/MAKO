/** Tiny Crowd design tokens. Keep UI colors restrained — the toys bring the color. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1E1B2E', soft: '#4A4560', mute: '#6F6984', faint: '#A39DB3' },
        cream: { DEFAULT: '#F7F2EA', deep: '#EFE7DA' },
        paper: '#FFFDF9',
        line: '#E6DED1',
        coral: { DEFAULT: '#FF6B4A', deep: '#E5512F', soft: '#FFE3DA' },
        mint: { DEFAULT: '#3FBF8F', soft: '#DDF5EA', deep: '#1F8A62' },
        lilac: { DEFAULT: '#8C6CF0', soft: '#ECE6FF', deep: '#5A3FC0' },
        butter: { DEFAULT: '#F7D154', soft: '#FFF5D1' },
        danger: { DEFAULT: '#D93A3A', soft: '#FDE4E4' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', 'system-ui', 'sans-serif'],
        sans: ['"Inter Variable"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        // Type scale: 12 / 14 / 16 / 18 / 22 / 28 / 36 / 48
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.6rem' }],
        xl: ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        '2xl': ['1.75rem', { lineHeight: '2.1rem', letterSpacing: '-0.02em' }],
        '3xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.025em' }],
        '4xl': ['3rem', { lineHeight: '3.1rem', letterSpacing: '-0.03em' }],
      },
      boxShadow: {
        card: '0 1px 0 rgba(30,27,46,0.04), 0 8px 24px -8px rgba(30,27,46,0.18)',
        float: '0 2px 0 rgba(30,27,46,0.05), 0 18px 40px -12px rgba(30,27,46,0.30)',
        press: 'inset 0 -3px 0 rgba(0,0,0,0.18)',
      },
      borderRadius: { '4xl': '2rem' },
      keyframes: {
        rise: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { '0%': { opacity: 0, transform: 'scale(.9)' }, '60%': { transform: 'scale(1.03)' }, '100%': { opacity: 1, transform: 'none' } },
        floatUp: { '0%': { opacity: 0, transform: 'translateY(0) scale(.6)' }, '15%': { opacity: 1, transform: 'translateY(-10px) scale(1.1)' }, '100%': { opacity: 0, transform: 'translateY(-70px) scale(1)' } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgba(255,107,74,.45)' }, '100%': { boxShadow: '0 0 0 12px rgba(255,107,74,0)' } },
      },
      animation: {
        rise: 'rise .35s cubic-bezier(.2,.8,.2,1) both',
        pop: 'pop .35s cubic-bezier(.2,.8,.2,1) both',
        floatUp: 'floatUp 1.8s ease-out forwards',
        pulseRing: 'pulseRing 1.4s ease-out infinite',
      },
    },
  },
  plugins: [],
};
