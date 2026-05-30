/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Custom Forest Garden colors
        forest: {
          50: '#f0f7f4',
          100: '#d9ebe2',
          200: '#b3d7c5',
          300: '#7fb89e',
          400: '#4a9474',
          500: '#2d7457',
          600: '#1f5c45',
          700: '#184938',
          800: '#14392d',
          900: '#0f2e24',
        },
        golden: {
          50: '#fdfaf3',
          100: '#faf3e0',
          200: '#f5e6c1',
          300: '#efd49b',
          400: '#e6be6e',
          500: '#d4af37',
          600: '#b8942f',
          700: '#987828',
          800: '#7a5f24',
          900: '#634d20',
        },
        amber: {
          50: '#fdf8f3',
          100: '#f9ede0',
          200: '#f3d9c1',
          300: '#e6b88f',
          400: '#d4935b',
          500: '#c87f35',
          600: '#ad6829',
          700: '#8f5323',
          800: '#744421',
          900: '#5f381c',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        'art-deco': '0 4px 6px -1px rgba(212, 175, 55, 0.1), 0 2px 4px -1px rgba(212, 175, 55, 0.06)',
        'art-deco-lg': '0 10px 15px -3px rgba(212, 175, 55, 0.1), 0 4px 6px -2px rgba(212, 175, 55, 0.05)',
        'forest': '0 4px 6px -1px rgba(15, 81, 50, 0.1), 0 2px 4px -1px rgba(15, 81, 50, 0.06)',
        'forest-lg': '0 10px 15px -3px rgba(15, 81, 50, 0.1), 0 4px 6px -2px rgba(15, 81, 50, 0.05)',
      },
      backgroundImage: {
        'forest-pattern': 'linear-gradient(135deg, transparent 0%, transparent 48%, rgba(15, 81, 50, 0.02) 50%, transparent 52%, transparent 100%), linear-gradient(45deg, transparent 0%, transparent 48%, rgba(15, 81, 50, 0.02) 50%, transparent 52%, transparent 100%)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
