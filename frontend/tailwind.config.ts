import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        artifact: {
          bg: "#0e0b07",
          fg: "#f0e8d5",
          card: "#1a1510",
          gold: "#c9a84c",
          secondary: "#2a2318",
          muted: "#9a8a6a",
        },
      },
      maxWidth: {
        phone: "480px",
      },
      animation: {
        radar: "radar 2s linear infinite",
        "radar-sweep": "radar-sweep 2s linear infinite",
        "scan-line": "scan-line 1.8s linear infinite",
      },
      keyframes: {
        radar: {
          "0%": { transform: "scale(0.5)", opacity: "1" },
          "100%": { transform: "scale(1.5)", opacity: "0" },
        },
        "radar-sweep": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "scan-line": {
          "0%, 100%": { top: "10%" },
          "50%": { top: "90%" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
