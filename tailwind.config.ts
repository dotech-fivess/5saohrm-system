import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand & semantic (theo design system 5Sao HRM)
        primary: { DEFAULT: "#2C68C9", press: "#2457A8", foreground: "#FFFFFF" },
        accent: { DEFAULT: "#F57F20", foreground: "#16345E" },
        brand: { DEFAULT: "#16345E", bar: "#9DB9EC" },
        success: "#2E7D32",
        warning: "#F9A825",
        danger: "#D32F2F",
        neutral: "#5B6B63",
        ink: "#16241D",
        // Surfaces
        app: "#F4F7F5",
        canvas: "#E7EBE9",
        surface: "#FFFFFF",
        panel: "#F8FAF9",
        divider: "#f0f3f1",
        muted: "#9aa8a1",
        // Tints (bg / border / text)
        tint: {
          blue: "#E7EEFB",
          warn: "#FEF4DC",
          danger: "#FBE7E7",
          success: "#E6F2E7",
        },
        "tint-bd": {
          blue: "#c2d6f3",
          warn: "#f6e6bd",
          danger: "#f3cccc",
          success: "#cfe6d1",
        },
        "tint-tx": {
          blue: "#2457A8",
          warn: "#a9791a",
          danger: "#b3261e",
          success: "#2E7D32",
        },
      },
      borderColor: {
        DEFAULT: "#E2E8E5",
        input: "#cdd6d1",
      },
      fontFamily: {
        sans: ["var(--font-roboto)", "system-ui", "sans-serif"],
        mono: ["var(--font-roboto-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "14px",
        btn: "10px",
        input: "10px",
        pill: "999px",
        phone: "30px",
      },
      boxShadow: {
        card: "0 8px 30px rgba(22,52,94,.1)",
        mobile: "0 8px 30px rgba(22,52,94,.18)",
        btn: "0 4px 12px rgba(44,104,201,.3)",
        modal: "0 8px 24px rgba(22,52,94,.12)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.4s infinite linear",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
