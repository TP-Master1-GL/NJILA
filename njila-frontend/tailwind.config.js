/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Palette NJILA extraite des maquettes ──────────────────────────────
        primary: {
          50:  "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",   // ← couleur principale
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },
        success: {
          50:  "#F0FDF4",
          500: "#22C55E",
          600: "#16A34A",
          700: "#15803D",
        },
        warning: {
          50:  "#FFFBEB",
          500: "#F59E0B",
          600: "#D97706",
        },
        danger: {
          50:  "#FEF2F2",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C",
        },
        njila: {
          bg:      "#F8FAFC",
          card:    "#FFFFFF",
          border:  "#E2E8F0",
          text:    "#0F172A",
          muted:   "#64748B",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)",
        lg:   "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
      },
    },
  },
  plugins: [],
};
