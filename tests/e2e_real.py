"""Real life end to end: real server.py + Whisper + speaker ID (+ Ollama if running), driven through the browser UI.
    python tests/e2e_real.py        (any python with playwright; the server and audio generation use .venv)
Builds a two-person meeting with macOS voices, enrols "me" from a different clip, uploads the meeting on #/real
and checks that my turns are found and scored, and (if Ollama runs) that the AI review turns into drills."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENV = os.path.join(ROOT, '.venv', 'bin', 'python')
PORT = 8773
GEN = r'''
import os, sys, subprocess, numpy as np
sys.path.insert(0, os.path.join(sys.argv[1], 'tools'))
import reallife
work = sys.argv[2]
ME, OTHER = 'Samantha', 'Daniel'
turns = [
  (OTHER, 'Can you give us a quick update on the migration?'),
  (ME, 'Um, so basically the thing is, the migration is, uh, very good, I mean it is kind of almost done, and the stuff with the database is, um, really big.'),
  (OTHER, 'Okay. What is blocking the last part?'),
  (ME, 'So, uh, the payment thing, it is very slow and, um, basically we need to, we need to fix the stuff before Friday, you know.'),
  (OTHER, 'Got it, thanks. Let us review it on Thursday.'),
]
def say(v, t, n):
    p = os.path.join(work, n + '.wav'); subprocess.run(['say', '-v', v, '-o', p, '--data-format=LEI16@16000', t], check=True); return reallife._read(p)
parts = [np.zeros(8000, np.float32)]
for i, (v, t) in enumerate(turns):
    parts += [say(v, t, f't{i}'), np.zeros(9000, np.float32)]
reallife._write(os.path.join(work, 'meeting.wav'), np.concatenate(parts))
enroll = 'My morning starts with a long walk and a strong coffee. Then I read the news, answer emails, and plan the most important tasks. On weekends I cook for friends and try recipes from different countries.'
reallife._write(os.path.join(work, 'enroll.wav'), say(ME, enroll, 'enroll'))
'''


def main():
    work = tempfile.mkdtemp(prefix='sf_real_')
    subprocess.run([VENV, '-c', GEN, ROOT, work], check=True)
    env = {**os.environ, 'SPEAKFORGE_PORT': str(PORT), 'SPEAKFORGE_DATA': os.path.join(work, 'data')}
    log = open(os.path.join(work, 'server.log'), 'w')
    srv = subprocess.Popen([VENV, os.path.join(ROOT, 'server.py')], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    errors = []
    try:
        for _ in range(120):
            try:
                st = json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/api/status', timeout=2))
                if st.get('ready'):
                    break
            except Exception:
                pass
            time.sleep(1)
        print('status:', {k: st.get(k) for k in ('whisper', 'speaker_id', 'ollama', 'model')})
        with open(os.path.join(work, 'enroll.wav'), 'rb') as f:
            r = urllib.request.Request(f'http://127.0.0.1:{PORT}/api/enroll', data=f.read(), headers={'Content-Type': 'audio/wav'})
            print('enroll:', json.load(urllib.request.urlopen(r, timeout=300)))
        with sync_playwright() as p:
            b = p.chromium.launch()
            page = b.new_context(viewport={'width': 1300, 'height': 900}).new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            base = f'http://127.0.0.1:{PORT}/'
            page.goto(base + '#/real')
            page.get_by_text('SpeakForge knows your voice').first.wait_for(timeout=20000)
            page.fill('#title', 'Migration stand-up')
            t0 = time.time()
            page.set_input_files('#file', os.path.join(work, 'meeting.wav'))
            page.get_by_text('Who is who').first.wait_for(timeout=300000)
            print(f'analysed in {time.time() - t0:.1f}s')
            assert page.query_selector('.speaker.me'), 'my voice was not identified'
            speakers = page.inner_text('#result .card').split('Who is who')[1]
            print('speakers:', ' | '.join(l for l in speakers.split('\n') if l.strip())[:300])
            page.get_by_text('Your numbers in real life').first.wait_for(timeout=10000)
            kpi = page.inner_text('#mine .kpi')
            print('my real-life numbers:', ' | '.join(kpi.split('\n')))
            fpm = float(kpi.split('\n')[0])
            assert fpm >= 3, f'fillers not detected in my turns ({fpm}/min)'
            assert 'Can you give us' not in page.inner_text('#mine'), "other speaker's words counted as mine"
            if st.get('ollama'):
                page.wait_for_function("/This week|failed/.test(document.querySelector('#raiout')?.innerText||'')", timeout=300000)
                rv = page.inner_text('#raiout')
                assert 'failed' not in rv, rv
                print('AI review:', rv.replace('\n', ' ')[:400])
                if page.query_selector('#todeck'):
                    page.click('#todeck')
                    n = page.evaluate("Object.values(JSON.parse(localStorage.getItem('speakforge.v1')).srs).filter(c => c.cat === 'Upgrade' || c.cat === 'Lost word').length")
                    assert n > 0
                    print('drills created from real conversation:', n)
            page.goto(base + '#/home')
            page.goto(base + '#/real')
            page.get_by_text('Your real conversations over time').first.wait_for(timeout=10000)
            page.screenshot(path=os.path.join(ROOT, 'tests', 'real.png'), full_page=True)
            b.close()
    finally:
        srv.terminate()
        srv.wait(timeout=20)
        log.close()
        shutil.rmtree(work, ignore_errors=True)
    if errors:
        print('ERRORS:', errors)
        sys.exit(1)
    print('E2E REAL LIFE PASSED')


if __name__ == '__main__':
    main()
