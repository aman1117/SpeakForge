#!/usr/bin/env bash
# Starts SpeakForge on http://localhost:8765 with local Whisper + local AI, then opens it in your browser.
#   ./start.sh                     start + open
#   ./start.sh --reminder 20:00    also open SpeakForge every day at 20:00 with a notification (macOS LaunchAgent)
#   ./start.sh --remove-reminder   delete the daily reminder
cd "$(dirname "$0")"
DIR="$(pwd)"
PLIST="$HOME/Library/LaunchAgents/com.speakforge.reminder.plist"

if [[ "${1:-}" == "--remove-reminder" ]]; then
  launchctl unload "$PLIST" 2>/dev/null; rm -f "$PLIST"; echo "Reminder removed."; exit 0
fi
if [[ "${1:-}" == "--reminder" ]]; then
  [[ "${2:-}" =~ ^([0-9]{1,2}):([0-9]{2})$ ]] || { echo "Usage: ./start.sh --reminder HH:MM"; exit 1; }
  H=$((10#${BASH_REMATCH[1]})); M=$((10#${BASH_REMATCH[2]}))
  (( H < 24 && M < 60 )) || { echo "Invalid time: $2"; exit 1; }
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.speakforge.reminder</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>-c</string>
    <string>osascript -e 'display notification "Your speaking workout is ready." with title "SpeakForge"'; "$DIR/start.sh" &gt;/tmp/speakforge.log 2&gt;&amp;1</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>$H</integer><key>Minute</key><integer>$M</integer></dict>
</dict></plist>
EOF
  launchctl unload "$PLIST" 2>/dev/null; launchctl load "$PLIST"
  echo "Daily reminder set for $2. Remove with: ./start.sh --remove-reminder"
  exit 0
fi

[ -f .venv/bin/activate ] && source .venv/bin/activate
PORT="${SPEAKFORGE_PORT:-8765}"
if curl -s "http://127.0.0.1:$PORT/api/status" >/dev/null 2>&1; then
  open "http://localhost:$PORT/" 2>/dev/null || xdg-open "http://localhost:$PORT/" 2>/dev/null
  echo "SpeakForge is already running at http://localhost:$PORT/"; exit 0
fi
if ! curl -s http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
  (open -a Ollama 2>/dev/null || (command -v ollama >/dev/null && nohup ollama serve >/dev/null 2>&1 &)) || true
fi
( sleep 2; open "http://localhost:$PORT/" 2>/dev/null || xdg-open "http://localhost:$PORT/" 2>/dev/null ) &
exec python3 server.py
