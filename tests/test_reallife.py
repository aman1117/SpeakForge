"""Real-life recording test (speaker separation + "which one is me"): .venv/bin/python tests/test_reallife.py [--perf]
Builds a synthetic two-person conversation with macOS voices, enrolls speaker A from different sentences,
checks the diarization against the known turn times, then exercises the HTTP endpoints of server.py.
--perf also times a ~5 minute, three-voice recording."""
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, 'tests', '.reallife_tmp')
os.environ['SPEAKFORGE_DATA'] = os.path.join(WORK, 'data')
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import reallife  # noqa: E402

SR = 16000
A, B, C = 'Samantha', 'Daniel', 'Moira'
TURNS = [
    (A, 'So I finally finished the quarterly report last night, and honestly the numbers look a lot better than we expected.'),
    (B, 'That is great news. Did the marketing team send you their final figures, or are we still waiting on them?'),
    (A, 'They sent most of it on Tuesday, but the regional breakdown is still missing, so I left a placeholder for now.'),
    (B, 'Okay, I can chase them this afternoon. I think Priya is the one who owns that spreadsheet these days.'),
    (A, 'Thanks, that would really help. I also want to move our review meeting to Thursday morning if that works for you.'),
    (B, 'Thursday morning is fine, although I have a dentist appointment at noon, so we should keep it under an hour.'),
    (A, 'Perfect, I will send a new invite and attach the draft so everyone can read it before we meet.'),
    (B, 'Sounds good. Let me know if you need help with the slides, I have a template from the last board presentation.'),
]
ENROLL = ('My morning usually starts with a long walk by the river and a strong cup of coffee. '
          'After that I read the news, answer a few emails, and plan the most important tasks for the rest of the day. '
          'On weekends I like cooking for friends and trying recipes from different countries.')
EXTRA = [
    'We should also talk about hiring, because the support team has been stretched very thin since the summer.',
    'I looked at the customer survey, and most complaints are about slow replies rather than the product itself.',
    'If we automate the first response, people would at least know that someone has seen their message.',
    'The budget for next year is tight, but there might be room for one more person if we drop the conference.',
    'Honestly I would rather skip the conference, the talks last year were not that useful for our team.',
    'Let us put that on the agenda for Thursday and see what the rest of the group thinks about it.',
]


def say(voice, text, name):
    p = os.path.join(WORK, name + '.wav')
    subprocess.run(['say', '-v', voice, '-o', p, '--data-format=LEI16@16000', text], check=True)
    return reallife._read(p)


def build(turns, name, seed=0):
    """Concatenate turns with short gaps; returns (wav path, [(voice, start, end)])."""
    rng = np.random.default_rng(seed)
    parts, truth, t = [np.zeros(int(0.5 * SR), np.float32)], [], 0.5
    for i, (v, text) in enumerate(turns):
        a = say(v, text, f'{name}_{i}')
        truth.append((v, t, t + len(a) / SR))
        gap = np.zeros(int(rng.uniform(0.3, 0.9) * SR), np.float32)
        parts += [a, gap]
        t += (len(a) + len(gap)) / SR
    audio = np.concatenate(parts)
    audio += rng.normal(0, 0.002, len(audio)).astype(np.float32)  # faint room noise
    p = os.path.join(WORK, name + '.wav')
    reallife._write(p, audio)
    return p, truth


def accuracy(res, truth, me_voice):
    """Share of words whose speaker matches the turn they fall in (me <-> me_voice, others by majority)."""
    words = [(w, s['speaker']) for s in res['segments'] for w in s['words']]
    gt = []
    for w, _ in words:
        m = (w['s'] + w['e']) / 2
        gt.append(min(truth, key=lambda x: 0 if x[1] <= m <= x[2] else min(abs(m - x[1]), abs(m - x[2])))[0])
    mapping = {}
    for spk in {s for _, s in words}:
        votes = [g for (_, s), g in zip(words, gt) if s == spk]
        mapping[spk] = max(set(votes), key=votes.count)
    if res['me']:
        mapping[res['me']] = me_voice
    ok = sum(mapping[s] == g for (_, s), g in zip(words, gt))
    return ok / len(words), mapping


def check_shape(res):
    for k in ('duration', 'engine', 'enrolled', 'me', 'speakers', 'segments'):
        assert k in res, k
    for s in res['speakers']:
        assert set(s) == {'id', 'seconds', 'words', 'turns', 'similarity', 'sample'}, s
        assert 0 <= s['sample']['start'] < s['sample']['end'] <= res['duration'] + 0.5
    for g in res['segments']:
        assert set(g) == {'speaker', 'start', 'end', 'text', 'words'} and g['words']
        assert set(g['words'][0]) == {'w', 's', 'e', 'p'}
    json.dumps(res)


def direct():
    conv, truth = build(TURNS, 'conv')
    a_enroll = say(A, ENROLL, 'enroll_a')
    p_enroll = os.path.join(WORK, 'enroll_a.wav')
    t0 = time.time()
    e = reallife.enroll(p_enroll)
    print(f'enroll: {e} in {time.time() - t0:.1f}s ({len(a_enroll) / SR:.1f}s clip)')
    stages = []
    t0 = time.time()
    res = reallife.analyze(conv, progress=lambda s, f: stages.append((s, round(f, 2))))
    took = time.time() - t0
    check_shape(res)
    acc, mapping = accuracy(res, truth, A)
    print(f'analyze: {res["duration"]:.0f}s audio in {took:.1f}s; stages {[s for s, _ in stages]}')
    for s in res['speakers']:
        print(f"  {s['id']} -> {mapping[s['id']]}: {s['seconds']}s, {s['words']} words, {s['turns']} turns, sim {s['similarity']}")
    print(f'  me={res["me"]}  word accuracy {acc:.1%}')
    assert len(res['speakers']) == 2, res['speakers']
    assert res['me'] and mapping[res['me']] == A
    assert acc >= 0.85, acc
    assert [s for s, _ in stages][0] == 'decoding' and stages[-1] == ('done', 1.0)

    reallife.forget()
    assert reallife.voiceprint() is None
    res = reallife.analyze(conv)
    assert res['me'] is None and not res['enrolled'] and len(res['speakers']) == 2
    try:
        reallife.enroll(os.path.join(WORK, 'conv_0.wav'))
        raise AssertionError('short enrollment accepted')
    except ValueError as ex:
        print('short enroll ->', ex)
    silent = os.path.join(WORK, 'silent.wav')
    reallife._write(silent, np.zeros(SR // 2, np.float32))
    try:
        reallife.analyze(silent)
        raise AssertionError('silence accepted')
    except ValueError as ex:
        print('silence ->', ex)
    one = reallife.analyze(os.path.join(WORK, 'conv_1.wav'))
    assert len(one['speakers']) == 1 and one['me'] is None, one['speakers']
    reallife.enroll(p_enroll)
    one = reallife.analyze(os.path.join(WORK, 'conv_0.wav'))
    assert len(one['speakers']) == 1 and one['me'] == 'S1', one['speakers']
    print('short single-speaker clips: ok')


def http():
    port = (lambda s: (s.bind(('127.0.0.1', 0)), s.getsockname()[1], s.close())[1])(socket.socket())
    env = dict(os.environ, SPEAKFORGE_PORT=str(port), SPEAKFORGE_DATA=os.path.join(WORK, 'http'))
    log = open(os.path.join(WORK, 'server.log'), 'w+')
    proc = subprocess.Popen([sys.executable, os.path.join(ROOT, 'server.py')], env=env, stdout=log, stderr=subprocess.STDOUT)
    base = f'http://127.0.0.1:{port}'

    def call(method, path, body=None, ctype='audio/wav'):
        r = urllib.request.Request(base + path, data=body, method=method, headers={'Content-Type': ctype} if body else {})
        try:
            with urllib.request.urlopen(r, timeout=600) as resp:
                return resp.status, json.load(resp)
        except urllib.error.HTTPError as e:
            return e.code, json.load(e)

    try:
        for _ in range(240):
            try:
                if call('GET', '/api/status')[1].get('ready'):
                    break
            except OSError:
                pass
            time.sleep(0.5)
        st = call('GET', '/api/status')[1]
        assert st['speaker_id'] is True and st['enrolled'] is False, st
        read = lambda n: open(os.path.join(WORK, n), 'rb').read()  # noqa: E731
        assert call('GET', '/api/enroll')[1]['enrolled'] is False
        code, out = call('POST', '/api/enroll', read('conv_0.wav'))
        assert code == 422 and 'seconds of speech' in out['error'], (code, out)
        code, out = call('POST', '/api/enroll', read('enroll_a.wav'))
        assert code == 200 and out['ok'], out
        g = call('GET', '/api/enroll')[1]
        assert g['enrolled'] and g['seconds'] >= 8 and g['ts'], g
        assert call('GET', '/api/status')[1]['enrolled'] is True
        t0 = time.time()
        code, out = call('POST', '/api/reallife', read('conv.wav'))
        assert code == 200 and out['job'], out
        seen = set()
        while True:
            code, j = call('GET', '/api/job?id=' + out['job'])
            assert code == 200, j
            if j['status'] != 'running':
                break
            seen.add(j['stage'])
            assert 0 <= j['progress'] <= 1
            time.sleep(0.3)
        assert j['status'] == 'done', j
        check_shape(j['result'])
        assert len(j['result']['speakers']) == 2 and j['result']['me'], j['result']['speakers']
        print(f'HTTP reallife job: {time.time() - t0:.1f}s, stages seen {sorted(seen)}, me={j["result"]["me"]}')
        reallife._write(os.path.join(WORK, 'silent.wav'), np.zeros(SR // 2, np.float32))
        jid = call('POST', '/api/reallife', read('silent.wav'))[1]['job']
        while (j := call('GET', '/api/job?id=' + jid)[1])['status'] == 'running':
            time.sleep(0.2)
        assert j['status'] == 'error' and 'No speech' in j['error'], j
        assert call('GET', '/api/job?id=nope')[0] == 404
        assert call('DELETE', '/api/enroll')[1]['ok'] and call('GET', '/api/enroll')[1]['enrolled'] is False
        code, t = call('POST', '/api/transcribe', read('conv_0.wav'))
        assert code == 200 and 'report' in t['text'].lower(), t
        print('HTTP endpoints: ok')
    except BaseException:
        log.seek(0)
        print('server log:\n' + log.read()[-3000:])
        raise
    finally:
        proc.terminate()
        proc.wait(10)
        log.close()


def perf():
    rng = np.random.default_rng(1)
    pool = [t for _, t in TURNS] + EXTRA
    turns = []
    while sum(len(t) for _, t in turns) < 4700:  # ~5 minutes of speech at ~15 chars/s
        turns.append(([A, B, C][len(turns) % 3] if rng.random() > 0.3 else [A, B, C][rng.integers(3)], pool[rng.integers(len(pool))]))
    conv, truth = build(turns, 'long', seed=1)
    reallife.enroll(os.path.join(WORK, 'enroll_a.wav'))
    marks = []
    t0 = time.time()
    res = reallife.analyze(conv, progress=lambda s, f: marks.append((s, time.time() - t0)))
    took = time.time() - t0
    acc, mapping = accuracy(res, truth, A)
    stage_t = {s: round(t, 1) for s, t in marks}
    print(f'perf: {res["duration"] / 60:.1f} min, 3 voices -> {took:.1f}s total ({took / (res["duration"] / 60):.1f}s per audio minute); stage starts {stage_t}')
    print(f'  speakers {[(s["id"], mapping[s["id"]], s["seconds"], s["similarity"]) for s in res["speakers"]]}, me={res["me"]}, accuracy {acc:.1%}')
    assert len(res['speakers']) == 3 and mapping[res['me']] == A and acc >= 0.85


def main():
    shutil.rmtree(WORK, ignore_errors=True)
    os.makedirs(WORK)
    try:
        t0 = time.time()
        reallife.encoder()
        print(f'ECAPA loaded in {time.time() - t0:.1f}s')
        direct()
        if '--perf' in sys.argv:
            perf()
        http()
        print('ALL OK')
    finally:
        shutil.rmtree(WORK, ignore_errors=True)


if __name__ == '__main__':
    main()
