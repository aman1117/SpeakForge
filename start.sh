#!/usr/bin/env bash
# Starts SpeakForge on http://localhost:8765 with local Whisper + local AI, then opens it in your browser.
cd "$(dirname "$0")"
[ -f .venv/bin/activate ] && source .venv/bin/activate
if ! curl -s http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
  (open -a Ollama 2>/dev/null || (command -v ollama >/dev/null && nohup ollama serve >/dev/null 2>&1 &)) || true
fi
PORT="${SPEAKFORGE_PORT:-8765}"
( sleep 2; open "http://localhost:$PORT/" 2>/dev/null || xdg-open "http://localhost:$PORT/" 2>/dev/null ) &
exec python3 server.py
