#!/usr/bin/env bash
# Kill whatever is currently bound to the app's ports so `bun run dev`
# restarts cleanly instead of failing with "address already in use".
set -u

TCP_PORTS="3000 5173 9997 8888 8889 1935 8554"
UDP_PORTS="8890 8189 8000 8001 8892 8893"

for p in $TCP_PORTS; do
  fuser -k "${p}/tcp" 2>/dev/null
done
for p in $UDP_PORTS; do
  fuser -k "${p}/udp" 2>/dev/null
done

# Fallback: kill stragglers by process name (bracket pattern avoids self-match).
pkill -f 'concurrentl[y]' 2>/dev/null
pkill -f '[m]ediamtx' 2>/dev/null
pkill -f '[v]ite' 2>/dev/null
pkill -f '[b]un --watch' 2>/dev/null
pkill -f 'src/index[.]ts' 2>/dev/null

sleep 1
echo "Ports cleared."