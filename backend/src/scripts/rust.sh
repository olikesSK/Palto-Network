#!/bin/bash
echo "Rust Dedicated Server"
echo "SteamCMD: Checking for update..."
sleep 1
echo "Rust server version: 2000.0"
sleep 0.5
echo "Initializing server..."
sleep 1
echo "Setting up Oxide..."
sleep 0.5
echo "Loading plugins..."
sleep 1
echo "Server is ready. Hosting on port ${SERVER_PORT:-28015}"
echo "Server Name: ${SERVER_NAME:-Palto-Network Rust}"

background() {
  local msgs=(
    "Player connected (0/100)"
    "Autosave: World saved"
    "GC Collection: 42ms"
    "Server FPS: $(( RANDOM % 10 + 55 ))"
    "Antihack: Monitoring active"
  )
  while true; do
    sleep $(( RANDOM % 30 + 15 ))
    echo "[$(date '+%H:%M:%S')] ${msgs[RANDOM % ${#msgs[@]}]}"
  done
}
background &
BG_PID=$!

while IFS= read -r cmd; do
  case "$cmd" in
    quit|stop)
      kill $BG_PID 2>/dev/null
      echo "Server shutting down..."
      sleep 0.5
      echo "World saved. Goodbye."
      exit 0 ;;
    save)
      echo "Saving world..." && sleep 0.3 && echo "World saved successfully." ;;
    players)
      echo "Players online: 0/100" ;;
    "")  ;;
    *)
      echo "Command executed: $cmd" ;;
  esac
done
kill $BG_PID 2>/dev/null
