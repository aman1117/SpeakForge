"""Deep speech analysis of your own recording, compared with Theo Browne's measured numbers.

Usage:
    python tools/analyze_me.py path/to/recording.webm [--model small.en] [--start 0 --length 600]

Accepts webm / m4a / mp3 / wav (anything PyAV can decode). Writes <recording>.report.md next to the file.
First run downloads the Whisper model (~460 MB for small.en, ~150 MB for base.en).
"""
import argparse
import json
import os
import re
import statistics as st
import sys
import tempfile
import wave

import av
import numpy as np
import parselmouth
from parselmouth.praat import call

THEO = {
    'wpm_overall': 192, 'wpm_articulation': 218, 'syll_per_sec': 5.0, 'pauses_per_min': 12.4,
    'pause_median_ms': 460, 'pct_pauses_mid_phrase': 3, 'freezes_per_min': 0.5,
    'f0_range_st': 9.7, 'f0_sd_st': 3.9, 'pct_statements_falling': 60, 'nurse_f3_ratio': 0.63,
}
FILLERS = {'um', 'umm', 'uh', 'uhh', 'erm', 'er', 'ah', 'hmm', 'mm'}
NURSE = set("work works worked first were word words worth learn learned turn turned third thirty search hurt burn worse worst nerd nerds her girl person certain earned earn world".split())
OTHER = set('this thing things big bit fix with which will got not lot stop job top back bad had have fact'.split())
LEGIT_DOUBLES = {'very', 'that', 'had', 'so', 'really', 'no'}


def decode(src, dst, start, length):
    c = av.open(src)
    r = av.AudioResampler(format='s16', layout='mono', rate=16000)
    buf = []
    for f in c.decode(audio=0):
        t = f.time or 0
        if t < start:
            continue
        if length and t > start + length:
            break
        for g in r.resample(f):
            buf.append(g.to_ndarray().flatten())
    for g in r.resample(None) or []:
        buf.append(g.to_ndarray().flatten())
    if not buf:
        sys.exit('No audio decoded. Is the file empty?')
    a = np.concatenate(buf).astype(np.int16)
    with wave.open(dst, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(a.tobytes())
    return len(a) / 16000


def syl(w):
    w = re.sub(r"[^a-z]", '', w.lower())
    n = len(re.findall(r'[aeiouy]+', w))
    if w.endswith('e') and not w.endswith(('le', 'ee')) and n > 1:
        n -= 1
    return max(1, n)


def semis(f, ref):
    return 12 * np.log2(np.asarray(f) / ref)


def repetitions(tokens):
    out, i = [], 0
    while i < len(tokens):
        hit = 0
        for n in (3, 2, 1):
            if i + 2 * n <= len(tokens) and tokens[i:i + n] == tokens[i + n:i + 2 * n] and not (n == 1 and tokens[i] in LEGIT_DOUBLES):
                hit = n
                break
        if hit:
            out.append(' '.join(tokens[i:i + hit]))
            i += hit
        else:
            i += 1
    return out


def analyse(path, model_name, start, length):
    from faster_whisper import WhisperModel
    tmp = os.path.join(tempfile.gettempdir(), 'speakforge_analyse.wav')
    dur = decode(path, tmp, start, length)
    model = WhisperModel(model_name, device='cpu', compute_type='int8')
    segs, _ = model.transcribe(tmp, word_timestamps=True, vad_filter=False, condition_on_previous_text=False,
                               initial_prompt='Umm, so, uh, I- I mean, I want- I want to, like, you know, explain this.')
    W, text = [], []
    for s in segs:
        text.append(s.text.strip())
        for w in s.words:
            if w.end > w.start:
                W.append({'w': w.word, 's': w.start, 'e': w.end, 'p': w.probability})
    if len(W) < 20:
        sys.exit('Too little speech recognised (need at least ~20 words).')
    tokens = [re.sub(r"[^a-z']", '', w['w'].lower()) for w in W]
    tokens = [t for t in tokens if t]

    span = W[-1]['e'] - W[0]['s']
    gaps = [(W[i + 1]['s'] - W[i]['e'], W[i]['w'].strip()) for i in range(len(W) - 1)]
    pauses = [g for g, _ in gaps if g >= 0.25]
    freezes = [g for g in pauses if g >= 1.8]
    mid = [g for g, w in gaps if g >= 0.25 and not re.search(r'[.?!,]$', w)]
    speech_time = span - sum(pauses)
    mins = span / 60
    nsyl = sum(syl(t) for t in tokens)

    snd = parselmouth.Sound(tmp)
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=70, pitch_ceiling=400)
    f0 = pitch.selected_array['frequency']
    times = pitch.xs()
    voiced = f0[f0 > 0]
    moves = []
    for w in W:
        if not re.search(r'\.$', w['w'].strip()):
            continue
        end = f0[(times >= w['s'] + 0.5 * (w['e'] - w['s'])) & (times <= w['e'])]
        pre = f0[(times >= w['s'] - 1.0) & (times < w['s'])]
        end, pre = end[end > 0], pre[pre > 0]
        if len(pre) >= 5 and len(end) >= 3:
            moves.append(float(semis(np.median(end), np.median(pre))))

    formant = snd.to_formant_burg(time_step=0.005, max_number_of_formants=5, maximum_formant=5000 if np.median(voiced) < 165 else 5500)

    def f3_of(words):
        vals = []
        for w in W:
            k = re.sub(r"[^a-z']", '', w['w'].lower())
            if k in words and w['e'] - w['s'] >= 0.12:
                pts = [call(formant, 'Get value at time', 3, w['s'] + f * (w['e'] - w['s']), 'Hertz', 'Linear') for f in (0.35, 0.45, 0.55, 0.65, 0.75)]
                pts = [x for x in pts if np.isfinite(x) and 1000 < x < 4000]
                if len(pts) >= 3:
                    vals.append(float(np.median(pts)))
        return vals

    nurse, other = f3_of(NURSE), f3_of(OTHER)
    fillers = sum(1 for t in tokens if t in FILLERS)
    reps = repetitions(tokens)

    m = {
        'seconds_analysed': round(span, 1), 'words': len(W),
        'wpm_overall': round(len(W) / mins), 'wpm_articulation': round(len(W) / (speech_time / 60)),
        'syll_per_sec': round(nsyl / speech_time, 2),
        'pauses_per_min': round(len(pauses) / mins, 1), 'pause_median_ms': round(1000 * st.median(pauses)) if pauses else 0,
        'pct_pauses_mid_phrase': round(100 * len(mid) / max(1, len(pauses))),
        'freezes_per_min': round(len(freezes) / mins, 1), 'longest_pause_s': round(max(pauses), 1) if pauses else 0,
        'fillers_per_min': round(fillers / mins, 1), 'restarts_per_min': round(len(reps) / mins, 1), 'restarts': reps[:20],
        'f0_median_hz': round(float(np.median(voiced)), 1) if len(voiced) else None,
        'f0_range_st': round(float(semis(np.percentile(voiced, 90), np.percentile(voiced, 10))), 1) if len(voiced) else None,
        'f0_sd_st': round(float(np.std(semis(voiced, np.median(voiced)))), 2) if len(voiced) else None,
        'pct_statements_falling': round(100 * sum(x < -1 for x in moves) / len(moves)) if moves else None,
        'nurse_tokens': len(nurse),
        'nurse_f3_ratio': round(float(np.median(nurse) / np.median(other)), 2) if len(nurse) >= 6 and len(other) >= 6 else None,
        'transcript': ' '.join(text),
    }
    return m


def verdict(key, you, theo):
    if you is None:
        return 'n/a'
    better_low = key in ('pct_pauses_mid_phrase', 'freezes_per_min', 'nurse_f3_ratio')
    ratio = you / theo if theo else 1
    if key == 'nurse_f3_ratio':
        return '✅' if you <= 0.75 else '⚠️'
    if better_low:
        return '✅' if you <= theo * 1.5 + 1 else '⚠️'
    return '✅' if ratio >= 0.8 else '⚠️'


def report(m, path):
    rows = [
        ('Words per minute (overall)', 'wpm_overall', 'Pace incl. pauses. Aim 150+ first; clarity before speed.'),
        ('Words per minute (speaking time)', 'wpm_articulation', 'How fast you talk while talking.'),
        ('Syllables per second', 'syll_per_sec', 'Articulation speed.'),
        ('Pauses per minute', 'pauses_per_min', 'Regular short pauses are GOOD (breathing between ideas).'),
        ('% pauses mid-phrase', 'pct_pauses_mid_phrase', 'Lower = pausing between ideas, not inside them.'),
        ('Freezes (≥1.8 s) per minute', 'freezes_per_min', 'Word-search blackouts. Use bridge phrases.'),
        ('Pitch range (semitones)', 'f0_range_st', 'Expressiveness. Under ~6 sounds flat.'),
        ('Pitch variation SD (semitones)', 'f0_sd_st', 'Under ~2 = monotone.'),
        ('% statements ending with a fall', 'pct_statements_falling', 'Falling = confident and decisive.'),
        ('American R strength (F3 ratio)', 'nurse_f3_ratio', 'Lower = stronger R in work/first/learn. Theo 0.63; ~0.9+ = weak R.'),
    ]
    lines = [f'# SpeakForge deep analysis: {os.path.basename(path)}', '',
             f"Analysed **{m['seconds_analysed']} s**, {m['words']} words.", '',
             '| Metric | You | Theo | | What it means |', '|---|---|---|---|---|']
    for label, k, note in rows:
        lines.append(f"| {label} | {'-' if m.get(k) is None else m.get(k)} | {THEO[k]} | {verdict(k, m.get(k), THEO[k])} | {note} |")
    lines += ['', f"- Fillers per minute: **{m['fillers_per_min']}** (aim < 2)",
              f"- Restarts/repeats per minute: **{m['restarts_per_min']}** (aim < 1){': ' + ', '.join(repr(r) for r in m['restarts']) if m['restarts'] else ''}",
              f"- Longest pause: **{m['longest_pause_s']} s**",
              f"- Median pitch: {m['f0_median_hz']} Hz · R-words measured: {m['nurse_tokens']} (need 6+; read the R benchmark passage from PLAN.md to measure your R)", '',
              '## Transcript (Whisper)', '', m['transcript'], '',
              '_Tip: paste this transcript into ChatGPT/Copilot with the “AI coach prompt” from the Speaking Arena for grammar and phrasing feedback._']
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
    ap.add_argument('--model', default='small.en', help='tiny.en / base.en (faster) / small.en (default, better)')
    ap.add_argument('--start', type=float, default=0)
    ap.add_argument('--length', type=float, default=600, help='seconds to analyse (default 600)')
    ap.add_argument('--json', action='store_true', help='also print raw metrics as JSON')
    a = ap.parse_args()
    m = analyse(a.file, a.model, a.start, a.length)
    out = report(m, a.file)
    print(open(out, encoding='utf-8').read().split('## Transcript')[0])
    if a.json:
        print(json.dumps({k: v for k, v in m.items() if k != 'transcript'}, indent=1))
    print(f'Report saved: {out}')


if __name__ == '__main__':
    main()
