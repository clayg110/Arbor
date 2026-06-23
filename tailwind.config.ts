import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./components/**/*.{js,ts,jsx,tsx,mdx}", "./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        hairline: "var(--border)",
        ink: "var(--text)",
        muted: "var(--text-muted)",
        subtle: "var(--text-subtle)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontWeight: {
        normal: "400",
        medium: "500",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.35", transform: "scale(0.85)" },
        },
        "ping-dot": {
          "75%, 100%": { transform: "scale(2)", opacity: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.3s ease-in-out infinite",
        "ping-dot": "ping-dot 1.4s cubic-bezier(0,0,0.2,1) infinite",
        "fade-in": "fade-in 0.2s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in-up": "fade-in-up 0.25s cubic-bezier(0.16,1,0.3,1) both",
        "scale-in": "scale-in 0.16s cubic-bezier(0.16,1,0.3,1) both",
        "slide-down": "slide-down 0.16s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
