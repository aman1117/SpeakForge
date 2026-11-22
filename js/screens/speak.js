import { S, save, logActivity, addToDeck, $, esc, pick, shuffle, mic, ensureMic, meterHtml, setMeter, fmtTime, countdown, toast, sleep } from '../core.js';
import { loop, calibrate, Recorder, Listener, speechSupported, saveRecording, say, cue, openCamera } from '../audio.js';
import { VoiceTracker, speechThreshold, countWords, wordsPerMinute, pauseStats, findRepetitions, countFillers, coachNotes, sentenceLengths, tokenize, FILLER_WORDS, avgConfidence } from '../metrics.js';
import { TOPICS, RESCUE_PHRASES, BRIDGE_TIPS, QUESTIONS, BENCHMARK_TOPIC, AFFIRMATIONS, READING_PASSAGES } from '../content.js';
import { aiReady, chat, feedbackMessages, parseFeedback } from '../ai.js';
import { Spotlight } from '../stage.js';
import { LOCAL, postAudio } from '../local.js';
import { listenMode } from '../audio.js';
import { compareTable } from './theo.js';

const R_PASSAGE = READING_PASSAGES[READING_PASSAGES.length - 1];

export const MODES = {
  oneMin: { name: '1-minute random topic (Mona-style)', kind: 'speak', rounds: [60] },
  noRestart: { name: 'No-Restart challenge (2 min, bridge every freeze)', kind: 'speak', rounds: [120], rule: 'Never restart a sentence. Lost a word? Describe it, simplify, or skip it, and keep the SAME sentence going. Press SPACE if you catch yourself restarting.' },
  questions: { name: 'Question chain: 5 rapid questions (conversation / Table Topics)', kind: 'speak', rounds: [40, 40, 40, 40, 40], questions: true },
  quick432: { name: 'Quick 4/3/2 (2 → 1.5 → 1 min)', kind: 'speak432', rounds: [120, 90, 60] },
  fourThreeTwo: { name: '4/3/2 fluency (4 → 3 → 2 min)', kind: 'speak432', rounds: [240, 180, 120] },
  tenWord: { name: '10-word sentences (stop rambling)', kind: 'speak', rounds: [60], rule: 'Max 10 words per sentence. Short. Clear. Pause. Next.' },
  prep: { name: 'PREP structure (Point, Reason, Example, Point)', kind: 'speak', rounds: [60], stages: [['Point', .18], ['Reason', .27], ['Example', .35], ['Point again', .2]] },
  creator: { name: 'Creator reel (Hook, Point, Opinion, CTA)', kind: 'speakCreator', rounds: [60], stages: [['Hook (5s!)', .1], ['Point', .45], ['Opinion', .28], ['Call to action', .17]] },
  benchmark: { name: 'Weekly benchmark (same topic + R passage)', kind: 'benchmark', rounds: [120], benchmark: true },
};

let topic = null;

export function render(main, params = {}) {
  const st = S.settings;
  const modeOpts = Object.entries(MODES).map(([k, m]) => `<option value="${k}" ${params.mode === k ? 'selected' : ''}>${m.name}</option>`).join('');
  const hook = params.hook || '';
  main.innerHTML = `
    <h1>Step onto the stage</h1>
    <p class="sub">Talk without stopping. If a word disappears, a cue appears with a phrase that keeps your sentence alive. Press space whenever you catch yourself restarting.</p>
    <div class="grid g2" style="align-items:start">
      <div class="card hl">
        <h2>Your topic</h2>
        <div class="prompt" id="topic" style="text-align:left;margin:0;padding:6px 0 14px"></div>
        ${hook ? `<p class="warnc">Open with Theo’s hook pattern: “${esc(hook)}”</p>` : ''}
        <div class="row"><button class="ghost" id="spin">Another topic</button><input id="custom" placeholder="Or type your own topic" style="flex:1;min-width:180px" value=""></div>
        <div class="row" style="margin-top:18px"><button id="go" style="padding:15px 24px;font-size:17px">Start speaking</button><span class="muted">Start with “So,” and say the first thing that comes to mind.</span></div>
      </div>
      <div class="card">
        <h2>How you’ll practise</h2>
        <select id="mode" style="width:100%">${modeOpts}</select>
        <div class="row" style="margin-top:12px"><label>Topics</label>
          <select id="diff"><option value="easy">Everyday</option><option value="medium" selected>Opinions</option><option value="hard">Explain or argue</option><option value="creator" ${params.mode === 'creator' ? 'selected' : ''}>Reels</option></select></div>
        <details style="margin-top:14px"><summary class="muted">Coaching options</summary>
          <div class="row" style="margin-top:10px"><label>Cue after</label>
            <select id="bms">${[1200, 1800, 2500, 3500].map(v => `<option value="${v}" ${st.bridgeMs === v ? 'selected' : ''}>${v / 1000} s of silence</option>`).join('')}</select></div>
          <div class="row" style="margin-top:10px">
            <label><input type="checkbox" id="cue" ${st.cue ? 'checked' : ''}> Soft sound with cues</label>
            <label><input type="checkbox" id="cam" ${st.camera ? 'checked' : ''}> Film me</label>
            <label><input type="checkbox" id="rit" ${st.ritual ? 'checked' : ''}> Breathe first</label></div>
        </details>
        <p class="muted" style="margin-top:14px">${S.volume.baseline == null ? 'Set your normal volume in <a href="#/voice?t=zone">Volume and nerves</a> to get “speak up” cues while you talk.' : 'Volume cues are on.'}</p>
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
    Object.assign(S.settings, { bridgeMs: +$('#bms').value, cue: $('#cue').checked, camera: $('#cam').checked, ritual: $('#rit').checked });
    save();
    const m = $('#mode').value;
    run(main, m, MODES[m].benchmark ? BENCHMARK_TOPIC : ($('#custom').value.trim() || topic), +$('#anx').value);
  };
}

async function ritual(main) {
  const aff = pick(AFFIRMATIONS);
  let skip = false;
  for (const [label, scale, secs] of [['Breathe in', 1, 4], ['Hold', 1, 4], ['Breathe out', .55, 4], ['Hold', .55, 2]]) {
    if (skip || !main.isConnected) break;
    main.innerHTML = `<div class="card" style="text-align:center"><h2>Calm-down ritual</h2><div class="breath" style="transform:scale(${scale})"></div>
      <div class="prompt">${label}</div><p style="font-size:18px">“${esc(aff)}”</p><button class="ghost small" id="skipr">Skip</button></div>`;
    $('#skipr').onclick = () => { skip = true; };
    for (let i = 0; i < secs * 4 && !skip; i++) await sleep(250);
  }
}

async function run(main, modeKey, topicText, anxBefore) {
  const mode = MODES[modeKey];
  if (!(await ensureMic())) return;
  if (!speechSupported()) toast('Speech recognition needs Edge or Chrome. Timing still works.');
  let cam = null;
  if (S.settings.camera) {
    try { cam = await openCamera(); } catch { toast('Camera unavailable. Continuing with audio only.'); }
  }
  if (S.settings.ritual) await ritual(main);
  main.innerHTML = '<div class="card" id="cd"></div>';
  const [noise] = await Promise.all([calibrate(mic, 2700), countdown($('#cd'), 3)]);
  const threshold = speechThreshold(noise);
  const topics = mode.questions ? shuffle(QUESTIONS).slice(0, mode.rounds.length) : mode.rounds.map(() => topicText);
  const results = [];
  for (let r = 0; r < mode.rounds.length; r++) {
    if (!main.isConnected) return;
    if (mode.questions) await askQuestion(main, topics[r], r, mode.rounds.length);
    else if (r > 0) await breakScreen(main, r, mode.rounds[r]);
    results.push(await round(main, mode, topics[r], mode.rounds[r], threshold, r, mode.rounds.length, cam));
  }
  cam?.close();
  await showResults(main, modeKey, mode.questions ? 'Question chain' : topicText, results, anxBefore, topics);
}

async function askQuestion(main, q, r, n) {
  main.innerHTML = `<div class="card" style="text-align:center"><span class="pill">Question ${r + 1}/${n}</span><div class="prompt">${esc(q)}</div><p class="muted">Listen… then answer immediately when the timer starts.</p></div>`;
  await new Promise(res => { say(q, { rate: 0.95, onEnd: res }); setTimeout(res, 9000); });
  await sleep(300);
}

async function breakScreen(main, r, secs) {
  let skip = false;
  for (let i = 10; i > 0 && !skip && main.isConnected; i--) {
    main.innerHTML = `<div class="card" style="text-align:center"><h2>Round ${r + 1} next: same topic, only ${fmtTime(secs)}</h2>
      <p>Goal: say the <b>same ideas faster</b>, with <b>fewer freezes</b>. Reuse the phrases that worked.</p><div class="big">${i}</div>
      <button class="ghost" id="skipb">Start now</button></div>`;
    $('#skipb').onclick = () => { skip = true; };
    await sleep(1000);
  }
}

function round(main, mode, topicText, secs, threshold, r, total, cam) {
  return new Promise(resolve => {
    const st = S.settings;
    const base = S.volume.baseline;
    const zone = base != null ? [base + 4, base + 14] : null;
    const stagesHtml = mode.stages ? `<div class="stage" id="stg">${mode.stages.map(s => `<span>${s[0]}</span>`).join('')}</div><br>` : '';
    main.innerHTML = `
      <div class="card onair">
        <canvas class="spotlight" id="spot" aria-hidden="true"></canvas>
        <div class="row"><span class="pill">${total > 1 ? `${mode.questions ? 'Question' : 'Round'} ${r + 1} of ${total}` : 'On stage'}</span><span class="spacer"></span><button class="ghost small" id="rst" title="Press when you catch yourself restarting a sentence">I restarted (space)</button><button class="red small" id="stop">Finish</button></div>
        <div class="grid ${cam ? 'g2' : ''}" style="align-items:center;margin-top:18px">
          ${cam ? '<video id="camv" autoplay muted playsinline style="width:100%;max-height:440px;border-radius:20px;transform:scaleX(-1);background:#000;object-fit:cover"></video>' : ''}
          <div>
            <div class="prompt">${esc(topicText)}</div>
            ${mode.rule ? `<p style="text-align:center;max-width:52ch;margin:0 auto 10px" class="warnc">${esc(mode.rule)}</p>` : ''}
            ${stagesHtml}
            <div class="big" id="timer">${fmtTime(secs)}</div>
            <div style="max-width:420px;margin:0 auto">${meterHtml('lvl', zone)}</div>
            <p class="muted" id="status" style="text-align:center;margin-top:12px">${listenMode() === 'local' && !LOCAL.ready ? 'The speech engine is still loading on your computer; your words will appear in a moment.' : 'The light follows your voice. Begin whenever you’re ready.'}</p>
            <div id="nudge" style="min-height:26px;text-align:center"></div>
            <div id="bridge" style="min-height:104px;max-width:560px;margin:0 auto"></div>
            <div id="rpass"></div>
          </div>
        </div>
        <div class="row muted" style="justify-content:center;gap:22px;margin:8px 0 12px"><span>Freezes <b id="fz">0</b></span><span>Recovered <b id="rc">0</b></span><span>Restarts <b id="sr">0</b></span><span>Words <b id="wc">0</b></span></div>
        <div class="transcript" id="tr"><span class="muted">Your words appear here as you speak.</span></div>
      </div>`;
    const spot = new Spotlight($('#spot'));
    if (cam) $('#camv').srcObject = cam.stream;
    const tracker = new VoiceTracker({ thresholdDb: threshold });
    const listener = new Listener({ onText: t => { $('#tr').textContent = t; $('#wc').textContent = countWords(t); } });
    listener.start();
    const recStream = cam ? new MediaStream([...cam.stream.getVideoTracks(), ...mic.stream.getAudioTracks()]) : mic.stream;
    const recorder = new Recorder(recStream, !!cam);
    recorder.start();
    let freezes = 0, recovered = 0, selfRestarts = 0, inFreeze = false, freezeStart = 0, ended = false, lastT = 0, lastNudge = -1e9, rpassShown = false;
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
        $('#rpass').innerHTML = `<div class="card" style="background:var(--panel2)"><b>Now read aloud:</b><p class="passage">${esc(R_PASSAGE)}</p></div>`;
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
        $('#bridge').innerHTML = `<div class="bridge"><span class="muted">Lost the word? Keep the sentence going:</span><b>“${esc(p.phrase)}”</b><span class="muted">${esc(p.use)}. ${esc(pick(BRIDGE_TIPS))}</span></div>`;
        $('#fz').textContent = freezes;
        if (st.cue) cue(660, 140);
      }
      if (inFreeze && silence === 0) {
        inFreeze = false;
        if (t - freezeStart < 6000) { recovered++; $('#rc').textContent = recovered; }
        $('#bridge').innerHTML = '';
      }
      if (left <= 0) finish();
      spot.feed(db, threshold, inFreeze ? 'freeze' : t - lastNudge < 3000 ? 'quiet' : db >= threshold ? 'speaking' : 'idle');
    });
    $('#stop').onclick = () => finish();
    async function finish() {
      if (ended) return;
      ended = true;
      stopLoop();
      window.removeEventListener('keydown', onKey);
      $('#status').textContent = 'Processing…';
      const [text, blob] = await Promise.all([listener.stop(), recorder.stop()]);
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
  };
}

export function highlight(text) {
  const words = (text || '').split(/[ \t]+/).filter(Boolean);
  const norm = words.map(w => tokenize(w)[0] || '');
  const mark = new Array(words.length).fill('');
  for (let i = 0; i < norm.length; i++) {
    if (FILLER_WORDS.includes(norm[i])) mark[i] = 'fill';
    for (let n = 3; n >= 1; n--) {
      if (i + 2 * n > norm.length) continue;
      const a = norm.slice(i, i + n).join(' '), b = norm.slice(i + n, i + 2 * n).join(' ');
      if (a && a === b && !(n === 1 && ['very', 'that', 'had', 'so', 'really', 'no'].includes(a))) { for (let k = i; k < i + n; k++) mark[k] = 'rep'; break; }
    }
  }
  return words.map((w, i) => mark[i] ? `<span class="${mark[i]}">${esc(w)}</span>` : esc(w)).join(' ');
}

function aiPrompt(topicText, text, m) {
  return `You are my English speaking coach. I'm an Indian English speaker (first language: ${S.settings.l1}) training fluency, articulation and confidence (goal: ${S.settings.accent === 'neutral' ? 'clear neutral English' : 'confident American English like Theo Browne'}).
Below is a speech-recognition transcript of my ${m.speakSec}-second impromptu talk on: "${topicText}".
Metrics: ${m.wpm} words/min, ${m.freezes} freezes, ${Math.max(m.repetitions, m.selfRestarts || 0)} restarts, ${m.fillers} fillers.

Please:
1. List my grammar / word-choice mistakes (original → better), max 8.
2. Where I seem to have searched for a word or restarted, tell me the word/phrase I probably needed + a rescue phrase I could have used.
3. Rewrite my talk the way a fluent native speaker would SAY it (same ideas, spoken style, short sentences).
4. Give me 3 useful chunks/phrases from your rewrite to memorise.
5. One single thing to focus on next time.

Transcript: """${text}"""`;
}

export function aggregate(ms) {
  const sum = k => ms.reduce((a, m) => a + (m[k] || 0), 0);
  const speakSec = sum('speakSec');
  const clar = ms.map(m => m.clarity).filter(c => c != null);
  const zones = ms.map(m => m.zonePct).filter(z => z != null);
  return {
    ...ms[0], words: sum('words'), speakSec, wpm: wordsPerMinute(sum('words'), speakSec), freezes: sum('freezes'), recovered: sum('recovered'),
    selfRestarts: sum('selfRestarts'), repetitions: sum('repetitions'), fillers: sum('fillers'), fillerItems: {}, repList: [],
    longestPauseMs: Math.max(...ms.map(m => m.longestPauseMs)),
    longPausesPerMin: +(ms.reduce((a, m) => a + m.longPausesPerMin * m.speakSec, 0) / Math.max(1, speakSec)).toFixed(1),
    clarity: clar.length ? Math.round(clar.reduce((a, b) => a + b, 0) / clar.length) : null,
    zonePct: zones.length ? Math.round(zones.reduce((a, b) => a + b, 0) / zones.length) : null,
  };
}

async function showResults(main, modeKey, topicText, results, anxBefore, topics) {
  const mode = MODES[modeKey];
  const ms = results.map(metricsOf);
  const multiQ = !!mode.questions;
  const agg = multiQ ? aggregate(ms) : ms[ms.length - 1];
  const fullText = multiQ ? results.map((r, i) => `[Q${i + 1}: ${topics[i]}] ${r.text}`).join('\n') : results[results.length - 1].text;
  const lastR = results[results.length - 1];
  const xp = 20 + Math.round(results.reduce((a, r) => a + r.speakSec, 0) / 6);
  const session = { ts: Date.now(), mode: modeKey, topic: topicText, rounds: (multiQ ? [agg] : ms).map(({ repList, fillerItems, ...rest }) => rest), anxBefore };
  S.sessions.push(session);
  logActivity(mode.kind, xp);
  const ts = Date.now();
  for (const [i, r] of results.entries()) {
    if (r.blob && r.blob.size) {
      try {
        await saveRecording({ id: `${ts}-${i}`, ts, kind: mode.kind, video: r.video, title: `${mode.name.split('(')[0].trim()}: ${multiQ ? topics[i] : topicText}${results.length > 1 && !multiQ ? ` (round ${i + 1})` : ''}`, blob: r.blob, metrics: ms[i] });
      } catch { /* storage full or unavailable */ }
    }
  }
  const restartVal = m => Math.max(m.repetitions, m.selfRestarts || 0);
  const kpi = m => `<div class="kpi">
      <div><b>${m.wpm}</b><span class="muted">words/min</span></div>
      <div><b>${m.freezes}</b><span class="muted">freezes</span></div>
      <div><b class="${m.recovered >= m.freezes ? 'ok' : 'warnc'}">${m.recovered}/${m.freezes}</b><span class="muted">recovered</span></div>
      <div><b class="${restartVal(m) > 2 ? 'bad' : 'ok'}">${restartVal(m)}</b><span class="muted">restarts (you ${m.selfRestarts || 0} · detected ${m.repetitions})</span></div>
      <div><b>${m.fillers}</b><span class="muted">fillers</span></div>
      <div><b>${m.clarity == null ? '-' : m.clarity + '%'}</b><span class="muted">clarity (recogniser confidence)</span></div>
      <div><b>${m.zonePct == null ? '-' : m.zonePct + '%'}</b><span class="muted">in volume zone</span></div>
      <div><b>${(m.longestPauseMs / 1000).toFixed(1)}s</b><span class="muted">longest pause</span></div>
    </div>`;
  const improved = !multiQ && ms.length > 1 && ms[ms.length - 1].wpm > ms[0].wpm;
  const table = ms.length > 1 ? `<br><table><tr><th>${multiQ ? 'Question' : 'Round'}</th><th>WPM</th><th>Freezes</th><th>Restarts</th><th>Fillers</th></tr>
      ${ms.map((m, i) => `<tr><td>${multiQ ? esc(topics[i]) : `${i + 1} (${fmtTime(results[i].secs)})`}</td><td>${m.wpm}</td><td>${m.freezes}</td><td>${restartVal(m)}</td><td>${m.fillers}</td></tr>`).join('')}</table>
      ${multiQ ? '' : `<p class="${improved ? 'ok' : 'warnc'}">${improved ? `Speed rose ${ms[0].wpm} → ${ms[ms.length - 1].wpm} wpm. That's the 4/3/2 effect.` : 'Speed did not rise yet. Next time reuse the exact phrases from round 1.'}</p>`}` : '';
  const url = lastR.blob && lastR.blob.size ? URL.createObjectURL(lastR.blob) : '';
  const media = !url ? '' : lastR.video ? `<video controls src="${url}" style="width:100%;max-height:360px;border-radius:10px"></video>` : `<audio controls src="${url}" style="width:100%"></audio>`;
  main.innerHTML = `
    <h1>Results: ${esc(topicText)}</h1>
    <div class="grid g2">
      <div class="card hl"><h2>${multiQ ? 'All 5 answers' : ms.length > 1 ? 'Final round' : 'Your numbers'}</h2>${kpi(agg)}${table}</div>
      <div class="card"><h2>Coach notes</h2><ul>${coachNotes({ ...agg, repetitions: restartVal(agg) }).map(n => `<li>${esc(n)}</li>`).join('')}</ul>
        ${media}<p class="muted">Listen back once. Where did you freeze, and what could you have said?</p></div>
    </div><br>
    <div class="card hl"><h2>Which words did you lose?</h2>
      <p>Type the words you were searching for (comma-separated). They go into <b>My lost words</b>: Phrases and Rapid naming drill them until they're instant.</p>
      <div class="row"><input id="lost" placeholder="e.g. reluctant, deadline, procrastinate" style="flex:1"><button id="addlost">Add to my deck</button></div></div><br>
    <div class="card" id="aibox"><h2>AI coach</h2><div id="aiout"></div></div><br>
    <div class="card" id="theobox"><h2>You vs Theo</h2><div id="theoout"></div></div><br>
    <div class="card"><h2>Transcript</h2><p class="muted"><span class="rep">red</span> = restart/repeat · <span class="fill">orange</span> = filler · (speech recognition hides some restarts and “um”s; SPACE counts the ones you notice)</p>
      <div class="transcript" style="white-space:pre-wrap">${highlight(fullText) || '<span class="muted">No speech recognised. Use Edge/Chrome and check the mic.</span>'}</div></div><br>
    <div class="card"><h2>How nervous now?</h2><input type="range" id="anx2" min="0" max="10" value="${Math.max(0, anxBefore - 1)}" style="width:100%"><b id="anx2v">${Math.max(0, anxBefore - 1)}</b>/10 (before: ${anxBefore})
        <br><br><button class="ghost" id="saveanx">Save rating</button></div><br>
    <div class="row"><button id="again">Same again</button><button class="ghost" id="new">New topic</button></div>`;
  $('#addlost').onclick = () => {
    const words = $('#lost').value.split(',').map(w => w.trim()).filter(Boolean);
    words.forEach(w => addToDeck(w, `You lost this word while talking about “${topicText}”. Use it in a sentence.`));
    $('#lost').value = '';
    toast(`${words.length} word(s) added to My lost words`);
  };
  $('#anx2').oninput = e => { $('#anx2v').textContent = e.target.value; };
  $('#saveanx').onclick = () => { session.anxAfter = +$('#anx2').value; S.anxiety.push({ ts: Date.now(), before: anxBefore, after: session.anxAfter }); save(); toast('Saved'); };
  $('#again').onclick = () => run(main, modeKey, topicText, anxBefore);
  $('#new').onclick = () => render(main, { mode: modeKey });
  renderAi(topicText, fullText, agg);
  renderTheo(agg, lastR.blob);
}

async function renderTheo(m, blob) {
  const mins = Math.max((m.speakSec || 0) / 60, 0.25);
  const you = { wpm: m.wpm, freezesPerMin: +(m.freezes / mins).toFixed(1), restartsPerMin: +(Math.max(m.repetitions, m.selfRestarts || 0) / mins).toFixed(1), fillersPerMin: +(m.fillers / mins).toFixed(1) };
  const box = $('#theoout');
  const canDeep = LOCAL.ok && blob && blob.size && m.speakSec >= 10;
  box.innerHTML = compareTable(you) + (canDeep ? '<p class="muted" id="deepstat">Analysing pauses, pitch and R on your computer…</p>' : '<p class="muted">Pause placement, pitch and R strength are measured when SpeakForge runs locally (start.sh) and you speak for at least 10 seconds.</p>');
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
    box.innerHTML = compareTable(you) + `<p class="muted">Measured on your computer by Whisper and Praat (${esc(d.engine || 'local')}). Whisper keeps the “um”s and restarts that browser recognition hides.</p>`;
  } catch (e) { $('#deepstat').innerHTML = `<span class="bad">Local analysis failed: ${esc(e.message)}</span>`; }
}

async function renderAi(topicText, text, m) {
  const box = $('#aiout');
  const copyBtn = '<button class="ghost small" id="copy">Copy coach prompt for ChatGPT/Copilot</button>';
  const bindCopy = () => { $('#copy').onclick = async () => { try { await navigator.clipboard.writeText(aiPrompt(topicText, text, m)); toast('Prompt copied'); } catch { toast('Clipboard blocked'); } }; };
  if (!aiReady(S.ai)) {
    box.innerHTML = `<p class="muted">Connect an AI (OpenAI, Azure OpenAI or free local Ollama) in <a href="#/coach">Coach and profile</a> for automatic feedback: corrections, the words you were looking for, and a native-style rewrite.</p>${copyBtn}`;
    bindCopy();
    return;
  }
  if (!text || countWords(text) < 8) { box.innerHTML = `<p class="muted">Not enough recognised speech for AI feedback.</p>${copyBtn}`; bindCopy(); return; }
  const go = async () => {
    box.innerHTML = '<p class="muted">Thinking…</p>';
    try {
      const fb = parseFeedback(await chat(S.ai, feedbackMessages(topicText, text, m, S.settings)));
      box.innerHTML = `
        ${fb.strength ? `<p class="ok">${esc(fb.strength)}</p>` : ''}
        ${fb.corrections.length ? `<h3>Corrections</h3><table>${fb.corrections.map(c => `<tr><td class="bad">${esc(c.original)}</td><td class="ok">${esc(c.better)}</td><td class="muted">${esc(c.why || '')}</td></tr>`).join('')}</table><br>` : ''}
        ${fb.lost_words.length ? `<h3>Words you were probably looking for</h3><p id="lw">${fb.lost_words.map(w => `<span class="pill" title="${esc(w.example || '')}"><b>${esc(w.word)}</b> · ${esc(w.meaning || '')}</span>`).join(' ')}</p><button class="small" id="addai">Add these to My lost words</button><br><br>` : ''}
        ${fb.rewrite ? `<h3>Native-style version</h3><p class="passage" id="rw" style="font-size:16px">${esc(fb.rewrite)}</p><div class="row"><button class="ghost small" id="hear">Hear it</button><button class="ghost small" id="shadowit">Shadow this</button></div><br>` : ''}
        ${fb.phrases.length ? `<h3>Chunks to learn</h3><p>${fb.phrases.map(p => `<span class="pill">${esc(p)}</span>`).join(' ')}</p><button class="ghost small" id="addph">Add chunks to my phrases</button>` : ''}
        ${fb.focus ? `<p class="warnc"><b>Next time:</b> ${esc(fb.focus)}</p>` : ''}`;
      $('#addai').onclick = () => { fb.lost_words.forEach(w => addToDeck(w.word, `${w.meaning || ''}${w.example ? ` e.g. “${w.example}”` : ''}`)); toast('Added to My lost words'); };
      $('#addph').onclick = () => { fb.phrases.forEach(p => addToDeck(p, 'Chunk from your AI rewrite. Use it in a sentence.', 'Mine')); toast('Added to your phrases'); };
      $('#hear').onclick = () => say(fb.rewrite, { rate: 0.95 });
      $('#shadowit').onclick = () => { sessionStorage.setItem('sf.shadow', fb.rewrite); location.hash = '#/shadow?t=along'; };
    } catch (e) {
      box.innerHTML = `<p class="bad">AI error: ${esc(e.message)}</p><button class="ghost small" id="retry">Retry</button> ${copyBtn}`;
      $('#retry').onclick = go;
      bindCopy();
    }
  };
  if (S.ai.auto) go(); else { box.innerHTML = `<button id="getai">Get AI feedback</button> ${copyBtn}`; $('#getai').onclick = go; bindCopy(); }
}
