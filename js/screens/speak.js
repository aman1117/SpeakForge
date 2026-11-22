import { S, save, logActivity, $, esc, pick, mic, ensureMic, meterHtml, setMeter, fmtTime, countdown, toast } from '../core.js';
import { loop, calibrate, Recorder, Listener, speechSupported, saveRecording } from '../audio.js';
import { VoiceTracker, speechThreshold, countWords, wordsPerMinute, pauseStats, findRepetitions, countFillers, coachNotes, sentenceLengths, tokenize, FILLER_WORDS } from '../metrics.js';
import { TOPICS, RESCUE_PHRASES, BRIDGE_TIPS } from '../content.js';

const MODES = {
  oneMin: { name: '1-minute random topic (Mona-style)', kind: 'speak', rounds: [60] },
  fourThreeTwo: { name: '4/3/2 fluency (same topic 3×, less time each)', kind: 'speak432', rounds: [240, 180, 120] },
  quick432: { name: 'Quick 4/3/2 (2 → 1.5 → 1 min)', kind: 'speak432', rounds: [120, 90, 60] },
  tenWord: { name: '10-word sentences (stop rambling)', kind: 'speak', rounds: [60], rule: 'Max 10 words per sentence. Short. Clear. Pause. Next.' },
  prep: { name: 'PREP structure (Point, Reason, Example, Point)', kind: 'speak', rounds: [60], stages: [['Point', .18], ['Reason', .27], ['Example', .35], ['Point again', .2]] },
  creator: { name: 'Creator reel (Hook, Point, Opinion, CTA)', kind: 'speakCreator', rounds: [60], stages: [['Hook (5s!)', .1], ['Point', .45], ['Opinion', .28], ['Call to action', .17]] },
  noRestart: { name: 'No-Restart challenge (2 min, bridge every freeze)', kind: 'speak', rounds: [120], rule: 'Never restart a sentence. Lost a word? Describe it, simplify, or skip it, and keep the SAME sentence going.' },
};

let topic = null;

export function render(main, params = {}) {
  const modeOpts = Object.entries(MODES).map(([k, m]) => `<option value="${k}" ${params.mode === k ? 'selected' : ''}>${m.name}</option>`).join('');
  main.innerHTML = `
    <h1>🎤 Speaking Arena</h1>
    <p class="sub">Impromptu speaking with live freeze detection. When you go silent for 1.8 s, a <b>BRIDGE</b> card appears: use it to continue the sentence instead of restarting.</p>
    <div class="grid g2">
      <div class="card">
        <h2>Set up</h2>
        <label class="muted">Mode</label><br><select id="mode" style="width:100%">${modeOpts}</select><br><br>
        <label class="muted">Topic difficulty</label><br>
        <select id="diff"><option value="easy">Easy (everyday)</option><option value="medium" selected>Medium (opinions)</option><option value="hard">Hard (explain/argue)</option><option value="creator" ${params.mode === 'creator' ? 'selected' : ''}>Creator / reels</option></select>
        <br><br><label class="muted">Nervousness right now: <b id="anxv">5</b>/10</label><br>
        <input type="range" id="anx" min="0" max="10" value="5" style="width:100%">
      </div>
      <div class="card hl">
        <h2>Your topic</h2>
        <div class="prompt" id="topic"></div>
        <div class="row"><button class="ghost" id="spin">🎲 Spin again</button><input id="custom" placeholder="…or type your own topic" style="flex:1"></div>
        <br><button id="go" style="width:100%;padding:14px;font-size:17px">Start speaking ▶</button>
        <p class="muted">Tip: think for 0 seconds. Start with "So, …" and say the first thing that comes to mind.</p>
      </div>
    </div>`;
  const spin = () => { topic = pick(TOPICS[$('#diff').value]); $('#topic').textContent = topic; };
  if (!topic || params.mode === 'creator') spin(); else $('#topic').textContent = topic;
  $('#spin').onclick = spin;
  $('#diff').onchange = spin;
  $('#anx').oninput = e => { $('#anxv').textContent = e.target.value; };
  $('#go').onclick = () => run(main, $('#mode').value, $('#custom').value.trim() || topic, +$('#anx').value);
}

async function run(main, modeKey, topicText, anxBefore) {
  const mode = MODES[modeKey];
  if (!(await ensureMic())) return;
  if (!speechSupported()) toast('Speech recognition needs Edge or Chrome. Timing still works.');
  main.innerHTML = '<div class="card" id="cd"></div>';
  const [noise] = await Promise.all([calibrate(mic, 2700), countdown($('#cd'), 3)]);
  const threshold = speechThreshold(noise);
  const results = [];
  for (let r = 0; r < mode.rounds.length; r++) {
    if (r > 0) await breakScreen(main, r, mode.rounds[r]);
    results.push(await round(main, mode, topicText, mode.rounds[r], threshold, r, mode.rounds.length));
  }
  await showResults(main, modeKey, topicText, results, anxBefore);
}

async function breakScreen(main, r, secs) {
  let skip = false;
  for (let i = 10; i > 0 && !skip; i--) {
    main.innerHTML = `<div class="card" style="text-align:center"><h2>Round ${r + 1} next: same topic, only ${fmtTime(secs)}</h2>
      <p>Goal: say the <b>same ideas faster</b>, with <b>fewer freezes</b>. Reuse the phrases that worked.</p><div class="big">${i}</div>
      <button class="ghost" id="skipb">Start now</button></div>`;
    $('#skipb').onclick = () => { skip = true; };
    await new Promise(res => setTimeout(res, 1000));
  }
}

function round(main, mode, topicText, secs, threshold, r, total) {
  return new Promise(resolve => {
    const stagesHtml = mode.stages ? `<div class="stage" id="stg">${mode.stages.map(s => `<span>${s[0]}</span>`).join('')}</div><br>` : '';
    main.innerHTML = `
      <div class="card">
        <div class="row"><span class="pill">${total > 1 ? `Round ${r + 1}/${total}` : 'Live'}</span><span class="spacer"></span><button class="red small" id="stop">Stop</button></div>
        <div class="prompt">${esc(topicText)}</div>
        ${mode.rule ? `<p style="text-align:center" class="warnc"><b>${esc(mode.rule)}</b></p>` : ''}
        ${stagesHtml}
        <div class="big" id="timer">${fmtTime(secs)}</div>
        ${meterHtml('lvl')}
        <p class="muted" id="status">Start talking whenever you're ready. The timer runs from now.</p>
        <div id="bridge" style="min-height:96px"></div>
        <div class="row muted"><span>Freezes: <b id="fz">0</b></span><span>Recovered: <b id="rc">0</b></span><span>Words: <b id="wc">0</b></span></div>
        <div class="transcript" id="tr"><span class="muted">Live transcript appears here…</span></div>
      </div>`;
    const tracker = new VoiceTracker({ thresholdDb: threshold });
    const listener = new Listener({ onText: t => { $('#tr').textContent = t; $('#wc').textContent = countWords(t); } });
    listener.start();
    const recorder = new Recorder(mic.stream);
    recorder.start();
    let freezes = 0, recovered = 0, inFreeze = false, freezeStart = 0, ended = false, lastT = 0;
    const stopLoop = loop(mic, (db, t) => {
      if (ended) return;
      lastT = t;
      setMeter('lvl', db);
      const silence = tracker.update(db, t);
      const left = secs - t / 1000;
      $('#timer').textContent = fmtTime(Math.max(0, left));
      if (mode.stages) {
        let acc = 0;
        const frac = t / 1000 / secs;
        const idx = mode.stages.findIndex(s => (acc += s[1]) > frac);
        document.querySelectorAll('#stg span').forEach((sp, i) => sp.classList.toggle('on', i === (idx < 0 ? mode.stages.length - 1 : idx)));
      }
      if (silence > 1800 && !inFreeze) {
        inFreeze = true; freezes++; freezeStart = t;
        const p = pick(RESCUE_PHRASES);
        $('#bridge').innerHTML = `<div class="bridge">🌉 BRIDGE IT: <b>“${esc(p.phrase)}”</b><span class="muted">${esc(p.use)} · ${esc(pick(BRIDGE_TIPS))}</span></div>`;
        $('#fz').textContent = freezes;
      }
      if (inFreeze && silence === 0) {
        inFreeze = false;
        if (t - freezeStart < 6000) { recovered++; $('#rc').textContent = recovered; }
        $('#bridge').innerHTML = '';
      }
      if (left <= 0) finish();
    });
    $('#stop').onclick = () => finish();
    async function finish() {
      if (ended) return;
      ended = true;
      stopLoop();
      $('#status').textContent = 'Processing…';
      const [text, blob] = await Promise.all([listener.stop(), recorder.stop()]);
      const speakSec = tracker.firstVoiceT == null ? 0 : (lastT - tracker.firstVoiceT) / 1000;
      resolve({ secs, text, blob, speakSec, pauses: tracker.pauses, freezes, recovered, avgDb: tracker.avgVoicedDb() });
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
  return {
    words, wpm: wordsPerMinute(words, r.speakSec), speakSec: Math.round(r.speakSec),
    pausesPerMin: ps.perMin, longPausesPerMin: ps.longPerMin, longestPauseMs: ps.longestMs,
    freezes: r.freezes, recovered: r.recovered,
    repetitions: reps.length, repList: reps, fillers: fill.total, fillerItems: fill.items,
    maxSentence: sl.length ? Math.max(...sl) : 0,
    avgDb: r.avgDb == null ? null : +r.avgDb.toFixed(1),
    loudnessDelta: base != null && r.avgDb != null ? +(r.avgDb - base).toFixed(1) : undefined,
    restartsPerMin: r.speakSec > 0 ? +(reps.length / (r.speakSec / 60)).toFixed(1) : 0,
  };
}

export function highlight(text) {
  const words = (text || '').split(/\s+/).filter(Boolean);
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

function aiPrompt(topicText, r, m) {
  return `You are my English speaking coach. I'm an Indian English speaker training fluency, articulation and confidence (goal: speak like a confident native creator, e.g. Theo Browne).
Below is a speech-recognition transcript of my ${m.speakSec}-second impromptu talk on: "${topicText}".
Metrics: ${m.wpm} words/min, ${m.freezes} freezes (>1.8 s silence), ${m.repetitions} restarts/repeats, ${m.fillers} fillers.

Please:
1. List my grammar / word-choice mistakes (original → better), max 8.
2. Where I seem to have searched for a word or restarted, tell me the word/phrase I probably needed + a rescue phrase I could have used.
3. Rewrite my talk the way a fluent native speaker would SAY it (same ideas, spoken style, short sentences).
4. Give me 3 useful chunks/phrases from your rewrite to memorise.
5. One single thing to focus on next time.

Transcript: """${r.text}"""`;
}

async function showResults(main, modeKey, topicText, results, anxBefore) {
  const mode = MODES[modeKey];
  const ms = results.map(metricsOf);
  const last = ms[ms.length - 1], lastR = results[results.length - 1];
  const xp = 20 + Math.round(results.reduce((a, r) => a + r.speakSec, 0) / 6);
  const session = { ts: Date.now(), mode: modeKey, topic: topicText, rounds: ms.map(({ repList, fillerItems, ...rest }) => rest), anxBefore };
  S.sessions.push(session);
  logActivity(mode.kind, xp);
  for (const [i, r] of results.entries()) {
    if (r.blob && r.blob.size) {
      try {
        await saveRecording({ id: `${Date.now()}-${i}`, ts: Date.now(), kind: mode.kind, title: `${mode.name.split('(')[0].trim()}: ${topicText}${results.length > 1 ? ` (round ${i + 1})` : ''}`, blob: r.blob, metrics: ms[i] });
      } catch { /* storage full or unavailable */ }
    }
  }
  const kpi = m => `<div class="kpi">
      <div><b>${m.wpm}</b><span class="muted">words/min</span></div>
      <div><b>${m.freezes}</b><span class="muted">freezes (&gt;1.8s)</span></div>
      <div><b class="${m.recovered >= m.freezes ? 'ok' : 'warnc'}">${m.recovered}/${m.freezes}</b><span class="muted">recovered</span></div>
      <div><b class="${m.repetitions > 2 ? 'bad' : 'ok'}">${m.repetitions}</b><span class="muted">restarts/repeats</span></div>
      <div><b>${m.fillers}</b><span class="muted">fillers</span></div>
      <div><b>${m.pausesPerMin}</b><span class="muted">pauses/min</span></div>
      <div><b>${(m.longestPauseMs / 1000).toFixed(1)}s</b><span class="muted">longest pause</span></div>
      <div><b>${m.loudnessDelta === undefined ? '-' : (m.loudnessDelta > 0 ? '+' : '') + m.loudnessDelta + ' dB'}</b><span class="muted">vs usual voice</span></div>
    </div>`;
  const improved = ms.length > 1 && ms[ms.length - 1].wpm > ms[0].wpm;
  const table = ms.length > 1 ? `<br><table><tr><th>Round</th><th>Time</th><th>WPM</th><th>Freezes</th><th>Repeats</th><th>Fillers</th></tr>
      ${ms.map((m, i) => `<tr><td>${i + 1}</td><td>${fmtTime(results[i].secs)}</td><td>${m.wpm}</td><td>${m.freezes}</td><td>${m.repetitions}</td><td>${m.fillers}</td></tr>`).join('')}</table>
      <p class="${improved ? 'ok' : 'warnc'}">${improved ? `Speed rose ${ms[0].wpm} → ${ms[ms.length - 1].wpm} wpm. That's the 4/3/2 effect: repetition under time pressure builds automaticity.` : 'Speed did not rise yet. Next time reuse the exact phrases from round 1.'}</p>` : '';
  const url = lastR.blob && lastR.blob.size ? URL.createObjectURL(lastR.blob) : '';
  main.innerHTML = `
    <h1>Results: ${esc(topicText)}</h1>
    <div class="grid g2">
      <div class="card hl"><h2>${ms.length > 1 ? 'Final round' : 'Your numbers'}</h2>${kpi(last)}${table}</div>
      <div class="card"><h2>Coach notes</h2><ul>${coachNotes(last).map(n => `<li>${esc(n)}</li>`).join('')}</ul>
        ${Object.keys(last.fillerItems).length ? `<p class="muted">Fillers: ${Object.entries(last.fillerItems).map(([k, v]) => `${esc(k)}×${v}`).join(', ')}</p>` : ''}
        ${url ? `<audio controls src="${url}" style="width:100%"></audio><p class="muted">Listen back once. Where did you freeze, and what could you have said?</p>` : ''}
      </div>
    </div><br>
    <div class="card"><h2>Transcript</h2><p class="muted"><span class="rep">red</span> = restart/repeat · <span class="fill">orange</span> = filler · (speech recognition drops some “um”s)</p>
      <div class="transcript">${highlight(lastR.text) || '<span class="muted">No speech recognised. Use Edge/Chrome and check the mic.</span>'}</div></div><br>
    <div class="grid g2">
      <div class="card"><h2>How nervous now?</h2><input type="range" id="anx2" min="0" max="10" value="${Math.max(0, anxBefore - 1)}" style="width:100%"><b id="anx2v">${Math.max(0, anxBefore - 1)}</b>/10 (before: ${anxBefore})
        <br><br><button class="ghost" id="saveanx">Save rating</button></div>
      <div class="card"><h2>Get deeper AI feedback</h2><p class="muted">Copies a ready-made coaching prompt with your transcript. Paste it into ChatGPT / Copilot / Gemini.</p>
        <button id="copy">📋 Copy AI coach prompt</button></div>
    </div><br>
    <div class="row"><button id="again">🔁 Same topic again</button><button class="ghost" id="new">🎲 New topic</button></div>`;
  $('#anx2').oninput = e => { $('#anx2v').textContent = e.target.value; };
  $('#saveanx').onclick = () => { session.anxAfter = +$('#anx2').value; S.anxiety.push({ ts: Date.now(), before: anxBefore, after: session.anxAfter }); save(); toast('Saved'); };
  $('#copy').onclick = async () => { try { await navigator.clipboard.writeText(aiPrompt(topicText, lastR, last)); toast('Prompt copied. Paste into your AI chat.'); } catch { toast('Clipboard blocked'); } };
  $('#again').onclick = () => run(main, modeKey, topicText, anxBefore);
  $('#new').onclick = () => { topic = null; render(main, { mode: modeKey }); };
}
