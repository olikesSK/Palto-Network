#!/bin/bash
echo "[$(date '+%H:%M:%S')] Starting server: ${SERVER_NAME:-Server}"
sleep 1
echo "[$(date '+%H:%M:%S')] Loading configuration..."
sleep 0.5
echo "[$(date '+%H:%M:%S')] Binding to port ${SERVER_PORT:-25565}"
sleep 0.5
echo "[$(date '+%H:%M:%S')] Server ready. Waiting for connections."

background() {
  while true; do
    sleep $(( RANDOM % 30 + 15 ))
    echo "[$(date '+%H:%M:%S')] Heartbeat OK - uptime $(( RANDOM % 3600 ))s"
  done
}
background &
BG_PID=$!

while IFS= read -r cmd; do
  case "$cmd" in
    stop|quit|exit)
      kill $BG_PID 2>/dev/null
      echo "[$(date '+%H:%M:%S')] Server shutting down..."
      sleep 0.3
      echo "[$(date '+%H:%M:%S')] Goodbye."
      exit 0 ;;
    "")  ;;
    *)
      echo "[$(date '+%H:%M:%S')] CMD: $cmd" ;;
  esac
done
kill $BG_PID 2>/dev/null
