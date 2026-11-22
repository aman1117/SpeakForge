"""Deep speech analysis of your own recording, compared with Theo Browne's measured numbers.

Usage:
    python tools/analyze_me.py path/to/recording.webm [--start 0 --length 600] [--json]

Accepts webm / m4a / mp4 / mp3 / wav. Writes <recording>.report.md next to the file.
Uses MLX Whisper on Apple Silicon Macs, faster-whisper elsewhere (see tools/engine.py).
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine  # noqa: E402

THEO = {
    'wpm': 192, 'wpm_articulation': 218, 'syll_per_sec': 5.0, 'pauses_per_min': 12.4,
    'pause_median_ms': 460, 'pct_pauses_mid_phrase': 3, 'freezes_per_min': 0.5,
    'f0_range_st': 9.7, 'f0_sd_st': 3.9, 'pct_statements_falling': 60, 'nurse_f3_ratio': 0.63,
}


def analyse(path, start=0.0, length=600.0):
    wav, _ = engine.to_wav(path, start, length)
    t = engine.transcribe(wav)
    m = engine.deep_metrics(wav, t['words'], t['text'])
    m['engine'] = engine.describe()
    return m


def verdict(key, you, theo):
    if you is None:
        return 'n/a'
    if key == 'nurse_f3_ratio':
        return '✅' if you <= 0.75 else '⚠️'
    if key in ('pct_pauses_mid_phrase', 'freezes_per_min'):
        return '✅' if you <= theo * 1.5 + 1 else '⚠️'
    return '✅' if you >= 0.8 * theo else '⚠️'


def report(m, path):
    rows = [
        ('Words per minute (overall)', 'wpm', 'Pace incl. pauses. Aim 150+ first; clarity before speed.'),
        ('Words per minute (speaking time)', 'wpm_articulation', 'How fast you talk while talking.'),
        ('Syllables per second', 'syll_per_sec', 'Articulation speed.'),
        ('Pauses per minute', 'pauses_per_min', 'Regular short pauses are good (breathing between ideas).'),
        ('% pauses mid-phrase', 'pct_pauses_mid_phrase', 'Lower = pausing between ideas, not inside them.'),
        ('Freezes (≥1.8 s) per minute', 'freezes_per_min', 'Word-search blackouts. Use bridge phrases.'),
        ('Pitch range (semitones)', 'f0_range_st', 'Expressiveness. Under ~6 sounds flat.'),
        ('Pitch variation SD (semitones)', 'f0_sd_st', 'Under ~2 = monotone.'),
        ('% statements ending with a fall', 'pct_statements_falling', 'Falling = confident and decisive.'),
        ('American R strength (F3 ratio)', 'nurse_f3_ratio', 'Lower = stronger R in work/first/learn. Theo 0.63; ~0.9+ = weak R.'),
    ]
    lines = [f'# SpeakForge deep analysis: {os.path.basename(path)}', '',
             f"Analysed **{m['seconds']} s**, {m['words']} words, engine: {m.get('engine')}.", '',
             '| Metric | You | Theo | | What it means |', '|---|---|---|---|---|']
    for label, k, note in rows:
        v = m.get(k)
        lines.append(f"| {label} | {'-' if v is None else v} | {THEO[k]} | {verdict(k, v, THEO[k])} | {note} |")
    lines += ['', f"- Fillers per minute: **{m['fillers_per_min']}** (aim < 2)",
              f"- Restarts/repeats per minute: **{m['restarts_per_min']}** (aim < 1){': ' + ', '.join(repr(r) for r in m['restarts']) if m['restarts'] else ''}",
              f"- Longest pause: **{m['longest_pause_s']} s**",
              f"- Median pitch: {m['f0_median_hz']} Hz · R-words measured: {m['nurse_tokens']} (need 4+; read the accent passage in the app's Learn from Theo screen)", '',
              '## Transcript (Whisper)', '', m['transcript'], '']
    out = os.path.splitext(path)[0] + '.report.md'
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    return out


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('file')
    ap.add_argument('--start', type=float, default=0)
    ap.add_argument('--length', type=float, default=600, help='seconds to analyse (default 600)')
    ap.add_argument('--json', action='store_true', help='also print raw metrics as JSON')
    a = ap.parse_args()
    m = analyse(a.file, a.start, a.length)
    out = report(m, a.file)
    print(open(out, encoding='utf-8').read().split('## Transcript')[0])
    if a.json:
        print(json.dumps({k: v for k, v in m.items() if k != 'transcript'}, indent=1))
    print(f'Report saved: {out}')


if __name__ == '__main__':
    main()
