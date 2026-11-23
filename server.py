"""SpeakForge local server: serves the app and runs speech + AI entirely on this computer.

    python3 server.py            # http://localhost:8765
Endpoints (localhost only):
    GET  /api/status        engine + Ollama availability
    POST /api/transcribe    audio -> {text, words}            (Whisper: MLX on Apple Silicon, faster-whisper elsewhere)
    POST /api/analyze       audio -> pace/pauses/pitch/R metrics (Whisper + Praat)
    POST /api/accent        audio -> R strength + vowel formants (Praat)
    POST /api/chat          OpenAI-style chat body -> local Ollama
    GET|POST|DELETE /api/enroll   your voiceprint: status | audio -> learn it | forget it
    POST /api/reallife      long recording (up to 2 GB) -> {job}; poll GET /api/job?id=... for speakers + words
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
import reallife  # noqa: E402

PORT = int(os.environ.get('SPEAKFORGE_PORT', '8765'))
API_VERSION = 3  # bump when endpoints change; start.sh restarts an older running server
OLLAMA = os.environ.get('OLLAMA_HOST_URL', 'http://127.0.0.1:11434').rstrip('/')
PREFERRED_LLMS = [m for m in [os.environ.get('SPEAKFORGE_LLM')] if m] + ['gemma4:26b', 'gemma4:26b-mlx', 'gemma4:31b', 'gemma4:12b', 'gemma3:12b', 'gemma3:27b', 'qwen2.5:14b', 'llama3.1:8b', 'gemma3:4b', 'llama3.2:3b']
MAX_BODY = 200 * 1024 * 1024
MAX_RECORDING = 2 * 1024 * 1024 * 1024
READY = threading.Event()
TTS_PY = os.environ.get('SPEAKFORGE_TTS_PYTHON') or os.path.join(ROOT, '.venv-tts', 'bin', 'python')


class TTS:
    """Natural local voice (Kokoro) in a separate Python 3.10+ process; results cached by (text, voice, speed)."""
    def __init__(self):
        self.proc, self.ready, self.error, self.device = None, False, None, None
        self.lock, self.cache, self.n = threading.Lock(), {}, 0

    def available(self):
        return os.path.exists(TTS_PY)

    def start(self):
        import subprocess
        try:
            self.proc = subprocess.Popen([TTS_PY, os.path.join(ROOT, 'tools', 'tts_worker.py')], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                         stderr=subprocess.DEVNULL, text=True, bufsize=1)
            first = json.loads(self.proc.stdout.readline() or '{}')
            self.ready, self.device = bool(first.get('ready')), first.get('device')
            if not self.ready:
                self.error = 'voice engine failed to start'
        except Exception as e:
            self.error = f'{type(e).__name__}: {e}'

    def speak(self, text, voice, speed):
        import base64
        key = (text, voice, round(speed, 2))
        if key in self.cache:
            return self.cache[key]
        with self.lock:
            if not self.ready or self.proc.poll() is not None:
                raise RuntimeError(self.error or 'voice engine not running')
            self.n += 1
            self.proc.stdin.write(json.dumps({'id': self.n, 'text': text, 'voice': voice, 'speed': speed}) + '\n')
            self.proc.stdin.flush()
            out = json.loads(self.proc.stdout.readline() or '{}')
        if out.get('error') or not out.get('path'):
            raise RuntimeError(out.get('error') or 'no audio')
        with open(out['path'], 'rb') as f:
            data = f.read()
        os.unlink(out['path'])
        res = {'audio': base64.b64encode(data).decode(), 'words': out.get('words', []), 'seconds': out.get('seconds')}
        if len(self.cache) > 300:
            self.cache.pop(next(iter(self.cache)))
        self.cache[key] = res
        return res


VOICE = TTS()
SPEAKER_ID = reallife.available()
JOBS, JOBS_LOCK, ONE_AT_A_TIME = {}, threading.Lock(), threading.Semaphore(1)


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


def start_job(src):
    """Analyse a real-life recording in the background; the temp file is deleted when done."""
    import time
    import uuid
    jid = uuid.uuid4().hex[:12]
    job = {'status': 'running', 'stage': 'queued', 'progress': 0.0, 'at': time.time()}
    with JOBS_LOCK:
        for k in [k for k, j in JOBS.items() if j['status'] != 'running' and time.time() - j['at'] > 3600]:
            del JOBS[k]
        JOBS[jid] = job
    threading.Thread(target=_run_job, args=(job, src), daemon=True).start()
    return jid


def _run_job(job, src):
    import time
    try:
        with ONE_AT_A_TIME:
            res = reallife.analyze(src, progress=lambda stage, frac: job.update(stage=stage, progress=round(frac, 3)))
        job.update(result=res, stage='done', progress=1.0, status='done')
    except ValueError as e:
        job.update(error=str(e), status='error')
    except Exception as e:
        import traceback
        sys.stderr.write('[speakforge] reallife error: ' + ''.join(traceback.format_exception(type(e), e, e.__traceback__)))
        job.update(error=f'{type(e).__name__}: {e}', status='error')
    finally:
        job['at'] = time.time()
        try:
            os.unlink(src)
        except OSError:
            pass


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
                'version': API_VERSION, 'whisper': engine.describe(), 'ready': READY.is_set(), 'platform': f'{platform.system()} {platform.machine()}',
                'ollama': models is not None, 'models': models or [], 'model': pick_model(models or []),
                'speaker_id': SPEAKER_ID, 'enrolled': reallife.voiceprint() is not None,
                'tts': 'Kokoro' if VOICE.ready else None, 'tts_loading': VOICE.available() and not VOICE.ready and not VOICE.error,
            })
        if self.path.startswith('/api/enroll'):
            vp = reallife.voiceprint()
            return self._json(200, {'enrolled': vp is not None, 'ts': vp[1].get('ts') if vp else None, 'seconds': vp[1].get('seconds') if vp else None})
        if self.path.startswith('/api/job'):
            import urllib.parse
            job = JOBS.get((urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('id') or [''])[0])
            if not job:
                return self._json(404, {'error': 'unknown or expired job'})
            keys = {'running': ('status', 'stage', 'progress'), 'done': ('status', 'result'), 'error': ('status', 'error')}[job['status']]
            return self._json(200, {k: job[k] for k in keys})
        return super().do_GET()

    def do_DELETE(self):
        if self.path.split('?')[0] == '/api/enroll':
            return self._json(200, reallife.forget())
        return self._json(404, {'error': 'unknown endpoint'})

    def _body(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > MAX_BODY:
            raise ValueError('empty or too large request body')
        return self.rfile.read(n)

    def _audio_file(self, limit=MAX_BODY):
        """Streams the request body to a temp file (1 MB at a time, so a 2 GB recording never sits in memory)."""
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > limit:
            raise ValueError('empty or too large request body' if limit == MAX_BODY else f'empty or too large recording (max {limit >> 30} GB)')
        ctype = self.headers.get('Content-Type', '')
        ext = next((e for k, e in (('wav', '.wav'), ('mp4', '.mp4'), ('m4a', '.m4a'), ('aac', '.m4a'), ('mpeg', '.mp3'), ('mp3', '.mp3'), ('ogg', '.ogg')) if k in ctype), '.webm')
        f = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
        try:
            while n > 0:
                chunk = self.rfile.read(min(n, 1 << 20))
                if not chunk:
                    raise ConnectionResetError('upload interrupted')
                f.write(chunk)
                n -= len(chunk)
            f.close()
        except BaseException:
            f.close()
            os.unlink(f.name)
            raise
        return f.name

    def do_POST(self):
        path = self.path.split('?')[0]
        try:
            if path == '/api/chat':
                return self._chat()
            if path == '/api/tts':
                req = json.loads(self._body() or b'{}')
                try:
                    return self._json(200, VOICE.speak(str(req.get('text', ''))[:4000], req.get('voice') or 'af_heart', float(req.get('speed') or 1.0)))
                except RuntimeError as e:
                    return self._json(503, {'error': str(e)})
            if path == '/api/reallife':
                return self._json(200, {'job': start_job(self._audio_file(MAX_RECORDING))})
            if path == '/api/enroll':
                src = self._audio_file()
                try:
                    return self._json(200, reallife.enroll(src))
                finally:
                    os.unlink(src)
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
        if req.get('schema'):
            return self._chat_native(model, req)
        body = json.dumps({'model': model, 'messages': req.get('messages', []), 'temperature': req.get('temperature', 0.4), 'stream': False}).encode()
        r = urllib.request.Request(f'{OLLAMA}/v1/chat/completions', data=body, headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(r, timeout=300) as resp:
                out = json.load(resp)
        except urllib.error.HTTPError as e:
            return self._json(e.code, {'error': e.read().decode(errors='replace')[:300]})
        out['model'] = model
        return self._json(200, out)

    def _chat_native(self, model, req):
        # Native Ollama API: the JSON schema is enforced while decoding, thinking is off for speed, the model stays loaded.
        payload = {'model': model, 'messages': req.get('messages', []), 'stream': False, 'format': req['schema'], 'keep_alive': '30m',
                   'think': False, 'options': {'temperature': req.get('temperature', 0.4)}}
        for attempt in (0, 1):
            r = urllib.request.Request(f'{OLLAMA}/api/chat', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
            try:
                with urllib.request.urlopen(r, timeout=300) as resp:
                    out = json.load(resp)
                break
            except urllib.error.HTTPError as e:
                err = e.read().decode(errors='replace')[:300]
                if attempt == 0 and 'think' in err:
                    payload.pop('think')
                    continue
                return self._json(e.code, {'error': err})
        content = (out.get('message') or {}).get('content', '')
        return self._json(200, {'model': model, 'choices': [{'message': {'role': 'assistant', 'content': content}}]})


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
    if VOICE.available():
        threading.Thread(target=VOICE.start, daemon=True).start()
        print('  natural voice: Kokoro (loading)')
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
