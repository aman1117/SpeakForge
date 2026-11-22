"""SpeakForge local server: serves the app and runs speech + AI entirely on this computer.

    python3 server.py            # http://localhost:8765
Endpoints (localhost only):
    GET  /api/status        engine + Ollama availability
    POST /api/transcribe    audio -> {text, words}            (Whisper: MLX on Apple Silicon, faster-whisper elsewhere)
    POST /api/analyze       audio -> pace/pauses/pitch/R metrics (Whisper + Praat)
    POST /api/accent        audio -> R strength + vowel formants (Praat)
    POST /api/chat          OpenAI-style chat body -> local Ollama
"""
import http.server
import json
import os
import platform
import sys
import tempfile
import threading
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import engine  # noqa: E402

PORT = int(os.environ.get('SPEAKFORGE_PORT', '8765'))
OLLAMA = os.environ.get('OLLAMA_HOST_URL', 'http://127.0.0.1:11434').rstrip('/')
PREFERRED_LLMS = [m for m in [os.environ.get('SPEAKFORGE_LLM')] if m] + ['gemma3:12b', 'gemma3:27b', 'qwen2.5:14b', 'llama3.1:8b', 'gemma3:4b', 'llama3.2:3b']
MAX_BODY = 200 * 1024 * 1024
READY = threading.Event()


def _fetch_models():
    try:
        with urllib.request.urlopen(f'{OLLAMA}/api/tags', timeout=3) as r:
            return [m['name'] for m in json.load(r).get('models', [])]
    except Exception:
        return None


_models_cache = {'at': 0.0, 'value': None}


def ollama_models(max_age=10.0):
    """Installed Ollama models (None if Ollama is not running), cached so /api/status answers instantly."""
    import time
    if time.time() - _models_cache['at'] > max_age:
        _models_cache.update(at=time.time(), value=_fetch_models())
    return _models_cache['value']


def _refresh_models_forever():
    import time
    while True:
        _models_cache.update(at=time.time(), value=_fetch_models())
        time.sleep(8)


def pick_model(models, requested=None):
    if requested and requested in models:
        return requested
    for m in PREFERRED_LLMS:
        if m in models:
            return m
    return models[0] if models else None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        if '/api/' in (args[0] if args else ''):
            sys.stderr.write('[speakforge] ' + (fmt % args) + '\n')

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith('/api/status'):
            models = _models_cache['value']
            return self._json(200, {
                'whisper': engine.describe(), 'ready': READY.is_set(), 'platform': f'{platform.system()} {platform.machine()}',
                'ollama': models is not None, 'models': models or [], 'model': pick_model(models or []),
            })
        return super().do_GET()

    def _body(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > MAX_BODY:
            raise ValueError('empty or too large request body')
        return self.rfile.read(n)

    def _audio_file(self):
        data = self._body()
        ctype = self.headers.get('Content-Type', '')
        ext = '.wav' if 'wav' in ctype else '.mp4' if 'mp4' in ctype else '.webm'
        f = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
        f.write(data)
        f.close()
        return f.name

    def do_POST(self):
        path = self.path.split('?')[0]
        try:
            if path == '/api/chat':
                return self._chat()
            if path not in ('/api/transcribe', '/api/analyze', '/api/accent'):
                return self._json(404, {'error': 'unknown endpoint'})
            src = self._audio_file()
            tmp = [src]
            try:
                wav, _ = engine.to_wav(src)
                tmp.append(wav)
                fast = 'fast=1' in self.path
                import time as _t
                t0 = _t.time()
                partial = 'partial=1' in self.path
                t = engine.transcribe(wav, fast=fast, blocking=not partial)
                if t is None:
                    return self._json(200, {'text': '', 'words': [], 'busy': True})
                if os.environ.get('SPEAKFORGE_DEBUG'):
                    sys.stderr.write(f"[speakforge] {path} {_t.time() - t0:.1f}s: {t['text'][:80]!r}\n")
                if path == '/api/transcribe':
                    probs = [w['p'] for w in t['words']]
                    return self._json(200, {'text': t['text'], 'words': t['words'], 'confidence': round(sum(probs) / len(probs), 3) if probs else None})
                if path == '/api/accent':
                    m = engine.accent_metrics(wav, t['words'])
                    m['transcript'] = t['text']
                    return self._json(200, m)
                m = engine.deep_metrics(wav, t['words'], t['text'])
                m['engine'] = engine.describe()
                return self._json(200, m)
            finally:
                for p in tmp:
                    try:
                        os.unlink(p)
                    except OSError:
                        pass
        except ValueError as e:
            return self._json(422, {'error': str(e)})
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            return  # the browser stopped waiting (e.g. the user left the screen)
        except Exception as e:  # report engine problems to the UI instead of dropping the connection
            import traceback
            sys.stderr.write('[speakforge] error: ' + ''.join(traceback.format_exception_only(type(e), e)))
            return self._json(500, {'error': f'{type(e).__name__}: {e}'})

    def _chat(self):
        req = json.loads(self._body() or b'{}')
        models = ollama_models(max_age=0)
        if models is None:
            return self._json(503, {'error': 'Ollama is not running. Start it (open the Ollama app or run: ollama serve).'})
        model = pick_model(models, req.get('model'))
        if not model:
            return self._json(503, {'error': 'No Ollama model installed. Run: ollama pull gemma3:12b'})
        body = json.dumps({'model': model, 'messages': req.get('messages', []), 'temperature': req.get('temperature', 0.4), 'stream': False}).encode()
        r = urllib.request.Request(f'{OLLAMA}/v1/chat/completions', data=body, headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(r, timeout=300) as resp:
                out = json.load(resp)
        except urllib.error.HTTPError as e:
            return self._json(e.code, {'error': e.read().decode(errors='replace')[:300]})
        out['model'] = model
        return self._json(200, out)


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], (ConnectionAbortedError, ConnectionResetError, BrokenPipeError)):
            return  # the browser navigated away mid-response
        super().handle_error(request, client_address)


def main():
    srv = Server(('127.0.0.1', PORT), Handler)
    print(f'SpeakForge running at http://localhost:{PORT}/')
    print(f"  speech engine: {engine.describe() or 'not installed (browser recognition will be used)'}")
    models = ollama_models(max_age=0)
    threading.Thread(target=_refresh_models_forever, daemon=True).start()
    print(f"  local AI: {pick_model(models) if models else 'Ollama not running (AI coach off)'}")
    if engine.backend():
        threading.Thread(target=_warm, daemon=True).start()
    else:
        READY.set()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


def _warm():
    # Load the Whisper model in the background so the first transcription is fast.
    try:
        import numpy as np
        import wave
        p = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
        with wave.open(p, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(16000)
            w.writeframes(np.zeros(16000, dtype=np.int16).tobytes())
        engine.transcribe(p, fast=True)
        os.unlink(p)
        print('  speech engine ready', flush=True)
    except Exception as e:
        print(f'  warm-up skipped: {e}', flush=True)
    finally:
        READY.set()


if __name__ == '__main__':
    main()
