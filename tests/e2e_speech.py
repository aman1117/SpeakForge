"""Transcript-path end-to-end test with a fake speech recogniser: python tests/e2e_speech.py
Verifies restart/filler detection, clarity, automatic AI feedback (mock server), lost-word capture and the AI conversation partner."""
import http.server
import os
import sys
import threading

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from smoke import ROOT, Quiet, MockAI, AI_CALLS  # noqa: E402

PORT, AI_PORT = 8789, 8788

FAKE = """
window.__fakeText = 'um so I want I want to talk about my job and the deadline is basically next Friday you know';
class FakeSR {
  start() { this._t = setTimeout(() => { const alt = [{ transcript: window.__fakeText, confidence: 0.82 }]; alt.isFinal = true; this.onresult && this.onresult({ resultIndex: 0, results: [alt] }); }, 300); }
  stop() { clearTimeout(this._t); setTimeout(() => this.onend && this.onend(), 30); }
  abort() { this.stop(); }
}
window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
speechSynthesis.speak = u => setTimeout(() => u.onend && u.onend(), 50);
"""


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Quiet)
    aid = http.server.ThreadingHTTPServer(('127.0.0.1', AI_PORT), MockAI)
    for s in (httpd, aid):
        threading.Thread(target=s.serve_forever, daemon=True).start()
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True, args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        ctx = browser.new_context(permissions=['microphone'])
        ctx.add_init_script(FAKE)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        base = f'http://127.0.0.1:{PORT}/'
        page.goto(base + '#/coach')
        page.select_option('#prov', 'ollama')
        page.fill('#endpoint', f'http://127.0.0.1:{AI_PORT}')
        page.fill('#model', 'mock')
        page.click('#savea')

        page.goto(base + '#/speak?mode=oneMin')
        page.evaluate("document.querySelectorAll('details').forEach(d => d.open = true)")
        page.uncheck('#rit')
        page.uncheck('#cam')
        page.click('#go')
        page.wait_for_selector('#stop', timeout=15000)
        page.wait_for_timeout(2500)
        page.click('#stop')
        page.get_by_text('Coach notes').first.wait_for(timeout=15000)
        kpis = page.inner_text('.kpi')
        print('KPIs:', ' | '.join(kpis.split('\n')))
        assert 'detected 1' in kpis, 'restart "I want I want" not detected'
        assert '82%' in kpis, 'clarity from recogniser confidence missing'
        assert page.query_selector('.transcript .rep') and page.query_selector('.transcript .fill'), 'transcript highlights missing'
        page.wait_for_selector('#addai', timeout=10000)
        print('AI feedback panel:', page.inner_text('#aiout').replace('\n', ' ')[:160])
        page.click('#addai')
        lost = page.evaluate("Object.values(JSON.parse(localStorage.getItem('speakforge.v1')).srs).filter(c => c.cat === 'Lost word').map(c => c.phrase)")
        assert 'deadline' in lost, lost
        print('AI lost word added:', lost)
        page.click('#shadowit')
        page.get_by_text('Loaded your AI native-style rewrite').first.wait_for(timeout=5000)
        print('AI rewrite loaded into shadowing')

        page.goto(base + '#/words?t=naming')
        page.select_option('#ntype', 'lost')
        page.click('#nstart')
        page.wait_for_selector('#self', timeout=10000)
        page.wait_for_timeout(500)
        print('naming with lost word cue:', page.inner_text('#play .prompt'))
        page.click('#quit')

        page.goto(base + '#/coach')
        page.click('#startc')
        page.wait_for_selector('#send', timeout=15000)
        page.wait_for_timeout(800)
        page.click('#send')
        page.wait_for_function("(document.querySelector('#log')||{innerText:''}).innerText.includes('You')", timeout=10000)
        page.wait_for_function("document.querySelectorAll('#log p').length >= 3 && !!document.querySelector('#send')", timeout=10000)
        page.click('#endc')  # ending mid-turn must not hang
        page.get_by_text('Conversation saved').first.wait_for(timeout=5000)
        print('partner:', page.inner_text('#log').replace('\n', ' ')[:200])
        browser.close()
    httpd.shutdown()
    aid.shutdown()
    if errors:
        print('ERRORS:', errors)
        sys.exit(1)
    print('E2E SPEECH TEST PASSED;', len(AI_CALLS), 'AI calls')


if __name__ == '__main__':
    main()
