#!/usr/bin/env bash
# Go live in seconds with a free Cloudflare quick tunnel (no account, no DNS).
#
# Serves the PRODUCTION build: the client is built once with `bun run build`
# and served by `vite preview` (bun run start, default :4173), which reuses the
# same same-origin proxies as the dev server (/api, /ws, /uploads, /media) so a
# single public https URL covers the whole app. The API runs on :3000 and
# MediaMTX as the media server.
#
# NOTE: processes are launched DIRECTLY instead of `bun run dev`, because that
# script runs `kill-ports.sh` first, whose `pkill -f 'concurrentl[y]'` matches
# the parent shell's own command line (it contains the word "concurrently") and
# SIGTERMs the whole stack.
#
# Usage:  bun run build && bash scripts/online.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="${TMPDIR:-/tmp}"
URL_FILE="$TMP/livestream-url.txt"
PID_FILE="$TMP/livestream-cloudflared.pid"
TUNNEL_LOG="$TMP/livestream-online.log"
SERVER_LOG="$TMP/livestream-server.log"
CLIENT_LOG="$TMP/livestream-client.log"
MEDIA_LOG="$TMP/livestream-media.log"

PREVIEW_PORT=4173

app_up() {
  curl -sf http://localhost:$PREVIEW_PORT >/dev/null 2>&1 && \
  curl -sf http://localhost:3000/health >/dev/null 2>&1
}

# 1. Start the stack if it isn't already up.
if app_up; then
  echo "✓ App already running on http://localhost:$PREVIEW_PORT"
else
  echo "▶ Clearing stale app ports…"
  bash "$ROOT/scripts/kill-ports.sh"

  echo "▶ Starting api…"
  (
    cd "$ROOT/server"
    setsid nohup bun --watch src/index.ts >"$SERVER_LOG" 2>&1 </dev/null &
  )

  echo "▶ Starting web (vite preview of the built client)…"
  (
    cd "$ROOT/client"
    setsid nohup bun run start >"$CLIENT_LOG" 2>&1 </dev/null &
  )

  echo "▶ Starting media (MediaMTX)…"
  (
    cd "$ROOT"
    setsid nohup mediamtx mediamtx/mediamtx.local.yml >"$MEDIA_LOG" 2>&1 </dev/null &
  )

  echo "  waiting for http://localhost:$PREVIEW_PORT …"
  ok=""
  for _ in $(seq 1 60); do
    if app_up; then ok=1; break; fi
    sleep 1
  done
  if [ -z "$ok" ]; then
    echo "✗ App did not come up on :$PREVIEW_PORT" >&2
    echo "  server logs: $SERVER_LOG" >&2
    echo "  client logs: $CLIENT_LOG" >&2
    echo "  media  logs: $MEDIA_LOG" >&2
    echo ""
    echo "  Hint: if :3000 answers /health but the preview has nothing to serve,"
    echo "  run:  bun run build" >&2
    exit 1
  fi
fi
echo "✓ App is running on http://localhost:$PREVIEW_PORT"

# 2. cloudflared present?
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "✗ cloudflared not found. Install it:" >&2
  echo "    brew install cloudflared        # macOS" >&2
  echo "    # Debian/Ubuntu: download the .deb from GitHub releases:" >&2
  echo "    https://github.com/cloudflare/cloudflared/releases/latest" >&2
  echo "  Full instructions: https://developers.cloudflare.com/cloudflared/quickstart/" >&2
  exit 1
fi

# 3. Reuse an existing tunnel only if it actually serves traffic.
#
# cloudflared can stay alive while its connection to the edge has died (e.g. the
# QUIC/UDP datagram path gets dropped by the network and it retries forever), so
# a live PID ≠ a working tunnel. Probe the saved URL, not just the process.
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null && [ -s "$URL_FILE" ]; then
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$(cat "$URL_FILE")" 2>/dev/null || true)"
  if [ "$code" = "200" ]; then
    echo "✓ Tunnel already running:"
    echo ""
    echo "   $(cat "$URL_FILE")"
    exit 0
  fi
  echo "✗ Tunnel is stale (URL returned '$code') — restarting cloudflared"
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  pkill -f 'cloudflare[d] tunnel --url' 2>/dev/null || true
  rm -f "$PID_FILE" "$URL_FILE"
  sleep 1
fi

# 4. Open a fresh quick tunnel to the built client (vite preview) on :4173.
echo "▶ Opening Cloudflare tunnel to :$PREVIEW_PORT …"
setsid nohup cloudflared tunnel --url http://localhost:$PREVIEW_PORT --no-autoupdate >"$TUNNEL_LOG" 2>&1 </dev/null &
echo $! > "$PID_FILE"

url=""
for _ in $(seq 1 45); do
  url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -n1 || true)"
  if [ -n "$url" ]; then break; fi
  sleep 1
done
if [ -z "$url" ]; then
  echo "✗ cloudflared didn't produce a URL — check $TUNNEL_LOG" >&2
  exit 1
fi
echo "$url" > "$URL_FILE"

# 5. Confirm the fresh tunnel actually routes before declaring victory.
up=""
for _ in $(seq 1 15); do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null || true)"
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 2
done

echo ""
echo "=============================================="
if [ -n "$up" ]; then
  echo "  APP IS ONLINE"
  echo ""
  echo "  $url"
  echo ""
  echo "  Share that link — viewers watch on HLS;"
  echo "  WebRTC (WHEP) is skipped by design and the"
  echo "  player falls back to HLS automatically."
else
  echo "  ⚠ APP ONLINE? — tunnel URL not answering yet:"
  echo ""
  echo "  $url"
  echo ""
  echo "  It usually needs a few more seconds to route; retry"
  echo "  this script if it stays down, or check $TUNNEL_LOG."
fi
echo "=============================================="
echo ""
echo "Stop the tunnel only:        kill \$(cat $PID_FILE)"
echo "Stop the app (restart-safe): bash $ROOT/scripts/kill-ports.sh"