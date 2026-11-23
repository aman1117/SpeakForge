#!/usr/bin/env bash
# One-time setup for an Apple Silicon Mac (M1–M5): everything runs on your Mac, no cloud APIs.
#   - Whisper speech recognition on the GPU via Apple's MLX (mlx-whisper, large-v3-turbo)
#   - Praat voice analysis (pitch, formants, R strength) via parselmouth
#   - Speaker separation for real-life recordings via SpeechBrain ECAPA voiceprints
#   - A natural model voice (Kokoro) for shadowing, in .venv-tts
#   - A local AI coach via Ollama (default gemma4:26b, a fast mixture-of-experts model; 16 GB RAM Macs: SPEAKFORGE_LLM=gemma4:12b ./setup_mac.sh)
set -euo pipefail
cd "$(dirname "$0")"
MODEL="${SPEAKFORGE_LLM:-gemma4:26b}"

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  echo "This script is for Apple Silicon Macs. On other systems: pip install faster-whisper praat-parselmouth av numpy"
fi

echo "==> 1/5 Python environment (.venv)"
if ! command -v python3 >/dev/null; then
  echo "Python 3 is missing. Install it with 'brew install python' or from https://www.python.org/downloads/ and re-run."; exit 1
fi
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --quiet --upgrade pip
python -m pip install --quiet mlx-whisper praat-parselmouth av numpy speechbrain

echo "==> 2/5 Ollama (local AI)"
if ! command -v ollama >/dev/null; then
  if command -v brew >/dev/null; then brew install ollama
  else echo "Install Ollama from https://ollama.com/download (drag it to Applications), open it once, then re-run this script."; exit 1; fi
fi
if ! curl -s http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
  (open -a Ollama 2>/dev/null || (nohup ollama serve >/dev/null 2>&1 &)); sleep 4
fi

echo "==> 3/5 AI model: $MODEL"
ollama pull "$MODEL"

echo "==> 4/5 Whisper + speaker models (one-time download, about 1.7 GB)"
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
try:
    import reallife
    reallife.encoder()
    print('Speaker recognition ready (ECAPA voiceprints for Real life recordings)')
except Exception as e:
    print('Speaker recognition skipped for now (it downloads on first use):', e)
PY

echo "==> 5/5 Natural voice (Kokoro, about 1 GB; needs Python 3.10+)"
TTS_OK=0
SPACY_EN="en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"
if command -v uv >/dev/null; then
  uv venv -q -p 3.12 .venv-tts && uv pip install -q -p .venv-tts/bin/python kokoro soundfile "$SPACY_EN" && TTS_OK=1
else
  for PY in python3.12 python3.11 python3.10; do
    if command -v $PY >/dev/null; then
      $PY -m venv .venv-tts && .venv-tts/bin/python -m pip install --quiet kokoro soundfile "$SPACY_EN" && TTS_OK=1; break
    fi
  done
fi
if [[ $TTS_OK == 1 ]]; then
  .venv-tts/bin/python -c "from kokoro import KPipeline; KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M'); print('Natural voice ready')" 2>/dev/null | tail -1
else
  rm -rf .venv-tts
  echo "Skipped: install uv (brew install uv) or Python 3.12 (brew install python@3.12) and re-run for the natural voice. macOS voices will be used."
fi

chmod +x start.sh
echo
echo "All set. Start SpeakForge any time with:  ./start.sh"
