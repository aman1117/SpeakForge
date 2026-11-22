"""Real-life recordings: transcribe a long day/meeting recording, separate speakers and find which one is you.

Speaker embeddings: SpeechBrain ECAPA-TDNN (VoxCeleb) on the Apple GPU (MPS) when available, else the CPU; the model
is cached in ~/.speakforge/models. Your voiceprint is the mean embedding of an enrollment clip, stored in ~/.speakforge
(override with SPEAKFORGE_DATA). Nothing leaves this computer.
"""
import json
import os
import sys
import tempfile
import threading
import time
import wave

import numpy as np

import engine

SR = 16000
DATA = os.path.expanduser(os.environ.get('SPEAKFORGE_DATA') or '~/.speakforge')
MODEL_DIR = os.path.join(os.path.expanduser('~/.speakforge'), 'models', 'ecapa')
WIN, HOP = 1.5, 0.75              # diarization windows (s)
CUT = 0.65                        # average-linkage cosine distance at which clusters stop merging (tuned on AMI meetings + a phone call)
JOIN_SIM = 0.65                   # clusters whose centroids are this similar are one person (different people measured <= 0.58)
ME_SIM = 0.5                      # min cosine(cluster centroid, voiceprint) to call a speaker "me" (same person ~0.75-0.9, others < 0.45)
MIN_SHARE, MIN_SECS, MAX_SPK = 0.03, 4.0, 8    # clusters under 3 % of the speech or 4 s fold into their nearest neighbour
CHUNK = 600                       # transcribe long files in ~10 min pieces (cut at quiet points)
MAX_LINK = 3000                   # windows used for hierarchical clustering; the rest join the nearest centroid
ENROLL_MIN = 8.0

_enc = None
_enc_lock, _infer_lock = threading.Lock(), threading.Lock()
_dev = 'cpu'


def available():
    import importlib.util
    return importlib.util.find_spec('speechbrain') is not None


def encoder():
    global _enc, _dev
    with _enc_lock:
        if _enc is None:
            import logging
            import warnings
            for m in ('torchaudio', 'speechbrain', 'torch'):
                warnings.filterwarnings('ignore', module=m)
            warnings.filterwarnings('ignore', message='.*torchaudio.*')
            warnings.filterwarnings('ignore', message="Module 'speechbrain")
            warnings.filterwarnings('ignore', message='urllib3 v2')
            for n in ('speechbrain', 'torch', 'torchaudio'):
                logging.getLogger(n).setLevel(logging.ERROR)
            try:
                from speechbrain.inference.speaker import EncoderClassifier
            except ImportError:
                raise RuntimeError('Speaker recognition is not installed. Run: .venv/bin/pip install speechbrain (or re-run setup_mac.sh).')
            os.makedirs(MODEL_DIR, exist_ok=True)
            _enc = EncoderClassifier.from_hparams(source='speechbrain/spkrec-ecapa-voxceleb', savedir=MODEL_DIR, run_opts={'device': 'cpu'})
            _enc.eval()
            from speechbrain.utils.importutils import LazyModule
            # SpeechBrain parks lazy stubs in sys.modules; anything that scans modules (linecache, used by numba inside
            # mlx-whisper) then trips over optional integrations that are not installed.
            for k in [k for k, m in sys.modules.items() if isinstance(m, LazyModule) and m.lazy_module is None]:
                del sys.modules[k]
            import torch
            # ECAPA's 1-D convolutions are ~100x faster on the Apple GPU than on the CPU; features stay on the CPU.
            want = os.environ.get('SPEAKFORGE_SPK_DEVICE') or ('mps' if torch.backends.mps.is_available() else 'cpu')
            try:
                _enc.mods.embedding_model.to(want)
                _enc.mods.embedding_model(torch.zeros(1, 50, 80, device=want), torch.ones(1, device=want))
                _dev = want
            except Exception:
                _enc.mods.embedding_model.to('cpu')
    return _enc


def _read(path):
    """16 kHz mono float32 samples of any audio file."""
    try:
        with wave.open(path, 'rb') as w:
            if (w.getframerate(), w.getnchannels(), w.getsampwidth()) == (SR, 1, 2):
                return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    except (wave.Error, EOFError):
        pass
    try:
        wav, _ = engine.to_wav(path)
    except Exception as e:
        raise ValueError(f'Could not read this file as audio ({type(e).__name__}). Try webm, m4a, mp3, wav or mp4.')
    try:
        return _read(wav)
    finally:
        os.unlink(wav)


def _write(path, a):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes())


def _norm(x):
    x = np.asarray(x, dtype=np.float32)
    return x / np.maximum(np.linalg.norm(x, axis=-1, keepdims=True), 1e-9)


def _embed_many(audio, spans, batch=64):
    """L2-normalised embeddings [N, 192] for (start, end) spans in seconds."""
    import torch
    enc = encoder()
    segs = [audio[int(s * SR):max(int(e * SR), int(s * SR) + 1)] for s, e in spans]
    out = []
    with _infer_lock, torch.inference_mode():
        for i in range(0, len(segs), batch):
            b = segs[i:i + batch]
            n = max(len(x) for x in b)
            x = np.zeros((len(b), n), dtype=np.float32)
            for j, s in enumerate(b):
                x[j, :len(s)] = s
            lens = torch.tensor([len(s) / n for s in b], dtype=torch.float32)
            f = enc.mods.mean_var_norm(enc.mods.compute_features(torch.from_numpy(x)), lens)
            out.append(enc.mods.embedding_model(f.to(_dev), lens.to(_dev)).squeeze(1).float().cpu().numpy())
    return _norm(np.concatenate(out)) if out else np.zeros((0, 192), dtype=np.float32)


def embed(src, start=None, end=None):
    """L2-normalised 192-d voice embedding of a file path or a 16 kHz float array (optionally a slice in seconds)."""
    a = src if isinstance(src, np.ndarray) else _read(src)
    a = np.asarray(a, dtype=np.float32)
    s = start or 0.0
    e = len(a) / SR if end is None else end
    return _embed_many(a, [(s, e)])[0]


def _voiced(a, frame=0.03):
    """Simple energy VAD: boolean per 30 ms frame."""
    n = int(frame * SR)
    k = len(a) // n
    if k == 0:
        return np.zeros(0, dtype=bool), n
    db = 20 * np.log10(np.sqrt(np.mean(a[:k * n].reshape(k, n) ** 2, axis=1)) + 1e-9)
    thr = max(np.percentile(db, 95) - 30, np.percentile(db, 10) + 6, -75)
    v = db > thr
    hang = np.convolve(v, np.ones(5), 'same') > 0  # keep ~60 ms around voiced frames
    return hang, n


def _paths():
    return os.path.join(DATA, 'voiceprint.npy'), os.path.join(DATA, 'voiceprint.json')


def enroll(wav_path):
    a = _read(wav_path)
    v, n = _voiced(a)
    seconds = float(v.sum() * n / SR)
    if seconds < ENROLL_MIN:
        raise ValueError(f'Need at least {ENROLL_MIN:.0f} seconds of speech to learn your voice (heard {seconds:.1f} s). Read a longer passage.')
    sp = a[:len(v) * n].reshape(len(v), n)[v].ravel()
    total = len(sp) / SR
    starts = np.arange(0, max(total - 3.0, 0) + 1e-6, 1.5)
    vec = _norm(_embed_many(sp, [(s, min(s + 3.0, total)) for s in starts]).mean(0))
    os.makedirs(DATA, exist_ok=True)
    npy, meta = _paths()
    with open(npy + '.part', 'wb') as f:
        np.save(f, vec)
    with open(meta + '.part', 'w') as f:
        json.dump({'ts': int(time.time() * 1000), 'seconds': round(seconds, 1)}, f)
    os.replace(npy + '.part', npy)
    os.replace(meta + '.part', meta)
    return {'ok': True, 'seconds': round(seconds, 1)}


def voiceprint():
    """(vector, meta) of the enrolled voice, or None."""
    npy, meta = _paths()
    if not os.path.exists(npy):
        return None
    try:
        with open(meta) as f:
            m = json.load(f)
    except (OSError, ValueError):
        m = {}
    return _norm(np.load(npy)), m


def forget():
    for p in _paths():
        try:
            os.unlink(p)
        except OSError:
            pass
    return {'ok': True}


def _transcribe(audio, progress):
    """Whisper over the whole recording, in ~10 min pieces cut at quiet moments so progress is visible
    and live transcription elsewhere in the app can interleave."""
    dur = len(audio) / SR
    cuts = [0.0]
    while dur - cuts[-1] > CHUNK * 1.3:
        t = cuts[-1] + CHUNK
        a = audio[int((t - 15) * SR):int((t + 15) * SR)]
        k = len(a) // 1600
        e = (a[:k * 1600].reshape(k, 1600) ** 2).mean(1)
        cuts.append(t - 15 + 0.1 * int(np.argmin(np.convolve(e, np.ones(3), 'same'))) + 0.05)
    cuts.append(dur)
    words = []
    for i in range(len(cuts) - 1):
        progress('transcribing', 0.05 + 0.8 * cuts[i] / max(dur, 1e-6))
        p = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
        try:
            _write(p, audio[int(cuts[i] * SR):int(cuts[i + 1] * SR)])
            t = engine.transcribe(p)
        finally:
            os.unlink(p)
        for w in t['words']:
            words.append(dict(w, s=float(w['s'] + cuts[i]), e=float(w['e'] + cuts[i])))
    return sorted(words, key=lambda w: w['s'])


def _windows(words, dur):
    regs = []
    for w in words:
        s, e = max(0.0, w['s'] - 0.15), min(dur, w['e'] + 0.15)
        if regs and s - regs[-1][1] < 0.6:
            regs[-1][1] = max(regs[-1][1], e)
        else:
            regs.append([s, e])
    out = []
    for s, e in regs:
        if e - s <= WIN:
            a = max(0.0, min((s + e - WIN) / 2, dur - WIN))
            out.append((a, min(dur, a + WIN)))
        else:
            n = int(np.ceil((e - s - WIN) / HOP)) + 1
            out += [(a, a + WIN) for a in np.linspace(s, e - WIN, n)]
    return sorted(out)


def _sim(E, C):
    with np.errstate(all='ignore'):  # Accelerate's float matmul raises spurious FP flags on macOS
        return E @ C.T


def _centroids(E, lab, k):
    return _norm(np.stack([E[lab == c].mean(0) for c in range(k)]))


def _relabel(lab):
    _, lab = np.unique(lab, return_inverse=True)
    return lab


def _fold(E, lab):
    """Fold the smallest cluster into its nearest neighbour until every cluster is big enough and there are <= 8."""
    N = len(E)
    while True:
        k = lab.max() + 1
        cnt = np.bincount(lab, minlength=k)
        c = int(np.argmin(cnt))
        if k == 1 or (k <= MAX_SPK and cnt[c] >= max(MIN_SHARE * N, MIN_SECS / HOP)):
            return lab
        C = _centroids(E, lab, k)
        s = _sim(C, C[c])
        s[c] = -np.inf
        lab = _relabel(np.where(lab == c, int(np.argmax(s)), lab))


def _cluster(E):
    """Average-linkage on cosine distance, tiny clusters folded into their nearest neighbour, then k-means-style refinement."""
    N = len(E)
    if N < 3:
        return np.zeros(N, dtype=int)
    from scipy.cluster.hierarchy import fcluster, linkage
    idx = np.unique(np.linspace(0, N - 1, min(N, MAX_LINK)).astype(int))
    lab = _relabel(fcluster(linkage(E[idx].astype(np.float64), 'average', metric='cosine'), t=CUT, criterion='distance'))
    lab = _relabel(np.argmax(_sim(E, _centroids(E[idx], lab, lab.max() + 1)), axis=1))
    for _ in range(5):
        lab = _fold(E, lab)
        new = _relabel(np.argmax(_sim(E, _centroids(E, lab, lab.max() + 1)), axis=1))
        if np.array_equal(new, lab):
            break
        lab = new
    lab = _fold(E, lab)
    while lab.max() > 0:
        C = _centroids(E, lab, lab.max() + 1)
        S = _sim(C, C) - 2 * np.eye(len(C))
        a, b = np.unravel_index(np.argmax(S), S.shape)
        if S[a, b] < JOIN_SIM:
            break
        lab = _relabel(np.where(lab == b, a, lab))
    return lab


def _merge_me(E, lab, vp):
    """If your voice was split into several clusters, join the pieces that all match your voiceprint and each other."""
    C = _centroids(E, lab, lab.max() + 1)
    s = _sim(C, vp)
    b = int(np.argmax(s))
    if s[b] < ME_SIM:
        return lab
    for c in range(len(C)):
        if c != b and s[c] >= ME_SIM and _sim(C[c], C[b]) >= 0.5:
            lab = np.where(lab == c, b, lab)
    return _relabel(lab)


def _assign(words, wins, E, C):
    """Speaker index per word: centre-weighted similarity of the windows covering its midpoint."""
    ws = np.array([w[0] for w in wins])
    centre = ws + WIN / 2
    S = _sim(E, C)
    out = []
    for w in words:
        m = (w['s'] + w['e']) / 2
        lo, hi = np.searchsorted(ws, m - WIN), np.searchsorted(ws, m, side='right')
        j = np.arange(lo, hi)
        j = j[ws[j] + WIN >= m] if len(j) else j
        if not len(j):
            out.append(int(np.argmax(S[np.argmin(np.abs(centre - m))])))
            continue
        wt = np.maximum(1 - np.abs(centre[j] - m) / (WIN / 2), 0) + 0.05
        out.append(int(np.argmax((wt[:, None] * S[j]).sum(0))))
    for i in range(1, len(words) - 1):  # single-word flips inside another speaker's speech
        a, b = out[i - 1], out[i + 1]
        if a == b != out[i] and words[i]['s'] - words[i - 1]['e'] < 1 and words[i + 1]['s'] - words[i]['e'] < 1:
            out[i] = a
    return out


def _sample(segs):
    """A clean 4-8 s stretch from the speaker's longest turn."""
    seg = max(segs, key=lambda s: s['end'] - s['start'])
    W = seg['words']
    if seg['end'] - seg['start'] <= 8:
        return {'start': seg['start'], 'end': seg['end']}
    mid = (seg['start'] + seg['end']) / 2
    i = min(range(len(W)), key=lambda k: abs(W[k]['s'] - (mid - 4)))
    j = i
    while j + 1 < len(W) and W[j + 1]['e'] - W[i]['s'] <= 8:
        j += 1
    if W[j]['e'] - W[i]['s'] < 4:
        return {'start': seg['start'], 'end': round(seg['start'] + 8, 2)}
    return {'start': W[i]['s'], 'end': W[j]['e']}


def analyze(src_path, progress=None):
    progress = progress or (lambda stage, frac: None)
    progress('decoding', 0.0)
    encoder()  # fail fast, before minutes of transcription
    try:
        wav, dur = engine.to_wav(src_path)
    except Exception as e:
        raise ValueError(f'Could not read this file as audio ({type(e).__name__}). Try webm, m4a, mp3, wav or mp4.')
    try:
        audio = _read(wav)
    finally:
        os.unlink(wav)
    words = _transcribe(audio, progress)
    words = [w for w in words if w['w'].strip()]
    if not words:
        raise ValueError('No speech found in this recording.')
    progress('separating speakers', 0.85)
    wins = _windows(words, dur)
    E = _embed_many(audio, wins)
    lab = _cluster(E)
    vp = voiceprint()
    if vp and len(E):
        lab = _merge_me(E, lab, vp[0])
    k = int(lab.max()) + 1
    C = _centroids(E, lab, k)
    who = _assign(words, wins, E, C)
    segs = []
    for w, c in zip(words, who):
        x = {'w': w['w'], 's': round(float(w['s']), 2), 'e': round(float(w['e']), 2), 'p': round(float(w.get('p', 1.0)), 3)}
        if segs and segs[-1]['_c'] == c and w['s'] - segs[-1]['end'] < 3:
            segs[-1]['words'].append(x)
            segs[-1]['end'] = max(segs[-1]['end'], x['e'])
        else:
            segs.append({'_c': c, 'start': x['s'], 'end': x['e'], 'words': [x]})
    spk = []
    for c in sorted(set(who)):
        mine = [s for s in segs if s['_c'] == c]
        spk.append({'_c': c, 'seconds': round(float(sum(s['end'] - s['start'] for s in mine)), 1), 'words': sum(len(s['words']) for s in mine),
                    'turns': len(mine), 'similarity': round(float(_sim(C[c], vp[0])), 3) if vp else None, 'sample': _sample(mine)})
    spk.sort(key=lambda s: -s['seconds'])
    ids = {s['_c']: f'S{i + 1}' for i, s in enumerate(spk)}
    me = None
    if vp:
        best = max(spk, key=lambda s: s['similarity'])
        me = ids[best['_c']] if best['similarity'] >= ME_SIM else None
    for s in spk:
        s['id'] = ids[s.pop('_c')]
    for s in segs:
        s['speaker'] = ids[s.pop('_c')]
        s['text'] = ''.join(w['w'] for w in s['words']).strip()
    progress('done', 1.0)
    return {'duration': round(float(dur), 2), 'engine': engine.describe(), 'enrolled': vp is not None, 'me': me,
            'speakers': [{k: s[k] for k in ('id', 'seconds', 'words', 'turns', 'similarity', 'sample')} for s in spk],
            'segments': [{k: s[k] for k in ('speaker', 'start', 'end', 'text', 'words')} for s in segs]}
