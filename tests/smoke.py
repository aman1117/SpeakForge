"""Headless end-to-end test: python tests/smoke.py
Serves the app, drives Edge with a fake microphone + camera, and a mock OpenAI-compatible AI server."""
import http.server
import json
import os
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT, AI_PORT = 8799, 8798
AI_CALLS = []


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass


class MockAI(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        AI_CALLS.append(body)
        text = json.dumps(body['messages'])
        if 'Reply with exactly: ready' in text:
            content = 'ready'
        elif 'conversation partner' in text:
            content = '{"reply":"Nice to meet you! What do you work on?","correction":"","better":""}'
        else:
            content = 'Here you go:\n```json\n{"corrections":[{"original":"I am working since 2 years","better":"I have been working for 2 years","why":"present perfect continuous"}],"lost_words":[{"word":"deadline","meaning":"the last time to finish something","example":"The deadline is Friday."}],"rewrite":"So, I build tools that help people back up their data.","phrases":["to be honest"],"strength":"Clear ideas","focus":"Bridge instead of restarting"}\n```'
        out = json.dumps({'choices': [{'message': {'role': 'assistant', 'content': content}}]}).encode()
        self.send_response(200)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(out)))
        self.end_headers()
        self.wfile.write(out)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Quiet)
    aid = http.server.ThreadingHTTPServer(('127.0.0.1', AI_PORT), MockAI)
    for s in (httpd, aid):
        threading.Thread(target=s.serve_forever, daemon=True).start()
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True, args=[
            '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        ctx = browser.new_context(permissions=['microphone', 'camera', 'clipboard-read', 'clipboard-write'], accept_downloads=True)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('console', lambda m: m.type == 'error' and errors.append(f'console: {m.text}'))
        base = f'http://127.0.0.1:{PORT}/'
        page.goto(base)
        page.get_by_text("Today's mission").first.wait_for()

        routes = {
            'home': "Today's mission", 'speak': 'Speaking Arena', 'words': 'Word Lab', 'mouth': 'Mouth Gym', 'voice': 'Confidence Lab',
            'shadow': 'Shadowing Studio', 'phrases': 'Phrase Bank', 'skills': 'Skill map', 'coach': 'AI Coach', 'plan': 'Your 6-month plan', 'journal': 'Journal',
        }
        for r, text in routes.items():
            page.goto(base + '#/' + r)
            page.get_by_text(text).first.wait_for(timeout=5000)
        print('routes ok:', len(routes))
        for scr, tabs in {'words': ['naming', 'taboo', 'category', 'synonym'], 'mouth': ['warmup', 'ddk', 'twister', 'pairs', 'pen'],
                          'voice': ['zone', 'ladder', 'breath', 'exposure', 'anx'], 'shadow': ['along', 'echo', 'own']}.items():
            for t in tabs:
                page.goto(f'{base}#/{scr}?t={t}')
                page.wait_for_timeout(150)
        print('all tabs rendered')

        page.goto(base + '#/voice?t=zone')
        page.click('#calgo')
        page.wait_for_function("/dBFS|no voice/.test((document.querySelector('#bv')||{}).textContent||'')", timeout=15000)
        print('calibration:', page.inner_text('#bv'))

        page.goto(base + '#/speak?mode=oneMin')
        page.check('#cam')
        page.uncheck('#rit')
        page.click('#go')
        page.wait_for_selector('#stop', timeout=15000)
        assert page.query_selector('#camv'), 'camera preview missing'
        page.wait_for_timeout(2500)
        page.keyboard.press('Space')
        page.keyboard.press('Space')
        assert page.inner_text('#sr') == '2', 'SPACE restart counter'
        page.wait_for_timeout(1500)
        page.click('#stop')
        page.get_by_text('Coach notes').first.wait_for(timeout=15000)
        kpis = page.inner_text('.kpi')
        assert 'you 2' in kpis, kpis
        assert page.query_selector('video[controls]'), 'video playback missing'
        print('arena camera session ok; KPIs:', ' | '.join(kpis.split('\n')[:8]))
        page.fill('#lost', 'procrastinate, reluctant')
        page.click('#addlost')
        page.goto(base + '#/words?t=naming')
        opt = page.inner_text('option[value=lost]')
        assert '(2)' in opt, opt
        print('lost words deck:', opt)

        page.goto(base + '#/speak?mode=benchmark')
        page.uncheck('#cam')
        page.check('#rit')
        page.click('#go')
        page.get_by_text('Calm-down ritual').first.wait_for(timeout=5000)
        page.click('#skipr')
        page.wait_for_selector('#stop', timeout=15000)
        page.wait_for_timeout(1200)
        page.click('#stop')
        page.get_by_text('Coach notes').first.wait_for(timeout=15000)
        print('ritual + benchmark ok')

        page.goto(base + '#/speak?mode=questions')
        page.uncheck('#rit')
        page.click('#go')
        for _ in range(5):
            page.wait_for_selector('#stop', timeout=20000)
            page.wait_for_timeout(500)
            page.click('#stop')
            page.wait_for_timeout(300)
        page.get_by_text('All 5 answers').first.wait_for(timeout=20000)
        print('question chain ok')

        page.goto(base + '#/mouth?t=twister')
        page.click('#ttry')
        page.wait_for_selector('#tdone')
        page.wait_for_timeout(1500)
        page.click('#tdone')
        page.wait_for_selector('#pm', timeout=5000)
        assert page.query_selector('#py'), 'you-playback missing'
        print('twister model/you playback ok')

        page.goto(base + '#/voice?t=exposure')
        page.click('#elog')
        page.wait_for_timeout(300)
        assert page.query_selector('table td'), 'exposure log row missing'
        print('exposure log ok')

        page.goto(base + '#/coach')
        page.select_option('#prov', 'ollama')
        page.fill('#endpoint', f'http://127.0.0.1:{AI_PORT}')
        page.fill('#model', 'mock')
        page.click('#test')
        page.get_by_text('Connected').first.wait_for(timeout=10000)
        page.click('#savea')
        fb = page.evaluate("""async () => { const ai = await import('/js/ai.js'); const { S } = await import('/js/core.js');
            const fb = ai.parseFeedback(await ai.chat(S.ai, ai.feedbackMessages('my job', 'so i am working since two years on backup', {wpm:120,freezes:2,repetitions:1,fillers:0,selfRestarts:1}, S.settings)));
            const pr = ai.parsePartner(await ai.chat(S.ai, [{role:'system', content: ai.partnerSystem(S.settings, 'test')}]));
            return { fb, pr }; }""")
        assert fb['fb']['lost_words'][0]['word'] == 'deadline' and fb['fb']['corrections'] and fb['pr']['reply'].startswith('Nice'), fb
        print('AI coach ok: connection + feedback parse + partner parse;', len(AI_CALLS), 'mock calls')

        page.goto(base + '#/skills')
        page.get_by_text('Focus of the day').first.wait_for()
        page.goto(base + '#/home')
        page.get_by_text('Weekly report').first.wait_for()
        page.goto(base + '#/journal')
        page.get_by_text('Speech history').first.wait_for()
        page.wait_for_timeout(800)
        vids = page.evaluate("document.querySelectorAll('#recs video').length")
        assert vids >= 1, 'journal video missing'

        page.evaluate("async () => { const { S, save } = await import('/js/core.js'); S.ai.key = 'SECRET123'; save(); }")
        with page.expect_download() as dl:
            page.click('#exp')
        exported = open(dl.value.path(), encoding='utf-8').read()
        assert 'SECRET123' not in exported, 'AI key leaked in export'
        print('export excludes AI key')

        page.goto(base + '#/mouth?t=warmup')
        page.click('#wgo')
        page.wait_for_timeout(1000)
        page.goto(base + '#/home')
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(ROOT, 'tests', 'home.png'), full_page=True)
        page.goto(base + '#/skills')
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(ROOT, 'tests', 'skills.png'), full_page=True)
        state = page.evaluate("JSON.parse(localStorage.getItem('speakforge.v1'))")
        print('xp:', state['xp'], 'sessions:', len(state['sessions']), 'lost words:', sum(1 for c in state['srs'].values() if c['cat'] == 'Lost word'))
        browser.close()
    httpd.shutdown()
    aid.shutdown()
    ignorable = [e for e in errors if 'speech' in e.lower() or 'not-allowed' in e.lower()]
    real = [e for e in errors if e not in ignorable]
    if real:
        print('ERRORS:\n' + '\n'.join(real))
        sys.exit(1)
    print('SMOKE TEST PASSED', f'({len(ignorable)} ignorable speech-api messages)' if ignorable else '')


if __name__ == '__main__':
    main()
