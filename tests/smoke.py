"""Headless smoke test: python tests/smoke.py  (serves the app, drives Edge with a fake microphone)."""
import http.server
import os
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8799


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass


def main():
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Quiet)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True, args=[
            '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        ctx = browser.new_context(permissions=['microphone'])
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('console', lambda m: m.type == 'error' and errors.append(f'console: {m.text}'))
        base = f'http://127.0.0.1:{PORT}/'
        page.goto(base)
        page.get_by_text("Today's mission").first.wait_for()

        routes = {
            'home': "Today's mission", 'speak': 'Speaking Arena', 'words': 'Word Lab', 'mouth': 'Mouth Gym',
            'voice': 'Confidence Lab', 'shadow': 'Shadowing Studio', 'phrases': 'Phrase Bank', 'plan': 'Your 6-month plan', 'journal': 'Journal',
        }
        for r, text in routes.items():
            page.goto(base + '#/' + r)
            page.get_by_text(text).first.wait_for(timeout=5000)
            print('route ok:', r)

        for t in ['naming', 'taboo', 'category', 'synonym']:
            page.goto(f'{base}#/words?t={t}')
            page.wait_for_timeout(200)
        for t in ['warmup', 'ddk', 'twister', 'pairs', 'pen']:
            page.goto(f'{base}#/mouth?t={t}')
            page.wait_for_timeout(200)
        for t in ['zone', 'ladder', 'breath', 'exposure', 'anx']:
            page.goto(f'{base}#/voice?t={t}')
            page.wait_for_timeout(200)
        for t in ['along', 'echo', 'own']:
            page.goto(f'{base}#/shadow?t={t}')
            page.wait_for_timeout(200)
        print('all tabs rendered')

        # Real speaking session with the fake mic (a beeping tone), stopped early.
        page.goto(base + '#/speak')
        page.click('#go')
        page.wait_for_selector('#stop', timeout=10000)
        page.wait_for_timeout(4000)
        page.click('#stop')
        page.get_by_text('Coach notes').first.wait_for(timeout=10000)
        kpis = page.inner_text('.kpi')
        print('speak session result KPIs:', ' | '.join(kpis.split('\n')[:6]))

        # Pa-ta-ka test (6 s) and volume calibration (7 s).
        page.goto(base + '#/mouth?t=ddk')
        page.click('#dgo')
        page.get_by_text('syllables in 5 s').first.wait_for(timeout=12000)
        print('ddk:', page.inner_text('#dres').replace('\n', ' '))
        page.goto(base + '#/voice?t=zone')
        page.click('#calgo')
        page.wait_for_function("document.querySelector('#bv') && /dBFS|no voice/.test(document.querySelector('#bv').textContent)", timeout=15000)
        print('calibration:', page.inner_text('#bv') if page.query_selector('#bv') else 'zone screen re-rendered')

        # Navigating away mid-drill must not throw.
        page.goto(base + '#/mouth?t=warmup')
        page.click('#wgo')
        page.wait_for_timeout(1500)
        page.goto(base + '#/home')
        page.wait_for_timeout(1500)

        state = page.evaluate("JSON.parse(localStorage.getItem('speakforge.v1'))")
        print('xp:', state['xp'], 'sessions:', len(state['sessions']), 'ddk:', len(state['ddk']), 'baseline set:', state['volume']['baseline'] is not None)
        recs = page.evaluate("""() => new Promise(r => { const q = indexedDB.open('speakforge'); q.onsuccess = () => { const g = q.result.transaction('recordings').objectStore('recordings').getAll(); g.onsuccess = () => r(g.result.map(x => x.blob.size)); }; })""")
        print('recordings saved (bytes):', recs)
        page.goto(base + '#/journal')
        page.get_by_text('Speech history').first.wait_for()
        page.screenshot(path=os.path.join(ROOT, 'tests', 'journal.png'), full_page=True)
        page.goto(base + '#/home')
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(ROOT, 'tests', 'home.png'), full_page=True)
        browser.close()
    httpd.shutdown()
    ignorable = [e for e in errors if 'speech' in e.lower() or 'not-allowed' in e.lower()]
    real = [e for e in errors if e not in ignorable]
    if real:
        print('ERRORS:\n' + '\n'.join(real))
        sys.exit(1)
    print('SMOKE TEST PASSED', f'({len(ignorable)} ignorable speech-api messages)' if ignorable else '')


if __name__ == '__main__':
    main()
