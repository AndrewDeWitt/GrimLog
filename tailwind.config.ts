/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        'shimmer': 'shimmer 2s infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      colors: {
        'mechanicus-black': '#0a0a0a',
        'mechanicus-darkRed': '#2a0a0a',
        'mechanicus-red': '#8b0000',
        'mechanicus-brass': '#b8860b',
        'mechanicus-darkBrass': '#704f00',
        'mechanicus-steel': '#4a4a4a',
        'mechanicus-lightSteel': '#a0a0a0',
        'grimlog-black': '#0a0a0a',
        'grimlog-darkGray': '#1a1a1a',
        'grimlog-gray': '#2b2b2b',
        'grimlog-steel': '#4a4a4a',
        'grimlog-light-steel': '#b8b8b8',
        'grimlog-orange': '#ff6b00',
        'grimlog-amber': '#d4a04c',
        'grimlog-green': '#a8c5a0',
        'grimlog-dark-green': '#6b9e78',
        'grimlog-red': '#b84a4a',
        'grimlog-dark-red': '#784a4a',
        // Light Slate Theme
        'grimlog-slate': '#e8e8e8',
        'grimlog-slate-light': '#f0f0f0',
        'grimlog-slate-dark': '#d0d0d0',
        // Defender (Green) - Solid, readable sage
        'grimlog-defender-bg': '#a8c8a8',
        'grimlog-defender-bg-dark': '#98b898',
        'grimlog-defender-border': '#3a5a3a',
        'grimlog-defender-accent': '#2a4a2a',
        'grimlog-defender-text': '#0a1a0a',
        // Attacker (Red) - Solid, readable crimson
        'grimlog-attacker-bg': '#c8a8a8',
        'grimlog-attacker-bg-dark': '#b89898',
        'grimlog-attacker-border': '#5a2a2a',
        'grimlog-attacker-accent': '#4a1a1a',
        'grimlog-attacker-text': '#1a0a0a',
      },
    },
  },
};

