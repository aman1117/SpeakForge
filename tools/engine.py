"""Local speech engine shared by server.py and analyze_me.py.

Transcription: mlx-whisper on Apple Silicon (fast, uses the GPU/Neural Engine via MLX), faster-whisper elsewhere.
Analysis: Praat (parselmouth) for pitch and formants, exactly as used to measure Theo Browne.
"""
import os
import platform
import re
import statistics as st
import tempfile
import threading
import wave

import numpy as np

DISFLUENT_PROMPT = 'Umm, so, uh, I- I mean, I want- I want to, like, you know, explain this.'
FILLERS = {'um', 'umm', 'uh', 'uhh', 'erm', 'er', 'ah', 'hmm', 'mm'}
LEGIT_DOUBLES = {'very', 'that', 'had', 'so', 'really', 'no'}
NURSE = set("work works worked first were word words worth learn learned turn turned third thirty search hurt burn worse worst nerd nerds her girl person certain earned earn world".split())
OTHER = set('this thing things big bit fix with which will got not lot stop job top back bad had have fact'.split())
TRAP_NASAL = set("can't cant man plan plans hand stand scan ban damn chance answer".split())
TRAP_ORAL = set('back bad app apps had has have fact stack track add cat that path black'.split())
# Stock phrases Whisper invents on silence or noise; dropped when they are the whole utterance.
HALLUCINATIONS = {'you', 'thank you', 'thanks for watching', 'thank you for watching', 'bye', 'so', 'okay', 'oh', 'hmm'}
LOT = set('got not lot stop job top hot shot spot block rock drop clock box'.split())
THOUGHT = set('thought caught bought brought talk talked walk saw off long wrong cost lost soft cause dog song'.split())

_lock = threading.Lock()
_models = {}
IS_MAC_ARM = platform.system() == 'Darwin' and platform.machine() == 'arm64'


def backend():
    if IS_MAC_ARM:
        try:
            import mlx_whisper  # noqa: F401
            return 'mlx'
        except ImportError:
            pass
    try:
        import faster_whisper  # noqa: F401
        return 'faster'
    except ImportError:
        return None


def model_name(fast=False):
    b = backend()
    if b == 'mlx':
        return os.environ.get('SPEAKFORGE_WHISPER', 'mlx-community/whisper-large-v3-turbo')
    if fast:
        return os.environ.get('SPEAKFORGE_WHISPER_FAST', 'base.en')
    return os.environ.get('SPEAKFORGE_WHISPER', 'small.en')


def describe():
    b = backend()
    if not b:
        return None
    return f"{'MLX Whisper' if b == 'mlx' else 'faster-whisper'} ({model_name().split('/')[-1]})"


def to_wav(src, start=0.0, length=None):
    """Decode any audio file (webm/mp4/m4a/mp3/wav) to a 16 kHz mono WAV. Returns (path, seconds)."""
    import av
    dst = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
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
    c.close()
    a = np.concatenate(buf).astype(np.int16) if buf else np.zeros(1600, dtype=np.int16)
    with wave.open(dst, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(a.tobytes())
    return dst, len(a) / 16000


def transcribe(wav_path, fast=False, prompt=DISFLUENT_PROMPT, blocking=True):
    """Returns {'text', 'words': [{w, s, e, p}]}; words carry timestamps and probabilities.
    With blocking=False returns None immediately if the engine is busy (used for live interim text)."""
    b = backend()
    if not b:
        raise RuntimeError('No Whisper engine installed. Run setup (pip install mlx-whisper or faster-whisper).')
    name = model_name(fast)
    words, texts = [], []
    if not _lock.acquire(blocking=blocking):
        return None
    try:
        if b == 'mlx':
            import mlx_whisper
            with wave.open(wav_path, 'rb') as wf:
                audio = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
            res = mlx_whisper.transcribe(audio, path_or_hf_repo=name, word_timestamps=True, initial_prompt=prompt,
                                         condition_on_previous_text=False, language='en')
            for s in res.get('segments', []):
                if s.get('no_speech_prob', 0) > 0.6 and s.get('avg_logprob', 0) < -1:
                    continue
                texts.append(s['text'].strip())
                for w in s.get('words', []):
                    words.append({'w': w['word'], 's': w['start'], 'e': w['end'], 'p': w.get('probability', 1.0)})
        else:
            from faster_whisper import WhisperModel
            if name not in _models:
                _models[name] = WhisperModel(name, device='cpu', compute_type='int8')
            segs, _ = _models[name].transcribe(wav_path, word_timestamps=True, vad_filter=False, condition_on_previous_text=False,
                                               initial_prompt=prompt, language='en')
            for s in segs:
                if s.no_speech_prob > 0.6 and s.avg_logprob < -1:
                    continue
                texts.append(s.text.strip())
                for w in s.words or []:
                    words.append({'w': w.word, 's': w.start, 'e': w.end, 'p': w.probability})
    finally:
        _lock.release()
    text = ' '.join(t for t in texts if t)
    if re.sub(r'[^a-z ]', '', text.lower()).strip() in HALLUCINATIONS:
        return {'text': '', 'words': []}
    return {'text': text, 'words': [w for w in words if w['e'] > w['s']]}


def _key(w):
    return re.sub(r"[^a-z']", '', w.lower().replace('’', "'"))


def syl(w):
    w = re.sub(r'[^a-z]', '', w.lower())
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


def _sound(wav_path):
    import parselmouth
    return parselmouth.Sound(wav_path)


def _formants(snd, W, groups, f0_median):
    from parselmouth.praat import call
    formant = snd.to_formant_burg(time_step=0.005, max_number_of_formants=5, maximum_formant=5000 if (f0_median or 120) < 165 else 5500)
    out = {g: [] for g in groups}
    for w in W:
        k = _key(w['w'])
        dur = w['e'] - w['s']
        if dur < 0.12 or w.get('p', 1) < 0.5:
            continue
        for g, vocab in groups.items():
            if k not in vocab:
                continue
            vals = []
            for f in (0.35, 0.45, 0.55, 0.65, 0.75):
                t = w['s'] + f * dur
                f1, f2, f3 = (call(formant, 'Get value at time', i, t, 'Hertz', 'Linear') for i in (1, 2, 3))
                if all(np.isfinite([f1, f2, f3])) and 200 < f1 < 1100 and 600 < f2 < 2900 and 1000 < f3 < 4000:
                    vals.append((f1, f2, f3))
            if len(vals) >= 3:
                out[g].append(np.median(np.array(vals), axis=0))
    return out


def _summ(arr):
    if not arr:
        return None
    a = np.array(arr)
    return {'F1': int(np.median(a[:, 0])), 'F2': int(np.median(a[:, 1])), 'F3': int(np.median(a[:, 2])), 'n': len(arr)}


def accent_metrics(wav_path, W):
    snd = _sound(wav_path)
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=70, pitch_ceiling=400)
    f0 = pitch.selected_array['frequency']
    f0m = float(np.median(f0[f0 > 0])) if (f0 > 0).any() else None
    fm = _formants(snd, W, {'nurse': NURSE, 'other': OTHER, 'trap_nasal': TRAP_NASAL, 'trap_oral': TRAP_ORAL, 'lot': LOT, 'thought': THOUGHT}, f0m)
    nurse, other = fm['nurse'], fm['other']
    ratio = round(float(np.median([x[2] for x in nurse]) / np.median([x[2] for x in other])), 2) if len(nurse) >= 4 and len(other) >= 4 else None
    res = {'nurse_f3_ratio': ratio, 'nurse_n': len(nurse)}
    for g in ('trap_nasal', 'trap_oral', 'lot', 'thought'):
        s = _summ(fm[g]) if len(fm[g]) >= 2 else None
        res[g] = s
    return res


def deep_metrics(wav_path, W, text):
    """Pace, pause placement, fillers, restarts, pitch and intonation (same method as the Theo analysis)."""
    if len(W) < 8:
        raise ValueError('Too little speech recognised (need at least ~8 words).')
    tokens = [t for t in (_key(w['w']) for w in W) if t]
    span = max(W[-1]['e'] - W[0]['s'], 1.0)
    gaps = [(W[i + 1]['s'] - W[i]['e'], W[i]['w'].strip()) for i in range(len(W) - 1)]
    pauses = [g for g, _ in gaps if g >= 0.25]
    end_p = [g for g, w in gaps if g >= 0.25 and re.search(r'[.?!]$', w)]
    mid = [g for g, w in gaps if g >= 0.25 and not re.search(r'[.?!,]$', w)]
    freezes = [g for g in pauses if g >= 1.8]
    speech_time = max(span - sum(pauses), 0.5)
    mins = span / 60
    snd = _sound(wav_path)
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
    acc = accent_metrics(wav_path, W) if len(W) >= 20 else {'nurse_f3_ratio': None, 'nurse_n': 0}
    reps = repetitions(tokens)
    return {
        'seconds': round(span, 1), 'words': len(W),
        'wpm': round(len(W) / mins), 'wpm_articulation': round(len(W) / (speech_time / 60)),
        'syll_per_sec': round(sum(syl(t) for t in tokens) / speech_time, 2),
        'pauses_per_min': round(len(pauses) / mins, 1), 'pause_median_ms': round(1000 * st.median(pauses)) if pauses else 0,
        'pct_pauses_sentence_end': round(100 * len(end_p) / len(pauses)) if pauses else None,
        'pct_pauses_mid_phrase': round(100 * len(mid) / len(pauses)) if pauses else None,
        'freezes_per_min': round(len(freezes) / mins, 1), 'longest_pause_s': round(max(pauses), 1) if pauses else 0,
        'fillers_per_min': round(sum(1 for t in tokens if t in FILLERS) / mins, 1),
        'restarts_per_min': round(len(reps) / mins, 1), 'restarts': reps[:20],
        'f0_median_hz': round(float(np.median(voiced)), 1) if len(voiced) else None,
        'f0_range_st': round(float(semis(np.percentile(voiced, 90), np.percentile(voiced, 10))), 1) if len(voiced) > 20 else None,
        'f0_sd_st': round(float(np.std(semis(voiced, np.median(voiced)))), 2) if len(voiced) > 20 else None,
        'pct_statements_falling': round(100 * sum(x < -1 for x in moves) / len(moves)) if moves else None,
        'nurse_f3_ratio': acc.get('nurse_f3_ratio'), 'nurse_tokens': acc.get('nurse_n', 0),
        'transcript': text,
    }
