import { S, save, logActivity, ensureArr, rememberText, $, esc, pick, shuffle, ensureMic, sleep, lineChart, toast } from '../core.js';
import { Listener, say, speechSupported, listenMode } from '../audio.js';
import { speechReport, tokenize, FILLER_WORDS, countFillers } from '../metrics.js';
import { FRESH_STARTS } from '../library.js';
import { TOPICS } from '../content.js';
import { LOCAL, postAudio } from '../local.js';
import { capture } from '../capture.js';
import { transcriptHtml, LEGEND, scoreBlock, media } from '../ui.js';
import { icon } from '../icons.js';

let tab = 'aware';

export function render(main, params = {}) {
  if (params.t) tab = params.t;
  main.innerHTML = `
    <p class="eyebrow"><a href="#/practice">Practice</a> · Fillers</p>
    <h1>Filler lab</h1>
    <p class="sub">Fillers are a habit, and habits are broken in three steps (habit reversal, which cut filled pauses in public speakers: Mancuso &amp; Miltenberger 2016): <b>notice</b> every one, <b>replace</b> it with a silent pause, then <b>practise</b> the moments they appear most, the start of a sentence.</p>
    ${listenMode() === 'local' ? '' : '<div class="card flat" style="margin-bottom:18px"><p class="warnc" style="margin:0">Browser speech recognition deletes most “um”s and “uh”s, so counts here are low. Start SpeakForge with <code>./start.sh</code> to use Whisper, which keeps them.</p></div>'}
    <div class="tabs"><button data-t="aware">1. Spot your fillers</button><button data-t="live">2. Filler-free minute</button><button data-t="starts">3. Fresh starts</button></div>
    <div id="pane"></div>`;
  main.querySelectorAll('.tabs button').forEach(b => { b.classList.toggle('on', b.dataset.t === tab); b.onclick = () => { tab = b.dataset.t; render(main); }; });
  ({ aware, live, starts })[tab]($('#pane'));
}

function asSession(mode, topic, r, rep) {
  const round = { speakSec: Math.round(r.speakSec), wpm: rep.wpm, freezes: r.freezes, recovered: r.recovered, selfRestarts: 0, repetitions: rep.mazes.repetitions, fillers: rep.fillers, vaguePer100: rep.vaguePer100, zonePct: r.zonePct, clarity: r.clarity, explainScore: rep.explainScore };
  S.sessions.push({ ts: Date.now(), mode, topic, rounds: [round] });
  rememberText(r.text, topic);
}

// 1. Awareness training: record, then catch your own fillers on playback.
function aware(pane) {
  const hist = (S.awareness || []).slice(-6);
  pane.innerHTML = `<div class="grid g2" style="align-items:start"><div class="card hl"><h2>Catch them on playback</h2>
    <p>Talk for 60 seconds. Then listen back and <b>tap the button (or press F) every time you hear a filler</b>: um, uh, like, basically, you know. SpeakForge checks how many you caught.</p>
    <p class="faint">Awareness is step one of habit reversal: you can’t stop a habit you don’t notice in the moment.</p>
    <button class="big" id="go">${icon('mic')} Record 60 seconds</button></div>
    <div class="card"><h2>Your awareness</h2>${hist.length ? `<table><tr><th>Date</th><th>Caught</th><th>Fillers</th><th>Accuracy</th></tr>${hist.reverse().map(h => `<tr><td>${new Date(h.ts).toLocaleDateString()}</td><td>${h.taps}</td><td>${h.detected}</td><td><b>${h.accuracy}%</b></td></tr>`).join('')}</table>` : '<p class="muted">No rounds yet. Goal: catch 80%+ of your fillers.</p>'}</div></div><div id="play"></div>`;
  $('#go').onclick = async () => {
    const topic = pick(TOPICS.medium);
    const r = await capture($('#play'), { secs: 60, prompt: topic, label: 'Record', fillerCue: false });
    if (!r || !pane.isConnected) return;
    if (!r.blob?.size) { $('#play').innerHTML = '<div class="card bad">No recording captured.</div>'; return; }
    const url = URL.createObjectURL(r.blob);
    $('#play').innerHTML = `<div class="card hl" style="text-align:center"><p class="eyebrow" style="justify-content:center">Now listen</p><h2>Tap every time you hear a filler</h2>
      <audio id="au" src="${url}" controls style="width:100%;margin:10px 0"></audio>
      <button class="big" id="tap" style="min-width:260px">Filler! <kbd>F</kbd></button><p class="big" id="tc" style="font-size:48px">0</p>
      <button class="ghost" id="donel">Done listening</button><p class="faint" id="ws"></p></div>`;
    const au = $('#au'), taps = [];
    let words = null;
    if (LOCAL.ok && LOCAL.whisper) {
      $('#ws').textContent = 'Whisper is finding your fillers in the background…';
      postAudio('transcribe', r.blob).then(t => { words = t.words; $('#ws').textContent = 'Whisper is ready to check your taps.'; }).catch(() => { $('#ws').textContent = ''; });
    }
    const tap = () => { taps.push(au.currentTime); $('#tc').textContent = taps.length; };
    $('#tap').onclick = tap;
    const onKey = e => { if (!pane.isConnected) return window.removeEventListener('keydown', onKey); if (e.key === 'f' || e.key === 'F') { e.preventDefault(); tap(); } };
    window.addEventListener('keydown', onKey);
    au.play().catch(() => {});
    const finish = async () => {
      window.removeEventListener('keydown', onKey);
      au.pause();
      for (let i = 0; i < 20 && LOCAL.ok && LOCAL.whisper && !words; i++) await sleep(500);
      let detected, hits = null, times = [];
      if (words) {
        times = words.filter(w => FILLER_WORDS.includes(tokenize(w.w)[0]) || /^(basically|like)$/i.test(w.w.trim().replace(/[^a-z]/gi, ''))).map(w => w.s);
        detected = times.length;
        const used = new Set();
        hits = taps.filter(t => { const i = times.findIndex((x, k) => !used.has(k) && t >= x - 0.4 && t <= x + 1.8); if (i >= 0) used.add(i); return i >= 0; }).length;
      } else detected = countFillers(r.text).total;
      const accuracy = detected === 0 ? (taps.length === 0 ? 100 : 0) : hits != null ? Math.round(100 * hits / Math.max(detected, taps.length)) : Math.round(100 * Math.min(taps.length, detected) / Math.max(taps.length, detected));
      ensureArr('awareness').push({ ts: Date.now(), taps: taps.length, detected, accuracy });
      const rep = speechReport(words ? words.map(w => w.w).join(' ') : r.text, r.speakSec);
      asSession('fillers', topic, r, rep);
      save();
      logActivity('awareness');
      $('#play').innerHTML = `<div class="grid g2" style="align-items:start"><div class="card hl">${scoreBlock(accuracy, 100, 'Awareness', `You tapped ${taps.length} times; there were ${detected} fillers${hits != null ? ` and you caught ${hits} of them at the right moment` : ''}.`)}
        <p style="margin-top:14px">${accuracy >= 80 ? '<span class="ok">Sharp ear. Now go to step 2 and replace them with pauses.</span>' : 'Listen again and tap. Most people hear only half their fillers at first; that improves fast.'}</p>
        <div class="row"><button id="again" class="ghost">Another round</button><a class="btn" href="#/fillers?t=live">Step 2 ${icon('arrow')}</a></div></div>
        <div class="card"><h2>Where they were</h2>${LEGEND}<div class="transcript">${transcriptHtml(words ? words.map(w => w.w.trim()).join(' ') : r.text)}</div>
        <p class="faint" style="margin-top:8px">${Object.entries(rep.fillerItems).map(([k, v]) => `${esc(k)} ×${v}`).join(' · ') || 'No fillers found.'}</p></div></div>`;
      $('#again').onclick = () => aware(pane);
    };
    $('#donel').onclick = finish;
    au.onended = () => toast('Press “Done listening” when ready');
  };
}

// 2. Competing response: speak a minute, every filler gets an instant "pause instead" cue.
function live(pane) {
  const fl = S.sessions.filter(s => s.mode === 'fillers-live').slice(-12).map(s => s.rounds[0]);
  pane.innerHTML = `<div class="grid g2" style="align-items:start"><div class="card hl"><h2>Filler-free minute</h2>
    <p>Talk for a minute. When an “um” is coming, do the <b>competing response</b>: close your lips, breathe in through your nose, then continue. A silent half-second sounds thoughtful; a filler sounds unsure.</p>
    <p class="faint">Each filler that gets through triggers a soft low tone and a “pause instead” card.</p>
    <div class="row"><select id="lv"><option value="easy">Everyday topics</option><option value="medium" selected>Opinions</option><option value="hard">Explain or argue</option></select>
    <button class="big" id="go">${icon('mic')} Start</button></div></div>
    <div class="card"><h2>Fillers per minute</h2><canvas id="fc"></canvas><p class="faint">Target: under 2 per minute by month 3.</p></div></div><div id="play"></div>`;
  lineChart($('#fc'), [{ label: 'fillers/min', values: fl.map(r => +(r.fillers / Math.max(r.speakSec / 60, 0.25)).toFixed(1)), color: '#b9a6ff' }]);
  $('#go').onclick = async () => {
    const topic = pick(TOPICS[$('#lv').value]);
    const r = await capture($('#play'), { secs: 60, prompt: topic, label: 'Filler-free minute', fillerCue: true });
    if (!r || !pane.isConnected) return;
    const rep = speechReport(r.text, r.speakSec);
    asSession('fillers-live', topic, r, rep);
    save();
    logActivity('fillers');
    const fpm = rep.fillersPerMin;
    $('#play').innerHTML = `<div class="grid g2" style="align-items:start"><div class="card hl">${scoreBlock(fpm, 10, 'Fillers per minute', fpm < 2 ? 'Excellent. Almost filler-free.' : fpm < 4 ? 'Good. Keep replacing them with pauses.' : 'Slow down a little. Pausing is allowed; fillers are not.', true)}
      <p class="faint" style="margin-top:12px">${Object.entries(rep.fillerItems).map(([k, v]) => `${esc(k)} ×${v}`).join(' · ') || 'No fillers detected.'}</p>
      <div class="row"><button id="again">Again</button><a class="btn ghost" href="#/fillers?t=starts">Fresh starts ${icon('arrow')}</a></div></div>
      <div class="card"><h2>Transcript</h2>${LEGEND}<div class="transcript">${transcriptHtml(r.text)}</div><br>${media(r.blob)}</div></div>`;
    $('#again').onclick = () => live(pane);
  };
}

// 3. Fresh starts: many short answers, each must begin with a breath and a real word.
function starts(pane) {
  pane.innerHTML = `<div class="card hl"><h2>Fresh starts</h2>
    <p>Fillers cluster at the start of a sentence, while your brain plans. Eight quick questions, 15 seconds each. Begin every answer with a <b>silent breath</b> and then a real first word: never “um”, “so” or “basically”.</p>
    <button class="big" id="go">${icon('play')} Start 8 questions</button></div><div id="play"></div>`;
  $('#go').onclick = async () => {
    if (!speechSupported() || !(await ensureMic())) { $('#play').innerHTML = '<div class="card bad">Needs speech recognition (Safari, Chrome or Edge, or ./start.sh).</div>'; return; }
    const qs = shuffle(FRESH_STARTS).slice(0, 8);
    const l = new Listener();
    l.start();
    await sleep(500);
    const results = [];
    for (let i = 0; i < qs.length && pane.isConnected; i++) {
      $('#play').innerHTML = `<br><div class="card" style="text-align:center"><span class="pill">${i + 1}/${qs.length}</span><div class="prompt">${esc(qs[i])}</div><p class="warnc">Breathe… then start with a real word.</p><div class="big" id="qt" style="font-size:52px">15</div><div class="transcript" id="qtr"></div><br><button class="ghost small" id="nx">Next</button></div>`;
      await new Promise(res => { say(qs[i], { rate: 1, onEnd: res }); setTimeout(res, 6000); });
      const mark = l.finalText.length;
      let next = false;
      $('#nx').onclick = () => { next = true; };
      for (let s = 15; s > 0 && !next && pane.isConnected; s--) { $('#qt').textContent = s; for (let k = 0; k < 4 && !next; k++) { await sleep(250); $('#qtr').textContent = (l.finalText.slice(mark) + ' ' + l.interim).trim(); } }
      await sleep(listenMode() === 'local' ? 900 : 400);
      const said = (l.finalText.slice(mark) + ' ' + l.interim).trim();
      const first = tokenize(said)[0] || '';
      results.push({ q: qs[i], said, clean: !!first && !FILLER_WORDS.includes(first) && !['so', 'basically', 'like', 'actually'].includes(first), fillers: countFillers(said).total });
    }
    await l.stop();
    if (!pane.isConnected) return;
    const clean = results.filter(r => r.clean).length;
    logActivity('fillers');
    $('#play').innerHTML = `<br><div class="card hl">${scoreBlock(clean, results.length, 'Clean starts', 'Answers that began with a real word, not a filler.')}<br>
      <table>${results.map(r => `<tr><td>${r.clean ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td><td class="muted">${esc(r.q)}</td><td>${transcriptHtml(r.said)}</td></tr>`).join('')}</table>
      <div class="row" style="margin-top:12px"><button id="again">Again</button></div></div>`;
    $('#again').onclick = () => starts(pane);
  };
}
