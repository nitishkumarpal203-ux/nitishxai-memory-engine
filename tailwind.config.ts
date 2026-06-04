import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        mist: "#f4f7fb",
        line: "#dce3ef",
        pine: "#0f766e",
        coral: "#f9735b",
        amber: "#f4b63f"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(23, 32, 51, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
