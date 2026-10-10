import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        parchment: "#f7f4ec",
        ink: "#26231d",
        brass: "#9a6f2b",
        verdigris: "#28766b",
        oxblood: "#7d2b3a"
      }
    }
  },
  plugins: []
};

export default config;
