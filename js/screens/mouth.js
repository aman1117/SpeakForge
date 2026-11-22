import { S, save, logActivity, $, esc, pick, shuffle, mic, ensureMic, sleep, meterHtml, setMeter } from '../core.js';
import { Listener, speechSupported, say, loop, calibrate } from '../audio.js';
import { similarity, missedWords, tokenize, countBursts, countWords, wordsPerMinute } from '../metrics.js';
import { TONGUE_TWISTERS, MINIMAL_PAIRS, READING_PASSAGES } from '../content.js';

const WARMUP = [
  ['Yawn + sigh, roll your shoulders. Relax the throat.', 20],
  ['Lip trills: “brrrrr” sliding your pitch low → high → low.', 20],
  ['Jaw: open as wide as comfortable, close slowly. ×10', 20],
  ['Tongue circles inside your lips: 5 clockwise, 5 anticlockwise.', 20],
  ['Big smile ↔ kiss lips (“eee-ooo”) ×10, exaggerate!', 20],
  ['Tongue tip taps: “ta-ta-ta, da-da-da, la-la-la, na-na-na”.', 20],
  ['Over-articulate slowly: “ma-me-mi-mo-mu, pa-pe-pi-po-pu”.', 20],
  ['Hum “mmmm” then open into a loud “mmm-AHHH” ×5. Feel the buzz in your face.', 20],
];

let tab = 'warmup';

export function render(main, params = {}) {
  if (params.t) tab = params.t;
  main.innerHTML = `
    <h1>👄 Mouth Gym</h1>
    <p class="sub">Articulation is a <b>motor skill</b>: lips, tongue and jaw moving precisely and fast. Train it like a muscle: warm up, drill, then speed.</p>
    <div class="tabs">
      <button data-t="warmup">🔥 3-min warm-up</button><button data-t="ddk">⏱️ Pa-ta-ka speed test</button>
      <button data-t="twister">🌀 Tongue twisters</button><button data-t="pairs">🎯 Minimal pairs</button><button data-t="pen">🖊️ Pen-in-mouth reading</button>
    </div><div id="pane"></div>`;
  main.querySelectorAll('.tabs button').forEach(b => {
    b.classList.toggle('on', b.dataset.t === tab);
    b.onclick = () => { tab = b.dataset.t; render(main); };
  });
  ({ warmup, ddk, twister, pairs, pen })[tab]($('#pane'));
}

function warmup(pane) {
  pane.innerHTML = `<div class="card hl"><h2>Guided warm-up (~3 min)</h2><p>Do this before every session, like stretching before a run.</p>
    <ol>${WARMUP.map(w => `<li>${esc(w[0])} <span class="muted">(${w[1]}s)</span></li>`).join('')}</ol><button id="wgo">Start guided warm-up ▶</button></div><div id="play"></div>`;
  $('#wgo').onclick = async () => {
    let stop = false;
    for (let i = 0; i < WARMUP.length && !stop && pane.isConnected; i++) {
      for (let s = WARMUP[i][1]; s > 0 && !stop; s--) {
        $('#play').innerHTML = `<br><div class="card" style="text-align:center"><span class="pill">Step ${i + 1}/${WARMUP.length}</span><div class="prompt">${esc(WARMUP[i][0])}</div><div class="big">${s}</div><button class="ghost small" id="wnext">Next ▶</button> <button class="ghost small" id="wstop">Stop</button></div>`;
        let next = false;
        $('#wnext').onclick = () => { next = true; };
        $('#wstop').onclick = () => { stop = true; };
        await sleep(1000);
        if (next) break;
      }
    }
    if (!stop && pane.isConnected) { logActivity('warmup', 10); $('#play').innerHTML = '<br><div class="card"><h2 class="ok">Warm-up done ✔</h2><p>Your mouth is ready. Go to the Speaking Arena or tongue twisters.</p></div>'; }
  };
}

function ddk(pane) {
  const hist = S.ddk.slice(-10).map(d => d.rate.toFixed(1)).join(' → ') || 'none yet';
  pane.innerHTML = `<div class="grid g2"><div class="card hl"><h2>Pa-ta-ka speed test</h2>
    <p>Speech therapists use this (diadochokinesis) to measure articulation speed. Say <b>“pa-ta-ka-pa-ta-ka…”</b> as fast <i>and clearly</i> as you can for 5 seconds.</p>
    ${meterHtml('dlvl')}<br><button id="dgo">Start (1 s quiet, then go) ▶</button><div id="dres"></div></div>
    <div class="card"><h2>History (syllables/sec)</h2><p>${hist}</p><p class="muted">Typical adults: ~5-7 syllables/sec. Clarity first; if syllables blur, slow down. Use a quiet room. The counter detects loudness bursts, so it's an estimate.</p></div></div>`;
  $('#dgo').onclick = async () => {
    if (!(await ensureMic())) return;
    $('#dres').innerHTML = '<p class="muted">Quiet… measuring room</p>';
    const noise = await calibrate(mic, 1000);
    const env = [];
    $('#dres').innerHTML = '<div class="big ok">GO!</div>';
    await new Promise(res => {
      const stop = loop(mic, d => { env.push(d); setMeter('dlvl', d); });
      setTimeout(() => { stop(); res(); }, 5000);
    });
    const peak = Math.max(...env);
    const thr = Math.max(noise + 10, peak - 18);
    const n = countBursts(env, thr, 3);
    const rate = n / 5;
    S.ddk.push({ ts: Date.now(), rate });
    save();
    logActivity('ddk', 5);
    $('#dres').innerHTML = `<div class="kpi"><div><b>${rate.toFixed(1)}</b><span class="muted">syllables/sec</span></div><div><b>${n}</b><span class="muted">syllables in 5 s</span></div></div>`;
  };
}

function twister(pane) {
  const opts = TONGUE_TWISTERS.map((t, i) => `<option value="${i}">[${esc(t.focus)}] ${esc(t.text.slice(0, 50))}</option>`).join('');
  pane.innerHTML = `<div class="card hl"><h2>Tongue twisters</h2>
    <p>Level 1: slow and exaggerated. Level 2: normal speed. Level 3: say it 3× fast. Score = how much speech recognition understood.</p>
    <select id="tw" style="width:100%">${opts}</select><br><br>
    <div class="passage" id="twt"></div><br>
    <div class="row"><button class="ghost" id="tl">🔊 Listen (slow)</button><button class="ghost" id="tf">🔊 Listen (fast)</button><button id="ttry">🎙️ Try it</button><button class="ghost" id="trand">🎲 Random</button></div>
    <div id="tres"></div></div>`;
  const cur = () => TONGUE_TWISTERS[+$('#tw').value];
  const show = () => { $('#twt').textContent = cur().text; $('#tres').innerHTML = ''; };
  show();
  $('#tw').onchange = show;
  $('#trand').onclick = () => { $('#tw').value = String(Math.floor(Math.random() * TONGUE_TWISTERS.length)); show(); };
  $('#tl').onclick = () => say(cur().text, { rate: 0.75 });
  $('#tf').onclick = () => say(cur().text, { rate: 1.15 });
  $('#ttry').onclick = async () => {
    if (!speechSupported()) { $('#tres').innerHTML = '<p class="bad">Needs Edge/Chrome.</p>'; return; }
    if (!(await ensureMic())) return;
    const l = new Listener();
    l.start();
    const t0 = performance.now();
    $('#tres').innerHTML = '<br><p class="warnc"><b>Listening…</b> say it, then press Done.</p><div class="transcript" id="ttr"></div><br><button id="tdone">Done</button>';
    const iv = setInterval(() => { $('#ttr').textContent = l.text(); }, 150);
    $('#tdone').onclick = async () => {
      clearInterval(iv);
      const heard = await l.stop();
      const secs = (performance.now() - t0) / 1000;
      const score = similarity(cur().text, heard);
      const missed = missedWords(cur().text, heard);
      S.twisters.push({ ts: Date.now(), text: cur().text, score });
      save();
      logActivity('twister', 5);
      $('#tres').innerHTML = `<br><div class="kpi"><div><b class="${score >= 85 ? 'ok' : score >= 60 ? 'warnc' : 'bad'}">${score}%</b><span class="muted">understood</span></div><div><b>${secs.toFixed(1)}s</b><span class="muted">time</span></div></div>
        <p>Heard: “${esc(heard)}”</p>${missed.length ? `<p>Unclear words: ${missed.map(m => `<b class="bad">${esc(m)}</b>`).join(', ')}: slow down and over-articulate these.</p>` : '<p class="ok">Every word was clear!</p>'}`;
    };
  };
}

function pairs(pane) {
  const opts = MINIMAL_PAIRS.map((g, i) => `<option value="${i}">${esc(g.group)}</option>`).join('');
  const stats = MINIMAL_PAIRS.map(g => {
    const rs = S.pairs.filter(p => p.group === g.group);
    if (!rs.length) return '';
    const last = rs[rs.length - 1];
    return `<tr><td>${esc(g.group)}</td><td>${last.score}%</td><td>${rs.length}</td></tr>`;
  }).join('');
  pane.innerHTML = `<div class="grid g2"><div class="card hl"><h2>Minimal pairs</h2>
    <p>Words that differ by one sound. If the recogniser hears the <i>other</i> word, the listener would too.</p>
    <select id="pg">${opts}</select> <button id="pgo">Start 10 trials ▶</button>
    <p class="muted" id="ptip"></p><div id="play"></div></div>
    <div class="card"><h2>Your scores</h2>${stats ? `<table><tr><th>Sound</th><th>Last</th><th>Rounds</th></tr>${stats}</table>` : '<p class="muted">No rounds yet.</p>'}
    <p class="muted">Most important for Indian English speakers: <b>V vs W</b>, <b>TH</b>, short/long vowels.</p></div></div>`;
  const g = () => MINIMAL_PAIRS[+$('#pg').value];
  const tip = () => { $('#ptip').textContent = '💡 ' + g().tip; };
  tip();
  $('#pg').onchange = tip;
  $('#pgo').onclick = async () => {
    if (!speechSupported()) { $('#play').innerHTML = '<p class="bad">Needs Edge/Chrome.</p>'; return; }
    if (!(await ensureMic())) return;
    const group = g();
    const l = new Listener();
    l.start();
    await sleep(400);
    let correct = 0;
    const trials = shuffle(group.pairs.flatMap(p => [[p[0], p[1]], [p[1], p[0]]])).slice(0, 10);
    for (let i = 0; i < trials.length && pane.isConnected; i++) {
      const [target, other] = trials[i];
      const mark = l.finalText.length;
      let verdict = null;
      $('#play').innerHTML = `<div style="text-align:center"><span class="pill">${i + 1}/${trials.length}</span><div class="prompt">Say: <span style="font-size:34px">${esc(target)}</span></div><p class="muted">(not “${esc(other)}”)</p>
        <button class="ghost small" id="plisten">🔊 hear it</button> <button class="ghost small" id="pskip">skip</button><p id="pheard" class="muted">listening…</p></div>`;
      $('#plisten').onclick = () => say(`${target}. ${target}.`, { rate: 0.8 });
      let skip = false;
      $('#pskip').onclick = () => { skip = true; };
      const t0 = performance.now();
      while (!verdict && !skip && performance.now() - t0 < 6000) {
        await sleep(120);
        const toks = tokenize(l.finalText.slice(mark) + ' ' + l.interim);
        $('#pheard').textContent = toks.join(' ') || 'listening…';
        const tl = target.toLowerCase(), ol = other.toLowerCase();
        if (toks.includes(tl)) verdict = 'ok';
        else if (toks.includes(ol)) verdict = 'other';
      }
      if (verdict === 'ok') correct++;
      $('#pheard').innerHTML = verdict === 'ok' ? '<b class="ok">✔ clear</b>' : verdict === 'other' ? `<b class="bad">✘ sounded like “${esc(other)}”</b>` : '<b class="warnc">not recognised</b>';
      await sleep(900);
    }
    await l.stop();
    if (!pane.isConnected) return;
    const score = Math.round(100 * correct / trials.length);
    S.pairs.push({ ts: Date.now(), group: group.group, score });
    save();
    logActivity('pairs', 10);
    $('#play').innerHTML = `<div class="kpi"><div><b class="${score >= 80 ? 'ok' : 'warnc'}">${score}%</b><span class="muted">${esc(group.group)}</span></div></div><p class="muted">${esc(group.tip)}</p>`;
  };
}

function pen(pane) {
  const passage = pick(READING_PASSAGES);
  const hist = S.pen.slice(-6).map(p => `${p.score}% · ${p.wpm} wpm`).join(' → ') || 'none yet';
  pane.innerHTML = `<div class="card hl"><h2>Pen-in-mouth reading (Mona's drill)</h2>
    <p><b>Step 1:</b> Hold a pen <i>horizontally</i> between your teeth (like a dog holding a bone). Read the passage aloud for 60 s, working hard to be understood. Your tongue and lips have to work extra.<br>
    <b>Step 2:</b> Remove the pen and read it again. It will feel incredibly easy and crisp. SpeakForge scores this second read.</p>
    <p class="muted">History: ${hist}</p>
    <div class="passage card" style="background:var(--panel2)">${esc(passage)}</div><br>
    <div class="row"><button id="p1">Step 1: 60 s with pen ▶</button><button class="ghost" id="p2">Skip to step 2</button></div><div id="pres"></div></div>`;
  const step2 = async () => {
    if (!speechSupported()) { $('#pres').innerHTML = '<p class="bad">Needs Edge/Chrome for scoring.</p>'; return; }
    if (!(await ensureMic())) return;
    const l = new Listener();
    l.start();
    const t0 = performance.now();
    $('#pres').innerHTML = '<br><p class="warnc"><b>Step 2: pen out. Read clearly at a comfortable pace.</b></p><div class="transcript" id="ptr"></div><br><button id="pdone">Done reading</button>';
    const iv = setInterval(() => { $('#ptr').textContent = l.text(); }, 200);
    $('#pdone').onclick = async () => {
      clearInterval(iv);
      const heard = await l.stop();
      const secs = (performance.now() - t0) / 1000;
      const score = similarity(passage, heard);
      const wpm = wordsPerMinute(countWords(passage), secs);
      S.pen.push({ ts: Date.now(), score, wpm });
      save();
      logActivity('pen', 15);
      const missed = [...new Set(missedWords(passage, heard))];
      $('#pres').innerHTML = `<br><div class="kpi"><div><b class="${score >= 90 ? 'ok' : 'warnc'}">${score}%</b><span class="muted">understood</span></div><div><b>${wpm}</b><span class="muted">reading wpm</span></div></div>
        ${missed.length ? `<p>Mumbled/unclear: ${missed.slice(0, 15).map(m => `<b class="bad">${esc(m)}</b>`).join(', ')}</p>` : '<p class="ok">Crystal clear!</p>'}`;
    };
  };
  $('#p1').onclick = async () => {
    for (let s = 60; s > 0 && pane.isConnected; s--) {
      $('#pres').innerHTML = `<br><div style="text-align:center"><p>🖊️ Pen in. Read aloud, over-articulate.</p><div class="big">${s}</div><button class="ghost small" id="pnext">Go to step 2</button></div>`;
      let next = false;
      $('#pnext').onclick = () => { next = true; };
      await sleep(1000);
      if (next) break;
    }
    step2();
  };
  $('#p2').onclick = step2;
}
