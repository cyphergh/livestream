#!/usr/bin/env bash
# Kill whatever is currently bound to the app's ports so `bun run dev`
# restarts cleanly instead of failing with "address already in use".
#
# Order matters: kill by port first (catches every listener), then by precise
# process identity. We must NEVER `pkill -f 'concurrently'` or
# `pkill -f 'mediamtx'`, because `bun run dev` executes its script string via
# `sh -c "bun run kill:ports && concurrently … mediamtx …"` — that wrapper
# shell's own command line contains those words, so a broad pattern SIGTERMs
# our own parent and the whole stack dies. Match real paths/executables only.
set -u

TCP_PORTS="3000 5173 9997 8888 8889 1935 8554"
UDP_PORTS="8890 8189 8000 8001 8892 8893"

for p in $TCP_PORTS; do
  fuser -k "${p}/tcp" 2>/dev/null
done
for p in $UDP_PORTS; do
  fuser -k "${p}/udp" 2>/dev/null
done

# Willy-nilly `[b]un --watch` kill (the dev-script wrapper never contains this
# literal, and killing the watcher stops the backend from respawning itself).
pkill -f '[b]un --watch' 2>/dev/null
# Backend entrypoint directly, in case the watcher is already gone.
pkill -f 'src/index[.]ts' 2>/dev/null
# Vite, anchored to its real bin path (cannot appear in a shell one-liner).
pkill -f 'node_modules/vite/bin/vite[.]js' 2>/dev/null
# concurrently, anchored to its real bin path.
pkill -f 'concurrently/dist/bin/concurrently[.]js' 2>/dev/null

# MediaMTX: kill by real executable identity (/dev /proc/<pid>/exe matching
# `command -v mediamtx`) rather than by an argv string, so a wrapper shell
# whose command line merely mentions "mediamtx" is never touched.
MTX_BIN="$(command -v mediamtx 2>/dev/null || true)"
if [ -n "$MTX_BIN" ]; then
  for proc in /proc/[0-9]*; do
    p="${proc##*/}"
    [ "$p" = "$$" ] && continue
    if [ "/proc/$p/exe" -ef "$MTX_BIN" ]; then
      kill -9 "$p" 2>/dev/null
    fi
  done
fi

sleep 1
echo "Ports cleared."