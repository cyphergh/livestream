# Go live online (free, no account, no DNS)

This stacks a **Cloudflare quick tunnel** in front of your local dev server.
One command gets the whole app a public `https://<random>.trycloudflare.com` URL.

## Why Cloudflare, not ngrok

- **No account / email / token** — `cloudflared` works instantly.
- **Unmetered bandwidth** on quick tunnels; ngrok's free tier caps at 1 GB/month,
  which a single live broadcast burns through in ~20 minutes.
- **WebSockets work**, so the live-status bus (`/ws`) keeps working.

## Prerequisites

- `bun` (from the repo root workspace)
- [`cloudflared`](https://developers.cloudflare.com/cloudflared/quickstart/)
  (`brew install cloudflared`, or grab the `.deb` from
  [GitHub releases](https://github.com/cloudflare/cloudflared/releases/latest))

## Quick start

```bash
bash scripts/online.sh
```

The script:

1. Starts the app (`bun run dev`: api + Vite + MediaMTX) if it isn't running.
2. Waits for `http://localhost:5173`.
3. Opens a tunnel and prints your public URL.

Because Vite already proxies `/api`, `/ws`, `/media` and `/uploads` same-origin
(`client/vite.config.ts`), the single tunnel URL covers the whole site — pages,
API, live WebSocket, and HLS video.

### Manually

```bash
bun run dev                                   # terminal 1
cloudflared tunnel --url http://localhost:5173  # terminal 2
```

## What works through the tunnel

- Browsing the full site, admin dashboard (non-streaming), CMS, EPG.
- **Watching live channels via HLS** — the player tries low-latency WHEP
  first, then falls back to HLS automatically (`ChannelPage.tsx`).

## What does NOT work through any HTTP tunnel

- **WebRTC media (WHEP low-latency viewing, WHIP studio publishing).** WebRTC
  media is UDP; ngrok/Cloudflare/Pinggy-style HTTP tunnels are TCP only. The
  app handles this gracefully (HLS fallback for viewers).
- **Browser Studio publishing** — same reason, plus it needs a secure context
  for camera/mic. Use real servers (see `docs/` → VPS deployment) for that.
- **OBS/RTMP ingest** — MediaMTX's RTMP port isn't exposed through the tunnel.

**Publishing while testing on the tunnel:** the simplest path is to verify with
the viewer side (channels already live via a local OBS push on the same LAN),
or move to the VPS setup once it's ready.

## Caveats

- The quick-tunnel URL **changes every time you restart** it.
- Quick tunnels are for demos/dev: no custom domain, rate-limited, tied to the
  machine running `cloudflared`.
- Viewer traffic on HLS goes through Cloudflare — a short worship stream is
  fine; heavy, long-running video should move to self-hosted/public-IP hosting.

## Stopping

```bash
kill $(cat /tmp/livestream-cloudflared.pid)   # stop tunnel only
bash scripts/kill-ports.sh                     # stop the app
```

## Next step: real WebRTC + high bandwidth

When the free VPS is ready, deploy the stack on it (Docker Compose for
Postgres + MediaMTX with `network_mode: host`, Bun backend, Caddy for TLS).
A public IP gives you real UDP: WHEP/WHIP work, Studio publishing works, OBS
can ingest via RTMP — no tunnels, no bandwidth caps.