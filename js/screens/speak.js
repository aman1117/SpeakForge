import { S, save, logActivity, addToDeck, rememberText, $, esc, pick, shuffle, mic, ensureMic, meterHtml, setMeter, fmtTime, toast, sleep } from '../core.js';
import { loop, calibrate, Recorder, Listener, speechSupported, saveRecording, say, cue, openCamera, listenMode } from '../audio.js';
import { VoiceTracker, speechThreshold, countWords, wordsPerMinute, pauseStats, findRepetitions, countFillers, coachNotes, sentenceLengths, avgConfidence, speechReport } from '../metrics.js';
import { TOPICS, RESCUE_PHRASES, BRIDGE_TIPS, QUESTIONS, BENCHMARK_TOPIC, READING_PASSAGES } from '../content.js';
import { aiReady, chatJson, feedbackMessages, parseFeedback, FEEDBACK_SCHEMA } from '../ai.js';
import { Spotlight } from '../stage.js';
import { LOCAL, postAudio } from '../local.js';
import { compareTable } from './theo.js';
import { sighSession } from './calm.js';
import { transcriptHtml, LEGEND, media } from '../ui.js';
import { icon } from '../icons.js';

const R_PASSAGE = READING_PASSAGES[READING_PASSAGES.length - 1];

export const MODES = {
  oneMin: { name: '1-minute random topic (Mona’s daily drill)', kind: 'speak', rounds: [60] },
  noRestart: { name: 'No-Restart challenge (2 min, bridge every freeze)', kind: 'speak', rounds: [120], rule: 'Never restart a sentence. Lost a word? Describe it, simplify, or skip it, and keep the SAME sentence going. Press SPACE if you catch yourself restarting.' },
  questions: { name: 'Question chain: 5 surprise questions (Toastmasters Table Topics)', kind: 'speak', rounds: [40, 40, 40, 40, 40], questions: true },
  quick432: { name: 'Quick 4/3/2: same talk, less time (2 → 1.5 → 1 min)', kind: 'speak432', rounds: [120, 90, 60] },
  fourThreeTwo: { name: '4/3/2 full (4 → 3 → 2 min)', kind: 'speak432', rounds: [240, 180, 120] },
  tenWord: { name: '10-word sentences (stop rambling)', kind: 'speak', rounds: [60], rule: 'Max 10 words per sentence. Short. Clear. Pause. Next.' },
  prep: { name: 'PREP: Point, Reason, Example, Point', kind: 'speak', rounds: [60], stages: [['Point', .18], ['Reason', .27], ['Example', .35], ['Point again', .2]] },
  creator: { name: 'Creator reel: Hook, Point, Opinion, Call to action', kind: 'speakCreator', rounds: [60], stages: [['Hook (5 s!)', .1], ['Point', .45], ['Opinion', .28], ['Call to action', .17]] },
  benchmark: { name: 'Weekly benchmark (same topic + R passage)', kind: 'benchmark', rounds: [120], benchmark: true },
};
const AUD = ['No audience', '1 · One friend', '2 · Team stand-up', '3 · Classroom', '4 · Conference room', '5 · Auditorium', '6 · Tough crowd'];

let topic = null;

export function render(main, params = {}) {
  const st = S.settings;
  const modeOpts = Object.entries(MODES).map(([k, m]) => `<option value="${k}" ${params.mode === k ? 'selected' : ''}>${m.name}</option>`).join('');
  const hook = params.hook || '';
  const aud = params.aud != null ? +params.aud : (st.audience || 0);
  main.innerHTML = `
    <p class="eyebrow">Speak</p>
    <h1>Step onto the stage</h1>
    <p class="sub">Talk without stopping. If a word disappears, a cue appears with a phrase that keeps your sentence alive. Fillers get a soft tone. Afterwards: one thing to fix, and a redo.</p>
    <div class="grid g2" style="align-items:start">
      <div class="card hl">
        <p class="eyebrow">Your topic</p>
        <div class="prompt" id="topic" style="text-align:left;margin:0;padding:4px 0 14px"></div>
        ${hook ? `<p class="warnc">Open with Theo’s hook pattern: “${esc(hook)}”</p>` : ''}
        <div class="row"><button class="ghost small" id="spin">Another topic</button><input id="custom" placeholder="Or type your own topic" style="flex:1;min-width:180px" value=""></div>
        <div class="row" style="margin-top:18px"><button class="big" id="go">${icon('mic')} Start speaking</button><span class="faint">Open with your point in one sentence.</span></div>
      </div>
      <div class="card">
        <h2>How you’ll practise</h2>
        <select id="mode" style="width:100%">${modeOpts}</select>
        <div class="row" style="margin-top:12px"><label>Topics</label>
          <select id="diff"><option value="easy">Everyday</option><option value="medium" selected>Opinions</option><option value="hard">Explain or argue</option><option value="creator" ${params.mode === 'creator' ? 'selected' : ''}>Reels</option></select></div>
        <div class="row" style="margin-top:12px"><label>Audience</label><select id="aud">${AUD.map((a, i) => `<option value="${i}" ${i === aud ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
        <div class="row" style="margin-top:12px"><label>Plan first</label><div class="choice">${[0, 15, 30].map(s => `<label><input type="radio" name="plan" value="${s}" ${s === (params.plan != null ? +params.plan : 15) ? 'checked' : ''}>${s ? s + ' s' : 'No'}</label>`).join('')}</div></div>
        <details style="margin-top:14px"><summary>More options</summary>
          <div class="row" style="margin-top:10px"><label>Rescue cue after</label>
            <select id="bms">${[1200, 1800, 2500, 3500].map(v => `<option value="${v}" ${st.bridgeMs === v ? 'selected' : ''}>${v / 1000} s of silence</option>`).join('')}</select></div>
          <div class="row" style="margin-top:10px">
            <label><input type="checkbox" id="cue" ${st.cue ? 'checked' : ''}> Soft sounds with cues</label>
            <label><input type="checkbox" id="lf" ${st.liveFillers !== false ? 'checked' : ''}> Live filler cue</label>
            <label><input type="checkbox" id="cam" ${st.camera ? 'checked' : ''}> Film me</label>
            <label><input type="checkbox" id="rit" ${st.ritual ? 'checked' : ''}> 30 s calm reset first</label></div>
        </details>
        <p class="faint" style="margin-top:14px">${S.volume.baseline == null ? 'Calibrate your volume in <a href="#/calm?t=zone">Calm → Volume</a> to get “speak up” cues.' : 'Volume cues are on.'}</p>
        <label>How nervous are you right now? <b id="anxv">5</b> of 10</label><br>
        <input type="range" id="anx" min="0" max="10" value="5" style="width:100%">
      </div>
    </div>`;
  const spin = () => {
    const m = MODES[$('#mode').value];
    if (m.benchmark) topic = BENCHMARK_TOPIC;
    else if (m.questions) topic = 'Five surprise questions, read aloud one at a time';
    else topic = pick(TOPICS[$('#diff').value]);
    $('#topic').textContent = topic;
  };
  spin();
  if (hook) { $('#custom').value = hook; $('#topic').textContent = hook; }
  $('#mode').onchange = spin;
  $('#spin').onclick = spin;
  $('#diff').onchange = spin;
  $('#anx').oninput = e => { $('#anxv').textContent = e.target.value; };
  $('#go').onclick = () => {
    Object.assign(S.settings, { bridgeMs: +$('#bms').value, cue: $('#cue').checked, camera: $('#cam').checked, ritual: $('#rit').checked, liveFillers: $('#lf').checked, audience: +$('#aud').value });
    save();
    const m = $('#mode').value;
    const plan = +(main.querySelector('input[name=plan]:checked')?.value || 0);
    run(main, m, MODES[m].benchmark ? BENCHMARK_TOPIC : ($('#custom').value.trim() || topic), +$('#anx').value, { aud: +$('#aud').value, plan });
  };
}

async function ritual(main) {
  main.innerHTML = `<div class="card hl" style="text-align:center"><p class="eyebrow" style="justify-content:center">Calm reset · 30 seconds</p><div class="breath"></div><div class="prompt" id="bp">Ready</div><p class="faint" id="bl"></p>
    <p style="font-size:18px">Then say out loud: <b>“I am excited.”</b></p><button class="ghost small" id="skipr">Skip</button></div>`;
  let skip = false;
  $('#skipr').onclick = () => { skip = true; };
  const card = main.firstElementChild;
  await Promise.race([sighSession(card, 30), new Promise(res => { const iv = setInterval(() => { if (skip || !card.isConnected) { clearInterval(iv); res(); } }, 200); })]);
}

async function planScreen(main, topicText, mode, secs) {
  if (!secs) return;
  let go = false;
  const parts = mode.stages ? mode.stages.map(s => s[0]) : ['Main point', 'Reason or story', 'Example'];
  for (let s = secs; s > 0 && !go && main.isConnected; s--) {
    if (s === secs) {
      main.innerHTML = `<div class="card hl"><p class="eyebrow">Plan · keywords in your head, not sentences</p><div class="prompt" style="text-align:left;padding:0 0 10px;margin:0">${esc(topicText)}</div>
        <p>${parts.map((p, i) => `<span class="pill">${i + 1}. ${esc(p)}</span>`).join(' ')}</p><div class="row"><div class="big" id="ps" style="font-size:52px;margin:0">${s}</div><span class="spacer"></span><button id="pgo">I’m ready ${icon('arrow')}</button></div></div>`;
      $('#pgo').onclick = () => { go = true; };
    }
    $('#ps').textContent = s;
    await sleep(1000);
  }
}

async function run(main, modeKey, topicText, anxBefore, opts = {}) {
  const mode = MODES[modeKey];
  if (!(await ensureMic())) return;
  if (!speechSupported()) toast('Speech recognition needs Safari, Chrome or Edge. Timing still works.');
  let cam = null;
  if (S.settings.camera) {
    try { cam = await openCamera(); } catch { toast('Camera unavailable. Continuing with audio only.'); }
  }
  if (S.settings.ritual && !opts.fix) await ritual(main);
  if (!mode.questions) await planScreen(main, topicText, mode, opts.plan || 0);
  main.innerHTML = '<div class="card" style="text-align:center"><div class="big" id="cd">3</div><p class="muted">Stay quiet a moment. Measuring room noise…</p></div>';
  const noiseP = calibrate(mic, 2400);
  for (let i = 3; i > 0; i--) { $('#cd').textContent = i; await sleep(800); }
  const threshold = speechThreshold(await noiseP);
  const topics = mode.questions ? shuffle(QUESTIONS).slice(0, mode.rounds.length) : mode.rounds.map(() => topicText);
  const results = [];
  for (let r = 0; r < mode.rounds.length; r++) {
    if (!main.isConnected) return;
    if (mode.questions) await askQuestion(main, topics[r], r, mode.rounds.length);
    else if (r > 0) await breakScreen(main, r, mode.rounds[r]);
    results.push(await round(main, mode, topics[r], mode.rounds[r], threshold, r, mode.rounds.length, cam, opts));
  }
  cam?.close();
  await showResults(main, modeKey, mode.questions ? 'Question chain' : topicText, results, anxBefore, topics, opts);
}

async function askQuestion(main, q, r, n) {
  main.innerHTML = `<div class="card" style="text-align:center"><span class="pill">Question ${r + 1}/${n}</span><div class="prompt">${esc(q)}</div><p class="muted">Listen… then answer when the timer starts. Point first.</p></div>`;
  await new Promise(res => { say(q, { rate: 0.95, onEnd: res }); setTimeout(res, 9000); });
  await sleep(300);
}

async function breakScreen(main, r, secs) {
  let skip = false;
  for (let i = 10; i > 0 && !skip && main.isConnected; i--) {
    main.innerHTML = `<div class="card" style="text-align:center"><h2>Round ${r + 1}: same topic, only ${fmtTime(secs)}</h2>
      <p>Say the <b>same ideas faster</b>, with <b>fewer freezes</b>. Reuse the phrases that worked. (Nation’s 4/3/2: repeating under time pressure builds fluency.)</p><div class="big">${i}</div>
      <button class="ghost" id="skipb">Start now</button></div>`;
    $('#skipb').onclick = () => { skip = true; };
    await sleep(1000);
  }
}

function round(main, mode, topicText, secs, threshold, r, total, cam, opts) {
  return new Promise(resolve => {
    const st = S.settings;
    const base = S.volume.baseline;
    const zone = base != null ? [base + 4, base + 14] : null;
    const aud = opts.aud || 0;
    const rule = opts.fix ? `This time: ${opts.fix}` : mode.rule;
    const stagesHtml = mode.stages ? `<div class="stage" id="stg">${mode.stages.map(s => `<span>${s[0]}</span>`).join('')}</div><br>` : '';
    main.innerHTML = `
      <div class="card onair ${aud ? 'with-crowd' : ''}">
        ${aud ? '<canvas class="crowd" id="crowd" aria-hidden="true"></canvas>' : '<canvas class="spotlight" id="spot" aria-hidden="true"></canvas>'}
        <div class="stage-ui">
        <div class="row"><span class="pill on">${total > 1 ? `${mode.questions ? 'Question' : 'Round'} ${r + 1} of ${total}` : 'On stage'}</span><span class="spacer"></span><button class="ghost small" id="rst" title="Press when you catch yourself restarting a sentence">I restarted <kbd>space</kbd></button><button class="red small" id="stop">Finish</button></div>
        <div class="grid ${cam ? 'g2' : ''}" style="align-items:center;margin-top:14px">
          ${cam ? '<video id="camv" autoplay muted playsinline style="width:100%;max-height:440px;border-radius:20px;transform:scaleX(-1);background:#000;object-fit:cover"></video>' : ''}
          <div>
            <div class="prompt">${esc(topicText)}</div>
            ${rule ? `<p style="text-align:center;max-width:52ch;margin:0 auto 10px" class="warnc">${esc(rule)}</p>` : ''}
            ${stagesHtml}
            <div class="big" id="timer">${fmtTime(secs)}</div>
            <div style="max-width:420px;margin:0 auto">${meterHtml('lvl', zone)}</div>
            <p class="faint" id="status" style="text-align:center;margin-top:12px">${listenMode() === 'local' && !LOCAL.ready ? 'The speech engine is still loading on your computer; your words will appear in a moment.' : aud ? 'They’re waiting for you. Begin when ready.' : 'The light follows your voice. Begin when ready.'}</p>
            <div id="nudge" style="min-height:26px;text-align:center"></div>
            <div id="bridge" style="min-height:104px;max-width:560px;margin:0 auto"></div>
            <div id="rpass"></div>
          </div>
        </div>
        <div class="row faint" style="justify-content:center;gap:22px;margin:8px 0 12px"><span>Freezes <b id="fz">0</b></span><span>Recovered <b id="rc">0</b></span><span>Restarts <b id="sr">0</b></span><span>Fillers <b id="fl">0</b></span><span>Words <b id="wc">0</b></span></div>
        </div>
        ${aud ? '' : '<div class="transcript" id="tr"><span class="faint">Your words appear here as you speak.</span></div>'}
      </div>`;
    const spot = aud ? null : new Spotlight($('#spot'));
    let crowd = null;
    if (aud) import('../audience.js').then(m => { if (!ended) { crowd = new m.Audience($('#crowd'), { level: aud, sound: true }); crowd.start(); } }).catch(e => console.warn('audience unavailable', e));
    if (cam) $('#camv').srcObject = cam.stream;
    const tracker = new VoiceTracker({ thresholdDb: threshold });
    let freezes = 0, recovered = 0, selfRestarts = 0, inFreeze = false, freezeStart = 0, ended = false, lastT = 0, lastNudge = -1e9, rpassShown = false, lastFill = 0, flashT = 0;
    const listener = new Listener({ onText: t => {
      $('#tr').textContent = t; $('#wc').textContent = countWords(t);
      const f = countFillers(t).total;
      if (f > lastFill && st.liveFillers !== false && !inFreeze) { flashT = performance.now(); $('#bridge').innerHTML = '<div class="bridge fillerflash"><span class="muted">Filler</span><b>Pause instead. Lips closed, breathe, continue.</b></div>'; if (st.cue) cue(330, 90); }
      lastFill = f; $('#fl').textContent = f;
    } });
    listener.start();
    const recStream = cam ? new MediaStream([...cam.stream.getVideoTracks(), ...mic.stream.getAudioTracks()]) : mic.stream;
    const recorder = new Recorder(recStream, !!cam);
    recorder.start();
    const recent = [];
    const card = main.firstElementChild;
    const onKey = e => {
      if (!card.isConnected) { window.removeEventListener('keydown', onKey); return; }
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); selfRestarts++; $('#sr').textContent = selfRestarts; }
    };
    window.addEventListener('keydown', onKey);
    $('#rst').onclick = e => { e.currentTarget.blur(); selfRestarts++; $('#sr').textContent = selfRestarts; };
    const stopLoop = loop(mic, (db, t) => {
      if (ended) return;
      if (!card.isConnected) { finish(); return; }
      lastT = t;
      setMeter('lvl', db);
      const silence = tracker.update(db, t, zone);
      const left = secs - t / 1000;
      $('#timer').textContent = fmtTime(Math.max(0, left));
      if (mode.stages) {
        let acc = 0;
        const frac = t / 1000 / secs;
        const idx = mode.stages.findIndex(s => (acc += s[1]) > frac);
        document.querySelectorAll('#stg span').forEach((sp, i) => sp.classList.toggle('on', i === (idx < 0 ? mode.stages.length - 1 : idx)));
      }
      if (mode.benchmark && !rpassShown && t > 60000) {
        rpassShown = true;
        $('#rpass').innerHTML = `<div class="card flat"><b>Now read aloud:</b><p class="passage">${esc(R_PASSAGE)}</p></div>`;
      }
      if (db >= threshold) recent.push([t, db]);
      while (recent.length && recent[0][0] < t - 4000) recent.shift();
      if (zone && recent.length > 40 && t - lastNudge > 8000) {
        const a = recent.reduce((s, x) => s + x[1], 0) / recent.length;
        if (a < base + 2) {
          lastNudge = t;
          $('#nudge').innerHTML = '<b class="warnc">Speak up! Talk to the back of the room</b>';
          if (st.cue) cue(440, 120);
          setTimeout(() => { $('#nudge').innerHTML = ''; }, 3000);
        }
      }
      if (silence > st.bridgeMs && !inFreeze) {
        inFreeze = true; freezes++; freezeStart = t;
        const p = pick(RESCUE_PHRASES);
        $('#bridge').innerHTML = `<div class="bridge"><span class="muted">Lost the word? Keep the sentence going:</span><b>“${esc(p.phrase)}”</b><span class="faint">${esc(p.use)}. ${esc(pick(BRIDGE_TIPS))}</span></div>`;
        $('#fz').textContent = freezes;
        if (st.cue) cue(660, 140);
      }
      if (inFreeze && silence === 0) {
        inFreeze = false;
        if (t - freezeStart < 6000) { recovered++; $('#rc').textContent = recovered; }
        $('#bridge').innerHTML = '';
      } else if (!inFreeze && flashT && performance.now() - flashT > 2200) { flashT = 0; $('#bridge').innerHTML = ''; }
      if (left <= 0) finish();
      const m = inFreeze ? 'freeze' : t - lastNudge < 3000 ? 'quiet' : db >= threshold ? 'speaking' : 'idle';
      spot?.feed(db, threshold, m);
      crowd?.feed(db, threshold, m);
    });
    $('#stop').onclick = () => finish();
    async function finish() {
      if (ended) return;
      ended = true;
      stopLoop();
      window.removeEventListener('keydown', onKey);
      $('#status').textContent = 'Processing…';
      try { crowd?.applause(); } catch { /* ignore */ }
      const [text, blob] = await Promise.all([listener.stop(), recorder.stop()]);
      setTimeout(() => crowd?.stop(), 4000);
      const speakSec = tracker.firstVoiceT == null ? 0 : (lastT - tracker.firstVoiceT) / 1000;
      resolve({ secs, text, blob, speakSec, pauses: tracker.pauses, freezes, recovered, selfRestarts, avgDb: tracker.avgVoicedDb(), zonePct: zone ? tracker.zonePct() : null, clarity: avgConfidence(listener.confs), video: !!cam });
    }
  });
}

export function metricsOf(r) {
  const words = countWords(r.text);
  const ps = pauseStats(r.pauses, r.speakSec);
  const reps = findRepetitions(r.text);
  const fill = countFillers(r.text);
  const sl = sentenceLengths(r.text);
  const rep = speechReport(r.text, r.speakSec);
  const base = S.volume.baseline;
  const restarts = Math.max(reps.length, r.selfRestarts || 0);
  return {
    words, wpm: wordsPerMinute(words, r.speakSec), speakSec: Math.round(r.speakSec),
    pausesPerMin: ps.perMin, longPausesPerMin: ps.longPerMin, longestPauseMs: ps.longestMs,
    freezes: r.freezes, recovered: r.recovered, selfRestarts: r.selfRestarts || 0,
    repetitions: reps.length, repList: reps, fillers: fill.total, fillerItems: fill.items,
    maxSentence: sl.length ? Math.max(...sl) : 0,
    avgDb: r.avgDb == null ? null : +r.avgDb.toFixed(1),
    loudnessDelta: base != null && r.avgDb != null ? +(r.avgDb - base).toFixed(1) : undefined,
    zonePct: r.zonePct, clarity: r.clarity,
    restartsPerMin: r.speakSec > 0 ? +(restarts / (r.speakSec / 60)).toFixed(1) : 0,
    vaguePer100: rep.vaguePer100, vagueItems: rep.lex.vagueItems, diversity: rep.diversity, explainScore: rep.explainScore, mazes: rep.mazes.total,
  };
}

export function aggregate(ms) {
  const sum = k => ms.reduce((a, m) => a + (m[k] || 0), 0);
  const speakSec = sum('speakSec');
  const clar = ms.map(m => m.clarity).filter(c => c != null);
  const zones = ms.map(m => m.zonePct).filter(z => z != null);
  const vag = ms.map(m => m.vaguePer100).filter(v => v != null);
  return {
    ...ms[0], words: sum('words'), speakSec, wpm: wordsPerMinute(sum('words'), speakSec), freezes: sum('freezes'), recovered: sum('recovered'),
    selfRestarts: sum('selfRestarts'), repetitions: sum('repetitions'), fillers: sum('fillers'), fillerItems: {}, repList: [], vagueItems: {},
    longestPauseMs: Math.max(...ms.map(m => m.longestPauseMs)),
    longPausesPerMin: +(ms.reduce((a, m) => a + m.longPausesPerMin * m.speakSec, 0) / Math.max(1, speakSec)).toFixed(1),
    clarity: clar.length ? Math.round(clar.reduce((a, b) => a + b, 0) / clar.length) : null,
    zonePct: zones.length ? Math.round(zones.reduce((a, b) => a + b, 0) / zones.length) : null,
    vaguePer100: vag.length ? +(vag.reduce((a, b) => a + b, 0) / vag.length).toFixed(1) : null,
  };
}

async function showResults(main, modeKey, topicText, results, anxBefore, topics, opts) {
  const mode = MODES[modeKey];
  const ms = results.map(metricsOf);
  const multiQ = !!mode.questions;
  const agg = multiQ ? aggregate(ms) : ms[ms.length - 1];
  const fullText = multiQ ? results.map((r, i) => `[Q${i + 1}: ${topics[i]}] ${r.text}`).join('\n') : results[results.length - 1].text;
  const lastR = results[results.length - 1];
  const session = { ts: Date.now(), mode: modeKey, topic: topicText, rounds: (multiQ ? [agg] : ms).map(({ repList, fillerItems, vagueItems, ...rest }) => rest), anxBefore, aud: opts.aud || 0 };
  S.sessions.push(session);
  rememberText(results.map(r => r.text).join(' '), topicText);
  save();
  logActivity(mode.kind);
  const ts = Date.now();
  for (const [i, r] of results.entries()) {
    if (r.blob && r.blob.size) {
      try { await saveRecording({ id: `${ts}-${i}`, ts, kind: mode.kind, video: r.video, title: `${mode.name.split(/[(:]/)[0].trim()}: ${multiQ ? topics[i] : topicText}${results.length > 1 && !multiQ ? ` (round ${i + 1})` : ''}`, blob: r.blob, metrics: ms[i] }); } catch { /* storage full */ }
    }
  }
  const mins = Math.max(agg.speakSec / 60, 0.25);
  const restartVal = m => Math.max(m.repetitions, m.selfRestarts || 0);
  const notes = coachNotes({ ...agg, repetitions: restartVal(agg) });
  const kpi = m => `<div class="kpi">
      <div><b>${m.wpm}</b><span class="muted">words/min</span></div>
      <div><b class="${m.freezes / mins > 2 ? 'warnc' : ''}">${m.freezes}</b><span class="muted">freezes (${m.recovered} recovered)</span></div>
      <div><b class="${restartVal(m) > 2 ? 'bad' : 'ok'}">${restartVal(m)}</b><span class="muted">restarts</span></div>
      <div><b class="${m.fillers / mins > 3 ? 'bad' : 'ok'}">${(m.fillers / mins).toFixed(1)}</b><span class="muted">fillers/min</span></div>
      <div><b class="${m.vaguePer100 > 4 ? 'warnc' : 'ok'}">${m.vaguePer100 ?? '–'}</b><span class="muted">vague words/100</span></div>
      <div><b>${m.zonePct == null ? '–' : m.zonePct + '%'}</b><span class="muted">in volume zone</span></div>
    </div>`;
  const improved = !multiQ && ms.length > 1 && ms[ms.length - 1].wpm > ms[0].wpm;
  const table = ms.length > 1 ? `<br><table><tr><th>${multiQ ? 'Question' : 'Round'}</th><th>WPM</th><th>Freezes</th><th>Restarts</th><th>Fillers</th></tr>
      ${ms.map((m, i) => `<tr><td>${multiQ ? esc(topics[i]) : `${i + 1} (${fmtTime(results[i].secs)})`}</td><td>${m.wpm}</td><td>${m.freezes}</td><td>${restartVal(m)}</td><td>${m.fillers}</td></tr>`).join('')}</table>
      ${multiQ ? '' : `<p class="${improved ? 'ok' : 'warnc'}">${improved ? `Speed rose ${ms[0].wpm} → ${ms[ms.length - 1].wpm} wpm. That’s the 4/3/2 effect.` : 'Speed did not rise yet. Next time reuse the exact phrases from round 1.'}</p>`}` : '';
  const prev = opts.prev;
  const cmp = prev ? `<table style="margin-top:12px"><tr><th></th><th>Before</th><th>Redo</th></tr>${[['Freezes', 'freezes'], ['Restarts', 'restarts'], ['Fillers', 'fillers'], ['Vague/100', 'vaguePer100'], ['WPM', 'wpm']].map(([l, k]) => { const now = k === 'restarts' ? restartVal(agg) : agg[k]; return `<tr><td>${l}</td><td>${prev[k] ?? '–'}</td><td><b class="${k === 'wpm' ? '' : now < prev[k] ? 'ok' : now > prev[k] ? 'warnc' : ''}">${now ?? '–'}</b></td></tr>`; }).join('')}</table>` : '';
  main.innerHTML = `
    <p class="eyebrow">Results</p><h1 style="max-width:28ch">${esc(topicText)}</h1>
    <div class="grid g2" style="align-items:start">
      <div class="card hl"><h2>${multiQ ? 'All 5 answers' : ms.length > 1 ? 'Final round' : 'Your numbers'}</h2>${kpi(agg)}${table}${cmp}</div>
      <div class="card"><p class="eyebrow">One thing to fix next</p><h2 id="fixline">${esc(notes[0])}</h2>
        <div class="row" style="margin-top:12px"><button id="redo">${icon('play')} Redo with this fix</button><button class="ghost" id="new">New topic</button></div>
        <p class="faint" style="margin-top:12px">Repeating the same task straight after feedback is one of the most reliable ways to improve fluency (Bygate 2001).</p>
        ${media(lastR.blob, lastR.video)}</div>
    </div><br>
    <div class="card" id="aibox"><h2>AI coach</h2><div id="aiout"></div></div><br>
    <div class="card"><h2>What you said</h2>${LEGEND}<div class="transcript" style="white-space:pre-wrap">${transcriptHtml(fullText)}</div>
      <p class="faint" style="margin-top:8px">${Object.entries(agg.fillerItems || {}).map(([k, v]) => `${esc(k)} ×${v}`).join(' · ')}${Object.keys(agg.vagueItems || {}).length ? ` · vague: ${Object.entries(agg.vagueItems).map(([k, v]) => `${esc(k)} ×${v}`).join(', ')}` : ''}</p></div><br>
    <div class="card hl"><h2>Which words did you lose?</h2>
      <p class="muted">Type the words you were searching for. They go into your deck and come back in Rapid retrieval and Phrases until they’re instant.</p>
      <div class="row"><input id="lost" placeholder="e.g. reluctant, deadline, procrastinate" style="flex:1"><button id="addlost">Add to my deck</button></div></div><br>
    <details class="card"><summary><b>More detail</b>: coach notes, you vs Theo, nerves</summary><br>
      <ul>${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
      <div id="theoout"></div><br>
      <label>How nervous now? <b id="anx2v">${Math.max(0, anxBefore - 1)}</b>/10 (before: ${anxBefore})</label><input type="range" id="anx2" min="0" max="10" value="${Math.max(0, anxBefore - 1)}" style="width:100%">
      <button class="ghost small" id="saveanx">Save rating</button></details>`;
  $('#addlost').onclick = () => {
    const words = $('#lost').value.split(',').map(w => w.trim()).filter(Boolean);
    words.forEach(w => addToDeck(w, `You lost this word while talking about “${topicText}”. Use it in a sentence.`));
    $('#lost').value = '';
    toast(`${words.length} word(s) added to your deck`);
  };
  $('#anx2').oninput = e => { $('#anx2v').textContent = e.target.value; };
  $('#saveanx').onclick = () => { session.anxAfter = +$('#anx2').value; S.anxiety.push({ ts: Date.now(), before: anxBefore, after: session.anxAfter }); save(); toast('Saved'); };
  const prevSnap = { freezes: agg.freezes, restarts: restartVal(agg), fillers: agg.fillers, vaguePer100: agg.vaguePer100, wpm: agg.wpm };
  let fix = notes[0];
  $('#redo').onclick = () => run(main, modeKey, topicText, anxBefore, { ...opts, fix, prev: prevSnap, plan: 0 });
  $('#new').onclick = () => render(main, { mode: modeKey });
  renderAi(topicText, fullText, agg, session, f => { fix = f; $('#fixline').textContent = f; });
  renderTheo(agg, lastR.blob);
}

async function renderTheo(m, blob) {
  const mins = Math.max((m.speakSec || 0) / 60, 0.25);
  const you = { wpm: m.wpm, freezesPerMin: +(m.freezes / mins).toFixed(1), restartsPerMin: +(Math.max(m.repetitions, m.selfRestarts || 0) / mins).toFixed(1), fillersPerMin: +(m.fillers / mins).toFixed(1) };
  const box = $('#theoout');
  const canDeep = LOCAL.ok && blob && blob.size && m.speakSec >= 10;
  box.innerHTML = '<h3>You vs Theo</h3>' + compareTable(you) + (canDeep ? '<p class="faint" id="deepstat">Analysing pauses, pitch and R on your computer…</p>' : '<p class="faint">Pause placement, pitch and R are measured when SpeakForge runs locally (./start.sh) and you speak for 10+ seconds.</p>');
  if (!canDeep) return;
  try {
    const d = await postAudio('analyze', blob);
    S.deep = S.deep || [];
    const { transcript, ...metrics } = d;
    S.deep.push({ ts: Date.now(), ...metrics });
    save();
    Object.assign(you, { pctPausesAtSentenceEnd: d.pct_pauses_sentence_end, pctPausesMidPhrase: d.pct_pauses_mid_phrase, f0RangeSt: d.f0_range_st, pctStatementsFalling: d.pct_statements_falling, nurseF3Ratio: d.nurse_f3_ratio });
    if (d.fillers_per_min != null) you.fillersPerMin = d.fillers_per_min;
    if (d.restarts_per_min != null) you.restartsPerMin = Math.max(you.restartsPerMin, d.restarts_per_min);
    if (box.isConnected) box.innerHTML = '<h3>You vs Theo</h3>' + compareTable(you) + `<p class="faint">Measured on your computer by Whisper and Praat (${esc(d.engine || 'local')}).</p>`;
  } catch (e) { $('#deepstat').innerHTML = `<span class="bad">Local analysis failed: ${esc(e.message)}</span>`; }
}

async function renderAi(topicText, text, m, session, onFix) {
  const box = $('#aiout');
  if (!aiReady(S.ai)) {
    box.innerHTML = '<p class="muted">Connect the AI coach in <a href="#/settings">Settings</a> (free and private on your Mac with Gemma 4) for: what a listener understood, word upgrades, corrections, the words you were looking for, and a clearer version to shadow.</p>';
    return;
  }
  if (!text || countWords(text) < 8) { box.innerHTML = '<p class="muted">Not enough recognised speech for AI feedback.</p>'; return; }
  const go = async () => {
    box.innerHTML = '<p class="muted">Your coach is listening back…</p>';
    try {
      const fb = parseFeedback(await chatJson(S.ai, feedbackMessages(topicText, text, m, S.settings), FEEDBACK_SCHEMA));
      if (!box.isConnected) return;
      if (fb.clarity != null) { session.rounds[session.rounds.length - 1].aiClarity = fb.clarity; save(); }
      if (fb.focus) onFix(fb.focus);
      box.innerHTML = `
        ${fb.heard_point ? `<p class="muted" style="margin:0 0 6px">What a listener took away${fb.clarity != null ? ` · clarity <b>${fb.clarity}/10</b>` : ''}:</p><div class="heard">${esc(fb.heard_point)}</div><br>` : ''}
        ${fb.strength ? `<p class="ok"><b>Strength:</b> ${esc(fb.strength)}</p>` : ''}
        ${fb.upgrades.length ? `<h3>Word upgrades</h3><table>${fb.upgrades.map(u => `<tr><td class="warnc">${esc(u.said)}</td><td class="ok">${esc(u.better)}</td></tr>`).join('')}</table><button class="small" id="addup">Add upgrades to my deck</button><br><br>` : ''}
        ${fb.confusing ? `<h3>Where it got confusing</h3><p>“${esc(fb.confusing.quote)}”</p><p class="muted">${esc(fb.confusing.why)}</p>` : ''}
        ${fb.corrections.length ? `<h3>Corrections</h3><table>${fb.corrections.map(c => `<tr><td class="bad">${esc(c.original)}</td><td class="ok">${esc(c.better)}</td><td class="faint">${esc(c.why || '')}</td></tr>`).join('')}</table><br>` : ''}
        ${fb.lost_words.length ? `<h3>Words you were probably looking for</h3><p>${fb.lost_words.map(w => `<span class="pill" title="${esc(w.example || '')}"><b>${esc(w.word)}</b> · ${esc(w.meaning || '')}</span>`).join(' ')}</p><button class="small" id="addai">Add to my deck</button><br><br>` : ''}
        ${fb.rewrite ? `<h3>A clearer way to say it</h3><p class="passage" style="font-size:17px">${esc(fb.rewrite)}</p><div class="row"><button class="ghost small" id="hear">Hear it</button><button class="ghost small" id="shadowit">Shadow this</button>${fb.phrases.length ? '<button class="ghost small" id="addph">Add its chunks to my phrases</button>' : ''}</div>` : ''}`;
      $('#addup').onclick = () => { fb.upgrades.forEach(u => addToDeck(u.better, `Instead of “${u.said}”. Say it in a sentence.`, 'Upgrade')); toast('Upgrades added'); };
      $('#addai').onclick = () => { fb.lost_words.forEach(w => addToDeck(w.word, `${w.meaning || ''}${w.example ? ` e.g. “${w.example}”` : ''}`)); toast('Added to your deck'); };
      $('#addph').onclick = () => { fb.phrases.forEach(p => addToDeck(p, 'Chunk from your AI rewrite. Use it in a sentence.', 'Mine')); toast('Added to your phrases'); };
      $('#hear').onclick = () => say(fb.rewrite, { rate: 0.95 });
      $('#shadowit').onclick = () => { sessionStorage.setItem('sf.shadow', fb.rewrite); location.hash = '#/shadow?t=along'; };
    } catch (e) {
      box.innerHTML = `<p class="bad">AI error: ${esc(e.message)}</p><button class="ghost small" id="retry">Retry</button>`;
      $('#retry').onclick = go;
    }
  };
  if (S.ai.auto) go(); else { box.innerHTML = '<button id="getai">Get AI feedback</button>'; $('#getai').onclick = go; }
}
