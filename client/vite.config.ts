import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Keep index.html out of the HTTP cache so a phone that visited an earlier
// build always picks up the latest bundle after a hard refresh.
function noCacheHtml(): Plugin {
  const headers = (req: { url?: string }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    if (req.url === "/" || req.url.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-store");
    }
    next();
  };
  return {
    name: "no-cache-html",
    configureServer(server) {
      server.middlewares.use(headers);
    },
    configurePreviewServer(server) {
      server.middlewares.use(headers);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), noCacheHtml()],
  server: {
    port: 5173,
    // Vite rejects unknown Host headers by default; allow the random
    // *.trycloudflare.com hostnames that `bun run online` produces.
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": "http://localhost:3000",
      "/media": "http://localhost:8888", // HLS via MediaMTX
      "/ws": { target: "http://localhost:3000", ws: true }, // live-status bus
      "/uploads": "http://localhost:3000", // uploaded logos/images
    },
  },
  // `bun run start` (vite preview) serves the production build: the same
  // same-origin proxies keep /api, /ws, /media and /uploads working even
  // though the frontend is now static HTML/assets rather than the dev server.
  preview: {
    port: 4173,
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": "http://localhost:3000",
      "/media": "http://localhost:8888",
      "/ws": { target: "http://localhost:3000", ws: true },
      "/uploads": "http://localhost:3000",
    },
  },
});
