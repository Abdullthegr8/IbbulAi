/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ibbu: { DEFAULT: '#1A6B1A', dark: '#155715', light: '#e8f5e8', mid: '#c8e6c8' },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
      transitionDuration: { 250: '250ms' },
      keyframes: {
        msgSlideIn:   { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:       { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:      { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        typingBounce: { '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.4' }, '30%': { transform: 'translateY(-4px)', opacity: '1' } },
      },
      animation: {
        msgSlideIn:   'msgSlideIn 200ms ease-out',
        fadeIn:       'fadeIn 200ms ease-out',
        slideUp:      'slideUp 250ms ease-out',
        typingBounce: 'typingBounce 1.2s infinite',
      },
    },
  },
  plugins: [],
}
