"""End-to-end test of every flow with a fake mic/camera, a scripted speech recogniser and a mock AI server.
    python tests/e2e.py            (needs: pip install playwright && python -m playwright install chromium)
Covers: guided workout, Speak (+ AI feedback, redo with one fix), Explain gym (+ rubric, redo), Filler lab, Word upgrade,
Say it better, virtual-audience exposure, progress, export without secrets, and every route rendering without errors."""
import http.server
import json
import os
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT, AI_PORT = 8799, 8798
AI_CALLS = []

FAKE = """
window.__fakeText = '';
class FakeSR {
  start() { this._last = null; this._iv = setInterval(() => { const t = window.__fakeText; if (t && t !== this._last) { this._last = t;
    const alt = [{ transcript: t, confidence: 0.82 }]; alt.isFinal = true; this.onresult && this.onresult({ resultIndex: 0, results: [alt] }); } }, 250); }
  stop() { clearInterval(this._iv); setTimeout(() => this.onend && this.onend(), 30); }
  abort() { this.stop(); }
}
window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
speechSynthesis.speak = u => setTimeout(() => u.onend && u.onend(), 50);
"""

FEEDBACK = {"heard_point": "Backups protect data, and deadlines are the hard part.", "strength": "Clear topic", "corrections": [{"original": "I am working since 2 years", "better": "I have been working for 2 years", "why": "present perfect"}],
            "upgrades": [{"said": "very bad", "better": "unproductive"}], "lost_words": [{"word": "deadline", "meaning": "last time to finish", "example": "The deadline is Friday."}],
            "confusing": {"quote": "the thing is", "why": "no subject"}, "rewrite": "I build backup tools. The hard part is deadlines.", "phrases": ["the hard part is"], "clarity": 6, "focus": "Say your point in the first sentence."}
EXPLAIN = {"heard_point": "An index is a shortcut to find rows fast.", "scores": {"point_first": 2, "structure": 1, "concrete": 2, "plain_words": 1, "focus": 1},
           "confusing": {"quote": "the thing is", "why": "vague"}, "listener_question": "Why not index every column?", "better_outline": ["Shortcut", "Book index", "Trade-off"],
           "model_answer": "An index is a shortcut. Like the index of a book.", "one_fix": "Add the trade-off at the end."}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.startswith('/api/'):  # behave like "no local engine" without console 404s
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()


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
            content = json.dumps({"reply": "Nice to meet you! What do you work on?", "correction": "", "better": ""})
        elif 'Pyramid Principle' in text:
            content = json.dumps(EXPLAIN)
        elif 'You judge whether' in text:
            content = json.dumps({"score": 80, "verdict": "Specific.", "best": "The meeting ran an hour over and decided nothing."})
        else:
            content = 'Here you go:\n```json\n' + json.dumps(FEEDBACK) + '\n```'
        out = json.dumps({'choices': [{'message': {'role': 'assistant', 'content': content}}]}).encode()
        self.send_response(200)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(out)))
        self.end_headers()
        self.wfile.write(out)


ROUTES = ['home', 'speak', 'practice', 'words?t=naming', 'words?t=taboo', 'words?t=upgrade', 'words?t=better', 'fillers?t=aware', 'fillers?t=live', 'fillers?t=starts',
          'explain', 'explain?f=feynman', 'explain?f=story', 'explain?f=process', 'explain?f=compare', 'explain?f=answer&one=1', 'calm?t=sigh', 'calm?t=audience', 'calm?t=video',
          'calm?t=zone', 'calm?t=ladder', 'mouth?t=groups', 'mouth?t=warmup', 'mouth?t=pen', 'mouth?t=twister', 'mouth?t=pairs', 'shadow?t=along', 'shadow?t=echo', 'shadow?t=own',
          'phrases', 'real', 'progress', 'progress?t=recordings', 'progress?t=history', 'progress?t=plan', 'progress?t=data', 'masters', 'theo', 'settings', 'partner']


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Quiet)
    aid = http.server.ThreadingHTTPServer(('127.0.0.1', AI_PORT), MockAI)
    for s in (httpd, aid):
        threading.Thread(target=s.serve_forever, daemon=True).start()
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        ctx = browser.new_context(viewport={'width': 1280, 'height': 900}, permissions=['microphone', 'camera'], accept_downloads=True)
        ctx.add_init_script(FAKE)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('console', lambda m: m.type == 'error' and errors.append(f'console: {m.text}'))
        base = f'http://127.0.0.1:{PORT}/'
        say = lambda t: page.evaluate('t => { window.__fakeText = t; }', t)

        page.goto(base)
        page.get_by_text('Start today’s workout').first.wait_for()
        for r in ROUTES:
            page.goto(base + '#/' + r)
            page.wait_for_timeout(120)
            assert 'Something broke' not in page.inner_text('main'), r
        print('routes ok:', len(ROUTES))

        page.goto(base + '#/settings')
        page.select_option('#prov', 'ollama')
        page.fill('#endpoint', f'http://127.0.0.1:{AI_PORT}')
        page.fill('#model', 'mock')
        page.click('#test')
        page.get_by_text('Connected').first.wait_for(timeout=10000)
        page.click('#savea')
        print('AI connection ok')

        # guided workout: start, workout bar, skip
        page.goto(base + '#/home')
        page.click('#startw')
        page.wait_for_selector('#wbar', timeout=5000)
        first = page.inner_text('#wbar')
        page.click('#wbar [data-skip]')
        page.wait_for_timeout(300)
        assert 'Step 2' in page.inner_text('#wbar'), page.inner_text('#wbar')
        print('workout bar ok:', first.split('\n')[0], '→ skip → step 2')

        # Speak: fake speech with a restart, fillers and vague words; AI feedback; redo with one fix
        page.goto(base + '#/speak?mode=oneMin')
        page.evaluate("document.querySelectorAll('details').forEach(d => d.open = true)")
        page.uncheck('#rit')
        page.uncheck('#cam')
        page.check('input[name=plan][value="0"]', force=True)
        page.click('#go')
        page.wait_for_selector('#stop', timeout=15000)
        say('um so I want I want to talk about my job and the meeting was very bad and the thing is basically the deadline you know')
        page.wait_for_function("document.querySelector('#fl') && +document.querySelector('#fl').textContent >= 2", timeout=5000)
        page.keyboard.press('Space')
        page.wait_for_timeout(1500)
        page.click('#stop')
        page.get_by_text('One thing to fix next').first.wait_for(timeout=15000)
        kpis = page.inner_text('.kpi')
        assert page.query_selector('.transcript .rep') and page.query_selector('.transcript .fill') and page.query_selector('.transcript .vague'), 'transcript highlights missing'
        page.wait_for_selector('#aiout .heard', timeout=10000)
        assert 'Say your point in the first sentence.' in page.inner_text('#fixline')
        page.click('#addup')
        print('speak ok; KPIs:', ' | '.join(kpis.split('\n')[:12]))
        page.click('#redo')
        page.wait_for_selector('#stop', timeout=15000)
        assert 'This time: Say your point' in page.inner_text('main')
        say('My job is building backup tools. The hard part is deadlines.')
        page.wait_for_timeout(1500)
        page.click('#stop')
        page.get_by_text('One thing to fix next').first.wait_for(timeout=15000)
        assert 'Redo' in page.inner_text('.card.hl'), 'before/redo comparison missing'
        print('redo with one fix ok')

        # Explain gym: no plan, rubric from AI, redo
        page.goto(base + '#/explain?f=feynman')
        page.click('#plan label:first-child')
        page.click('#go')
        page.wait_for_selector('#stop', timeout=15000)
        say('An index is a shortcut to find rows. For example a book index. It is like a map. In short it saves time.')
        page.wait_for_timeout(1500)
        page.click('#stop')
        page.wait_for_selector('.heard', timeout=15000)
        assert 'shortcut' in page.inner_text('.heard')
        assert '7' in page.inner_text('.dial'), page.inner_text('.dial')
        page.click('#redo')
        page.wait_for_selector('#stop', timeout=15000)
        assert 'Add the trade-off' in page.inner_text('main')
        say('An index is a shortcut. Like a book index. The trade-off is slower writes.')
        page.wait_for_timeout(1200)
        page.click('#stop')
        page.wait_for_selector('.heard', timeout=15000)
        assert 'Round 1' in page.inner_text('main'), 'round comparison missing'
        print('explain gym ok: rubric, heard point, redo comparison')

        # Filler lab: live minute
        page.goto(base + '#/fillers?t=live')
        page.click('#go')
        page.wait_for_selector('#stop', timeout=15000)
        say('um I think uh the plan is basically good you know')
        page.wait_for_function("/[1-9] filler/.test(document.querySelector('#fz')?.innerText||'')", timeout=5000)
        page.click('#stop')
        page.get_by_text('Fillers per minute').first.wait_for(timeout=15000)
        print('filler-free minute ok: live cue fired')

        # Word upgrade from your own transcript
        page.goto(base + '#/words?t=upgrade')
        assert 'in your own recent speech' in page.inner_text('main'), page.inner_text('main')[:300]
        page.click('#go')
        allopts = page.evaluate("import('/js/library.js').then(l => Object.values(l.UPGRADES).map(o => o[0][0]).join(' '))")
        for i in range(8):
            if page.get_by_text('Upgrade score').count():
                break
            page.wait_for_selector('#utr', timeout=8000)
            say(f'{allopts} take {i}')
            page.wait_for_function("/added to your deck|Upgrade score/.test(document.body.innerText)", timeout=10000)
            page.wait_for_timeout(1200)
        page.get_by_text('Upgrade score').first.wait_for(timeout=15000)
        ups = page.evaluate("Object.values(JSON.parse(localStorage.getItem('speakforge.v1')).srs).filter(c => c.cat === 'Upgrade').length")
        assert ups >= 1, ups
        print('word upgrade ok:', ups, 'upgrades in deck')

        # Say it better with AI scoring
        page.goto(base + '#/words?t=better')
        page.click('#go')
        for i in range(5):
            page.wait_for_selector('#bnext', timeout=8000)
            say(f'The meeting ran an hour over and nobody decided anything {i}')
            page.wait_for_timeout(500)
            page.click('#bnext')
            page.wait_for_timeout(700)
        page.get_by_text('Precision').first.wait_for(timeout=20000)
        assert '80' in page.inner_text('.dial')
        print('say it better ok')

        # Virtual audience exposure with expectancy test
        page.goto(base + '#/calm?t=audience')
        page.click('#prep')
        page.click('#go')
        page.wait_for_selector('#stop', timeout=15000)
        assert page.query_selector('canvas.crowd'), 'audience canvas missing'
        say('I will talk about my weekend. I went hiking with friends.')
        page.wait_for_timeout(2500)
        page.click('#stop')
        page.wait_for_selector('#save', timeout=15000)
        page.click('#hap label:first-child')
        page.click('#save')
        page.get_by_text('What you learned').first.wait_for(timeout=5000)
        print('audience exposure ok:', page.inner_text('.card.hl h2')[:90])

        page.goto(base + '#/progress?t=history')
        page.wait_for_timeout(500)
        assert 'Audience exposures' in page.inner_text('main'), (errors, page.inner_text('main')[:500])
        page.goto(base + '#/progress?t=skills')
        page.get_by_text('Weekly report').first.wait_for()
        page.goto(base + '#/home')
        page.wait_for_timeout(400)
        scores = page.inner_text('.problems')
        print('home problem scores:', ' | '.join(scores.split('\n')))
        page.evaluate("async () => { const { S, save } = await import('/js/core.js'); S.ai.key = 'SECRET123'; save(); }")
        page.goto(base + '#/progress?t=data')
        with page.expect_download() as dl:
            page.click('#exp')
        assert 'SECRET123' not in open(dl.value.path(), encoding='utf-8').read(), 'AI key leaked in export'
        print('export excludes AI key')
        page.goto(base + '#/home')
        page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(ROOT, 'tests', 'home.png'), full_page=True)
        browser.close()
    httpd.shutdown()
    aid.shutdown()
    real = [e for e in errors if 'speech' not in e.lower() and 'not-allowed' not in e.lower()]
    if real:
        print('ERRORS:\n' + '\n'.join(real))
        sys.exit(1)
    print(f'E2E PASSED ({len(AI_CALLS)} mock AI calls)')


if __name__ == '__main__':
    main()
