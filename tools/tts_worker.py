"""Kokoro text-to-speech worker (runs in .venv-tts, Python 3.10+). server.py talks to it over stdin/stdout, one JSON per line.
    request:  {"id": 1, "text": "...", "voice": "af_heart", "speed": 1.0}
    response: {"id": 1, "path": "/tmp/x.wav", "seconds": 3.2, "words": [{"w": "Hello", "s": 0.1, "e": 0.4}]}  or {"id": 1, "error": "..."}
"""
import json
import os
import sys
import tempfile
import warnings

warnings.filterwarnings('ignore')
os.environ.setdefault('TOKENIZERS_PARALLELISM', 'false')
OUT = sys.stdout
sys.stdout = sys.stderr  # libraries print to stdout; keep the protocol channel clean

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
import torch  # noqa: E402
from kokoro import KPipeline  # noqa: E402

RATE = 24000
VOICES = {'af_heart', 'af_bella', 'af_nicole', 'am_michael', 'am_fenrir', 'am_puck', 'bf_emma', 'bm_george'}


def send(obj):
    OUT.write(json.dumps(obj) + '\n')
    OUT.flush()


def main():
    device = os.environ.get('SPEAKFORGE_TTS_DEVICE') or ('mps' if torch.backends.mps.is_available() else 'cpu')
    pipes = {}

    def pipe(voice):
        lang = 'b' if voice.startswith('b') else 'a'
        if lang not in pipes:
            pipes[lang] = KPipeline(lang_code=lang, repo_id='hexgrad/Kokoro-82M', device=device)
        return pipes[lang]

    def synth(text, voice, speed):
        audio, words, off = [], [], 0.0
        for r in pipe(voice)(text, voice=voice, speed=speed):
            a = r.audio.numpy() if hasattr(r.audio, 'numpy') else np.asarray(r.audio)
            for t in (r.tokens or []):
                if t.start_ts is not None and t.end_ts is not None and t.text.strip() and any(c.isalnum() for c in t.text):
                    words.append({'w': t.text, 's': round(off + t.start_ts, 3), 'e': round(off + t.end_ts, 3)})
            audio.append(a)
            off += len(a) / RATE
        return (np.concatenate(audio) if audio else np.zeros(RATE // 10, np.float32)), words

    synth('Ready.', 'af_heart', 1.0)  # load weights and compile kernels before the first real request
    send({'ready': True, 'device': device})
    for line in sys.stdin:
        try:
            req = json.loads(line)
        except ValueError:
            continue
        try:
            voice = req.get('voice') if req.get('voice') in VOICES else 'af_heart'
            speed = max(0.5, min(2.0, float(req.get('speed') or 1.0)))
            text = str(req.get('text', '')).strip()[:4000]
            if not text:
                raise ValueError('empty text')
            audio, words = synth(text, voice, speed)
            path = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
            sf.write(path, audio, RATE, subtype='PCM_16')
            send({'id': req.get('id'), 'path': path, 'seconds': round(len(audio) / RATE, 2), 'words': words})
        except Exception as e:  # report and keep serving
            send({'id': req.get('id'), 'error': f'{type(e).__name__}: {e}'})


if __name__ == '__main__':
    main()
