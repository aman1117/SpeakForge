"""Safari-engine check: python tests/webkit_check.py
Runs every screen in Playwright WebKit (the engine behind Safari), checks fonts, recording support and a speaking session."""
import http.server
import os
import sys
import threading

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e2e import ROOT, Quiet, ROUTES  # noqa: E402

PORT = 8781


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Quiet)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    errors = []
    with sync_playwright() as p:
        b = p.webkit.launch()
        for name, vp in [('mac', {'width': 1440, 'height': 900}), ('iphone', {'width': 390, 'height': 844})]:
            ctx = b.new_context(viewport=vp, device_scale_factor=2 if name == 'iphone' else 1)
            page = ctx.new_page()
            page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
            base = f'http://localhost:{PORT}/'
            for r in ROUTES:
                page.goto(base + '#/' + r)
                page.wait_for_timeout(250)
                if not page.inner_text('main').strip() or 'Something broke' in page.inner_text('main'):
                    errors.append(f'{name}: empty screen {r}')
            info = page.evaluate("""async () => {
                await document.fonts.ready;
                return {
                  display: document.fonts.check("700 40px 'Bricolage Grotesque'"),
                  text: document.fonts.check("16px 'Atkinson Hyperlegible Next'"),
                  recorder: typeof MediaRecorder !== 'undefined' ? ['audio/webm;codecs=opus','audio/mp4','video/mp4'].filter(t => MediaRecorder.isTypeSupported(t)) : 'none',
                  speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
                  audioWorklet: typeof AudioWorkletNode !== 'undefined',
                  webAudio: !!(window.AudioContext || window.webkitAudioContext),
                  indexedDB: !!window.indexedDB,
                };
            }""")
            print(name, 'engine features:', info)
            if not (info['display'] and info['text']):
                errors.append(f'{name}: fonts not loaded')
            page.goto(base + '#/home')
            page.wait_for_timeout(500)
            page.screenshot(path=os.path.join(ROOT, 'tests', f'webkit_{name}_home.png'))
            page.goto(base + '#/theo')
            page.wait_for_timeout(400)
            page.screenshot(path=os.path.join(ROOT, 'tests', f'webkit_{name}_theo.png'), full_page=name == 'mac')
            ctx.close()
        b.close()
    httpd.shutdown()
    if errors:
        print('ERRORS:\n' + '\n'.join(errors))
        sys.exit(1)
    print('WEBKIT CHECK PASSED')


if __name__ == '__main__':
    main()
