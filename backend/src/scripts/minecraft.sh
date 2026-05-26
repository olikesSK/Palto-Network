#!/bin/bash
echo "[$(date '+%H:%M:%S')] [main/INFO]: Loading libraries, please wait..."
sleep 1
echo "[$(date '+%H:%M:%S')] [main/INFO]: Starting minecraft server version 1.20.4"
sleep 1
echo "[$(date '+%H:%M:%S')] [Server thread/INFO]: Starting Minecraft server on *:${SERVER_PORT:-25565}"
sleep 0.5
echo "[$(date '+%H:%M:%S')] [Server thread/INFO]: Preparing level 'world'"
sleep 2
echo "[$(date '+%H:%M:%S')] [Server thread/INFO]: Preparing start region for dimension minecraft:overworld"
sleep 0.5
echo "[$(date '+%H:%M:%S')] [Server thread/INFO]: Time elapsed: 3892 ms"
echo "[$(date '+%H:%M:%S')] [Server thread/INFO]: Done (3.892s)! For help, type \"help\""

background_ticks() {
  local msgs=(
    "Saving chunks for level 'world/minecraft:overworld'"
    "Autosave completed"
    "Server tick time: $(( RANDOM % 5 + 17 ))ms"
    "GC: freed 12.4 MB"
    "Keeping entity chunks loaded"
  )
  while true; do
    sleep $(( RANDOM % 25 + 10 ))
    echo "[$(date '+%H:%M:%S')] [Server thread/INFO]: ${msgs[RANDOM % ${#msgs[@]}]}"
  done
}
background_ticks &
BG_PID=$!

while IFS= read -r cmd; do
  ts="[$(date '+%H:%M:%S')]"
  case "$cmd" in
    stop|Stop)
      kill $BG_PID 2>/dev/null
      echo "$ts [Server thread/INFO]: Stopping the server"
      sleep 0.5
      echo "$ts [Server thread/INFO]: Saving chunks for level 'world/minecraft:overworld'"
      sleep 0.5
      echo "$ts [Server thread/INFO]: ThreadedAnvilChunkStorage (world): All chunks are saved"
      echo "$ts [Server thread/INFO]: Server stopped"
      exit 0 ;;
    save-all)
      echo "$ts [Server thread/INFO]: Saving..."
      sleep 0.3
      echo "$ts [Server thread/INFO]: Saved the game" ;;
    list)
      echo "$ts [Server thread/INFO]: There are 0 of a max of 20 players online:" ;;
    help)
      echo "$ts [Server thread/INFO]: --- Showing help page 1 of 1 ---"
      echo "$ts [Server thread/INFO]: /help /list /save-all /stop /op /ban /kick /whitelist" ;;
    "")  ;;
    *)
      echo "$ts [Server thread/INFO]: Unknown or incomplete command, see '/help'" ;;
  esac
done
kill $BG_PID 2>/dev/null
