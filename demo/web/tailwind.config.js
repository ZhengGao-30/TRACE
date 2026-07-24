/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Geist for UI; CJK falls through to system premium faces.
        sans: ['Geist Sans', 'Plus Jakarta Sans Variable', 'PingFang SC',
               'Microsoft YaHei', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans Variable', 'Geist Sans', 'PingFang SC',
                  'Microsoft YaHei', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      colors: {
        // L1 = indigo (selection channel), L2 = violet (tally channel)
        l1: { 50: '#eef2ff', 100: '#e0e7ff', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' },
        l2: { 50: '#f5f3ff', 100: '#ede9fe', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9' },
        // warm off-white canvas (Soft Structuralism), not flat #fff
        canvas: '#f6f7f9',
      },
      borderRadius: {
        // squircle scale for the double-bezel; inner = outer - shell padding
        shell: '1.75rem',
        core: 'calc(1.75rem - 0.375rem)',
      },
      boxShadow: {
        // soft, highly diffused ambient shadows — no harsh dark drops
        card: '0 1px 2px rgba(15,23,42,.03), 0 12px 32px -16px rgba(15,23,42,.14)',
        lift: '0 2px 6px rgba(15,23,42,.05), 0 24px 60px -28px rgba(15,23,42,.22)',
        // inner top highlight — the "machined" look on a core surface
        core: 'inset 0 1px 1.5px rgba(255,255,255,.9), inset 0 -1px 1px rgba(15,23,42,.03)',
      },
      transitionTimingFunction: {
        // the "fluid mass" curve from the skill — replaces linear / ease-in-out
        fluid: 'cubic-bezier(0.32, 0.72, 0, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(99,102,241,.4)' },
          '70%': { boxShadow: '0 0 0 10px rgba(99,102,241,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(99,102,241,0)' },
        },
        floatUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)', filter: 'blur(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 1.8s ease-out infinite',
        floatUp: 'floatUp .7s cubic-bezier(0.32,0.72,0,1) both',
      },
    },
  },
  plugins: [],
}
