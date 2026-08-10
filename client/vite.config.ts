import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://10.42.0.1:3000",
      "/media": "http://10.42.0.1:8888", // HLS via MediaMTX
      "/ws": { target: "http://10.42.0.1:3000", ws: true }, // live-status bus
      "/uploads": "http://10.42.0.1:3000", // uploaded logos/images
    },
  },
});
