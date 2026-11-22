#!/usr/bin/env bash
# One-time setup for an Apple Silicon Mac (M1–M5): everything runs on your Mac, no cloud APIs.
#   - Whisper speech recognition on the GPU via Apple's MLX (mlx-whisper, large-v3-turbo)
#   - Praat voice analysis (pitch, formants, R strength) via parselmouth
#   - A local AI coach via Ollama (default gemma3:12b; on an M5 Max try: SPEAKFORGE_LLM=gemma3:27b ./setup_mac.sh)
set -euo pipefail
cd "$(dirname "$0")"
MODEL="${SPEAKFORGE_LLM:-gemma3:12b}"

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  echo "This script is for Apple Silicon Macs. On other systems: pip install faster-whisper praat-parselmouth av numpy"
fi

echo "==> 1/4 Python environment (.venv)"
if ! command -v python3 >/dev/null; then
  echo "Python 3 is missing. Install it with 'brew install python' or from https://www.python.org/downloads/ and re-run."; exit 1
fi
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --quiet --upgrade pip
python -m pip install --quiet mlx-whisper praat-parselmouth av numpy

echo "==> 2/4 Ollama (local AI)"
if ! command -v ollama >/dev/null; then
  if command -v brew >/dev/null; then brew install ollama
  else echo "Install Ollama from https://ollama.com/download (drag it to Applications), open it once, then re-run this script."; exit 1; fi
fi
if ! curl -s http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
  (open -a Ollama 2>/dev/null || (nohup ollama serve >/dev/null 2>&1 &)); sleep 4
fi

echo "==> 3/4 AI model: $MODEL"
ollama pull "$MODEL"

echo "==> 4/4 Whisper model (one-time download, about 1.6 GB)"
python - <<'PY'
import sys, tempfile, wave
import numpy as np
sys.path.insert(0, 'tools')
import engine
p = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
with wave.open(p, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(np.zeros(16000, dtype=np.int16).tobytes())
engine.transcribe(p)
print('Speech engine ready:', engine.describe())
PY

chmod +x start.sh
echo
echo "All set. Start SpeakForge any time with:  ./start.sh"
