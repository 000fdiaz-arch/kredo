import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        kredo: {
          ink: "#172033",
          muted: "#667085",
          line: "#d9dee8",
          surface: "#f7f8fb",
          primary: "#1463ff",
          green: "#12805c",
          yellow: "#b7791f",
          red: "#c2413a",
        },
      },
      boxShadow: {
        soft: "0 10px 30px rgba(23, 32, 51, 0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
