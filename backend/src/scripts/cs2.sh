#!/bin/bash
echo "Counter-Strike 2 Dedicated Server"
echo "Game: cs2  Map: de_dust2  MaxPlayers: 10"
sleep 1
echo "Loading game.dll..."
sleep 0.5
echo "NET: Server listening on 0.0.0.0:${SERVER_PORT:-27015}"
sleep 0.5
echo "Server is hibernating until there is a player."
echo "ConVarRef sv_hibernate_postgame_delay doesn't point to an existing ConVar"
echo "Connection to Steam servers successful."
echo "VAC enabled"

background() {
  local msgs=("Map cycle: de_inferno" "VAC: Checking player" "Stats updated" "Server ping: $(( RANDOM % 10 + 2 ))ms")
  while true; do
    sleep $(( RANDOM % 40 + 20 ))
    echo "[$(date '+%H:%M:%S')] ${msgs[RANDOM % ${#msgs[@]}]}"
  done
}
background &
BG_PID=$!

while IFS= read -r cmd; do
  case "$cmd" in
    quit|exit|stop)
      kill $BG_PID 2>/dev/null
      echo "Server shutdown requested. Goodbye."
      exit 0 ;;
    status)
      echo "hostname: ${SERVER_NAME:-Palto-Network CS2}"
      echo "players : 0 (10 max) (0 bots) (0 humans)"
      echo "map     : de_dust2" ;;
    "")  ;;
    *)
      echo "Server executing: $cmd" ;;
  esac
done
kill $BG_PID 2>/dev/null
