"""End-to-end test of PRIVATE mode: real server.py + real Whisper + real Ollama, real audio through the browser mic.
    python tests/e2e_local.py
Needs: faster-whisper (or mlx-whisper on a Mac), praat-parselmouth, av, numpy, Ollama with at least one model.
Speech input: macOS `say` (or Windows SAPI) generates test WAVs, fed to Chromium as a fake microphone.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8772
TMP = os.path.join(os.environ.get('TEMP', '/tmp'), 'sf_local')
SPEECH = 'So, um, I want, I want to talk about my job. I build backup software for the cloud. It is basically a tool that, uh, keeps your data safe. The hardest part is the deadline, you know. But I really enjoy it, and I learn something new every week.'
PASSAGE = "I can't stand bad apps. Back then, my first job was to plan the stack and learn the work. I thought a lot about it, but I got the answer wrong, so I talked to the man who had the data. It was better to stop, step back, and turn the plan around. Her words were worth a lot. Get it working, then make it better."


def make_wav(path, text):
    if os.path.exists(path):
        return
    if sys.platform == 'darwin':
        aiff = path[:-4] + '.aiff'
        subprocess.run(['say', '-v', 'Samantha', '-o', aiff, text], check=True)
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@16000', aiff, path], check=True)
        return
    ps = ("Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; "
          f"$s.SetOutputToWaveFile('{path}'); $s.Speak(\"{text}\"); $s.Dispose()")
    subprocess.run(['powershell', '-NoProfile', '-Command', ps], check=True)


def wait_server():
    for _ in range(180):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{PORT}/api/status', timeout=2) as r:
                st = json.load(r)
                if st.get('ready'):
                    return st
        except Exception:
            pass
        time.sleep(1)
    raise RuntimeError('server did not become ready')


def browser(p, wav):
    return p.chromium.launch(channel=None if sys.platform == 'darwin' else 'msedge', headless=True, args=[
        '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', f"--use-file-for-fake-audio-capture={wav.replace(os.sep, '/')}"])


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    os.makedirs(TMP, exist_ok=True)
    speech, passage = os.path.join(TMP, 'speech.wav'), os.path.join(TMP, 'passage.wav')
    make_wav(speech, SPEECH)
    make_wav(passage, PASSAGE)
    env = {**os.environ, 'SPEAKFORGE_PORT': str(PORT)}
    log_path = os.path.join(TMP, 'server.log')
    log = open(log_path, 'w', encoding='utf-8')  # a file, not a pipe: an unread pipe fills up and blocks the server
    venv = os.path.join(ROOT, '.venv', 'bin', 'python')
    srv = subprocess.Popen([venv if os.path.exists(venv) else sys.executable, os.path.join(ROOT, 'server.py')], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, text=True)
    errors = []
    try:
        st = wait_server()
        print('status:', st)
        assert st['whisper'] and st['ollama'], 'need Whisper + Ollama for this test'
        base = f'http://127.0.0.1:{PORT}/'
        with sync_playwright() as p:
            b = browser(p, speech)
            page = b.new_context(permissions=['microphone']).new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(base)
            page.get_by_text('Private mode').first.wait_for(timeout=15000)
            print('rail:', page.inner_text('#engine').replace('\n', ' | '))
            page.goto(base + '#/speak?mode=oneMin')
            page.evaluate("document.querySelectorAll('details').forEach(d => d.open = true)")
            page.check('input[name=plan][value=\"0\"]', force=True)
            page.uncheck('#rit')
            page.uncheck('#cam')
            page.click('#go')
            page.wait_for_selector('#stop', timeout=20000)
            page.wait_for_function("document.querySelector('#tr') && /backup|software|cloud/i.test(document.querySelector('#tr').innerText)", timeout=90000)
            print('live local transcript:', page.inner_text('#tr')[:160])
            page.wait_for_timeout(12000)
            page.click('#stop')
            page.get_by_text('One thing to fix next').first.wait_for(timeout=120000)
            page.evaluate("document.querySelectorAll('details').forEach(d => d.open = true)")
            kpis = page.inner_text('.kpi')
            print('KPIs:', ' | '.join(kpis.split('\n')))
            page.wait_for_function("/Measured on your computer|failed/.test((document.querySelector('#theoout')||{innerText:''}).innerText)", timeout=180000)
            theo = page.inner_text('#theoout')
            assert 'Measured on your computer' in theo, theo
            print('you vs theo (local deep analysis):', theo.replace('\n', ' ')[:260])
            page.wait_for_function("/listener took away|Corrections|clearer way|AI error/.test((document.querySelector('#aiout')||{innerText:''}).innerText)", timeout=300000)
            ai = page.inner_text('#aiout')
            assert 'AI error' not in ai, ai
            print('local AI feedback:', ai.replace('\n', ' ')[:260])
            b.close()

            b = browser(p, passage)
            page = b.new_context(permissions=['microphone']).new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(base + '#/theo')
            page.click('#measure')
            page.wait_for_timeout(26000)
            page.click('#measure')
            page.wait_for_function("/American R|failed/.test((document.querySelector('#mres')||{innerText:''}).innerText + (document.querySelector('#mstat')||{innerText:''}).innerText)", timeout=180000)
            res = page.inner_text('#mres')
            assert 'American R' in res, page.inner_text('#mstat')
            print('accent measurement:', res.replace('\n', ' ')[:300])
            b.close()
    finally:
        srv.terminate()
        try:
            srv.wait(timeout=10)
        except Exception:
            srv.kill()
        log.close()
        print('server log tail:', '\n'.join(open(log_path, encoding='utf-8', errors='replace').read().strip().splitlines()[-6:]))
    if errors:
        print('ERRORS:', errors)
        sys.exit(1)
    print('E2E LOCAL TEST PASSED')


if __name__ == '__main__':
    main()
