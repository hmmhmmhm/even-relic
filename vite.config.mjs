import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { relicDevApi } from "./server/dev-api.js";

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    hmr: false,
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [relicDevApi(), react()],
});
