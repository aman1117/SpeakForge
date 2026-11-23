"""Natural voice end to end: real server.py + Kokoro worker, driven through Shadowing in the browser.
    python tests/e2e_voice.py      (any python with playwright; the server runs from .venv, the voice from .venv-tts)
Checks /api/tts (audio + word timings + cache), that the app uses Kokoro instead of the system voice,
and that word highlighting follows the audio."""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8775


def post(path, obj):
    r = urllib.request.Request(f'http://127.0.0.1:{PORT}{path}', data=json.dumps(obj).encode(), headers={'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(r, timeout=120))


def main():
    if not os.path.exists(os.path.join(ROOT, '.venv-tts', 'bin', 'python')):
        print('SKIPPED: no .venv-tts (run ./setup_mac.sh)')
        return
    srv = subprocess.Popen([os.path.join(ROOT, '.venv', 'bin', 'python'), 'server.py'], cwd=ROOT, env={**os.environ, 'SPEAKFORGE_PORT': str(PORT)},
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    errors = []
    try:
        st = {}
        for _ in range(120):
            try:
                st = json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/api/status', timeout=2))
                if st.get('tts') and st.get('ready'):
                    break
            except Exception:
                pass
            time.sleep(1)
        assert st.get('tts') == 'Kokoro', st
        text = 'Three years ago, I was terrified of meetings. Today, I am leading one.'
        t0 = time.time()
        j = post('/api/tts', {'text': text, 'voice': 'af_heart', 'speed': 1})
        first = time.time() - t0
        t0 = time.time()
        post('/api/tts', {'text': text, 'voice': 'af_heart', 'speed': 1})
        cached = time.time() - t0
        wav = base64.b64decode(j['audio'])
        assert wav[:4] == b'RIFF' and j['seconds'] > 2 and len(j['words']) >= 10, j['words']
        assert [w['s'] for w in j['words']] == sorted(w['s'] for w in j['words'])
        print(f"tts: {j['seconds']}s of audio in {first:.2f}s (cached {cached:.3f}s), {len(j['words'])} timed words")
        with sync_playwright() as p:
            b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
            page = b.new_page()
            page.add_init_script("window.__sys = 0; const s = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = u => { window.__sys++; s(u); };")
            page.on('pageerror', lambda e: errors.append(str(e)))
            base = f'http://127.0.0.1:{PORT}/'
            page.goto(base + '#/shadow?t=along')
            page.wait_for_function("/Voice: Kokoro/.test(document.querySelector('#engine').innerText)", timeout=30000)
            page.goto(base + '#/home')
            page.goto(base + '#/shadow?t=along')
            assert 'sounds robotic' not in page.inner_text('main'), 'robotic-voice warning shown although Kokoro is ready'
            page.click('#play')
            page.wait_for_selector('.word.now', timeout=20000)
            seen = set()
            for _ in range(40):
                w = page.evaluate("document.querySelector('.word.now')?.textContent")
                if w:
                    seen.add(w)
                page.wait_for_timeout(150)
            assert len(seen) >= 6, seen
            assert page.evaluate('window.__sys') == 0, 'system voice was used instead of Kokoro'
            print('shadowing: Kokoro voice, highlighted words in sync:', len(seen))
            page.click('#stop')
            b.close()
    finally:
        srv.terminate()
        srv.wait(timeout=20)
    if errors:
        print('ERRORS:', errors)
        sys.exit(1)
    print('E2E VOICE PASSED')


if __name__ == '__main__':
    main()
