import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/media": "http://localhost:8888", // HLS via MediaMTX
      "/ws": { target: "http://localhost:3000", ws: true }, // live-status bus
      "/uploads": "http://localhost:3000", // uploaded logos/images
    },
  },
});
