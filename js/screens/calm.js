import { S, save, logActivity, ensureArr, rememberText, $, esc, pick, mic, ensureMic, sleep, meterHtml, setMeter, lineChart } from '../core.js';
import { loop, calibrate } from '../audio.js';
import { VoiceTracker, speechThreshold, speechReport } from '../metrics.js';
import { READING_PASSAGES, EXPOSURE_LADDER, TOPICS } from '../content.js';
import { FEARS } from '../library.js';
import { capture } from '../capture.js';
import { transcriptHtml, LEGEND, media } from '../ui.js';
import { icon } from '../icons.js';

const LEVELS = [
  { id: 1, name: 'One friend', size: 1, topics: 'easy' }, { id: 2, name: 'Team stand-up', size: 5, topics: 'easy' }, { id: 3, name: 'Classroom', size: 20, topics: 'medium' },
  { id: 4, name: 'Conference room', size: 60, topics: 'medium' }, { id: 5, name: 'Auditorium', size: 200, topics: 'hard' }, { id: 6, name: 'Tough crowd', size: 200, topics: 'hard' },
];
let tab = 'sigh';

export function render(main, params = {}) {
  if (params.t) tab = params.t === 'breath' ? 'sigh' : params.t === 'exposure' ? 'ladder' : params.t;
  main.innerHTML = `
    <p class="eyebrow"><a href="#/practice">Practice</a> · Nerves</p>
    <h1>Calm on stage</h1>
    <p class="sub">Nerves don’t disappear by waiting. They shrink when you <b>calm the body</b>, <b>test the fear</b> (the thing you predict mostly doesn’t happen), and <b>repeat with bigger audiences</b>. Your nerves are also far less visible than they feel.</p>
    <div class="tabs"><button data-t="sigh">Calm reset</button><button data-t="audience">Virtual audience</button><button data-t="video">Video self-review</button><button data-t="zone">Volume</button><button data-t="ladder">Real world</button></div>
    <div id="pane"></div>`;
  main.querySelectorAll('.tabs button').forEach(b => { b.classList.toggle('on', b.dataset.t === tab); b.onclick = () => { tab = b.dataset.t; render(main); }; });
  ({ sigh, audience, video, zone, ladder })[tab]($('#pane'));
}

// ---------- cyclic physiological sighing ----------
export async function sighSession(el, secs = 60, onDone) {
  const ball = $('.breath', el), label = $('#bp', el), left = $('#bl', el);
  const t0 = performance.now();
  while (el.isConnected && performance.now() - t0 < secs * 1000) {
    for (const [txt, scale, ms] of [['Inhale through the nose', 0.85, 2000], ['Top up: one more short inhale', 1, 900], ['Long, slow exhale through the mouth', 0.5, 6000]]) {
      if (!el.isConnected) return;
      label.textContent = txt;
      ball.style.transition = `transform ${ms}ms ease-in-out`;
      ball.style.transform = `scale(${scale})`;
      left.textContent = Math.max(0, Math.ceil(secs - (performance.now() - t0) / 1000)) + ' s';
      await sleep(ms);
    }
  }
  if (el.isConnected) { label.textContent = 'Calm. Now go speak.'; left.textContent = ''; onDone?.(); }
}

function sigh(pane) {
  pane.innerHTML = `<div class="grid g2" style="align-items:start"><div class="card hl" style="text-align:center"><h2>Cyclic sighing</h2>
    <p class="muted">Two inhales through the nose (the second is a short top-up), then a long exhale through the mouth. Five minutes a day lowered anxiety more than box breathing or mindfulness in a Stanford trial (Balban et al. 2023). One minute works right before you speak.</p>
    <div class="breath"></div><div class="prompt" id="bp">Ready</div><p class="faint" id="bl"></p>
    <div class="row" style="justify-content:center"><button id="b1">${icon('play')} 1 minute</button><button class="ghost" id="b5">5 minutes</button></div></div>
    <div class="card"><h2>Before you speak, also say this</h2>
      <p class="heard">“I am excited.”</p>
      <p class="muted">Say it out loud. People who reframed nerves as excitement gave better speeches than people who tried to calm down (Brooks 2014). Your racing heart is the same body state either way; the label changes what you do with it.</p>
      <h3 style="margin-top:18px">Remember</h3><p class="muted">Speakers think their nervousness is obvious. Audiences mostly can’t see it. Just knowing this made speeches better and less stressful in experiments (Savitsky &amp; Gilovich 2003).</p></div></div>`;
  const go = s => { $('#b1').disabled = $('#b5').disabled = true; sighSession(pane, s, () => logActivity('breath')); };
  $('#b1').onclick = () => go(60);
  $('#b5').onclick = () => go(300);
}

// ---------- virtual audience exposure with expectancy testing ----------
const unlocked = () => { const ok = (S.exposures || []).filter(e => e.after <= 40).map(e => e.level); return Math.min(6, Math.max(1, ...ok.map(l => l + 1), 1)); };

function audience(pane) {
  const top = unlocked();
  const ex = (S.exposures || []);
  pane.innerHTML = `<div class="grid g2" style="align-items:start"><div class="card hl"><h2>Choose your audience</h2>
    <p class="muted">Speak for two minutes to a virtual audience. Start small. A level unlocks the next when your nerves after speaking are 40/100 or lower. Exposure to virtual audiences reduced fear of public speaking in clinical trials (Anderson et al. 2005).</p>
    <div class="grid" style="gap:8px">${LEVELS.map(l => { const done = ex.filter(e => e.level === l.id); const best = done.length ? Math.min(...done.map(e => e.after)) : null; return `<label class="speaker ${l.id === Math.min(top, 6) ? 'me' : ''}" style="cursor:${l.id <= top ? 'pointer' : 'not-allowed'};opacity:${l.id <= top ? 1 : .45}"><input type="radio" name="lvl" value="${l.id}" ${l.id === top ? 'checked' : ''} ${l.id <= top ? '' : 'disabled'}><span><b>Level ${l.id}: ${esc(l.name)}</b><br><span class="faint">${l.size === 1 ? 'one person' : l.size + ' people'}${l.id === 6 ? ', some look bored' : ''}</span></span><span class="faint">${best == null ? (l.id <= top ? 'new' : 'locked') : `best after: ${best}`}</span></label>`; }).join('')}</div>
    <label style="display:block;margin-top:12px"><input type="checkbox" id="vcam"> Film me too (adds pressure)</label>
    <div class="row" style="margin-top:14px"><button class="big" id="prep">${icon('arrow')} Prepare</button></div></div>
    <div class="card"><h2>Nerves: before vs after</h2><canvas id="ac"></canvas><p class="faint">${ex.length} sessions. When the after line stays below before, that’s your fear shrinking. Feared outcome came true in <b>${ex.filter(e => e.happened).length}</b> of ${ex.filter(e => e.happened != null).length}.</p></div></div><div id="play"></div>`;
  lineChart($('#ac'), [{ label: 'before', values: ex.map(e => e.before), color: '#ff8a7a' }, { label: 'after', values: ex.map(e => e.after), color: '#7fd1c4' }]);
  $('#prep').onclick = () => prepare(pane, +pane.querySelector('input[name=lvl]:checked').value, $('#vcam').checked);
}

function prepare(pane, level, cam) {
  const L = LEVELS[level - 1];
  const topic = pick(TOPICS[L.topics]);
  pane.innerHTML = `<div class="card hl"><p class="eyebrow">Level ${level}: ${esc(L.name)} · before you go on</p>
    <h2>What are you afraid will happen?</h2>
    <div class="choice" id="fears">${FEARS.map((f, i) => `<label><input type="radio" name="fear" value="${esc(f)}" ${i === 0 ? 'checked' : ''}>${esc(f)}</label>`).join('')}</div>
    <div class="grid g2" style="margin-top:18px">
      <div><label>How sure are you it will happen? <b id="ev">60</b>%</label><input type="range" id="exp" min="0" max="100" value="60" style="width:100%"></div>
      <div><label>How nervous are you right now? <b id="bv">50</b>/100</label><input type="range" id="bef" min="0" max="100" value="50" style="width:100%"></div></div>
    <p class="muted" style="margin-top:14px">Your topic: <b>${esc(topic)}</b>. Two minutes. Say out loud: <i>“I am excited.”</i> Then go.</p>
    <div class="row"><button class="big" id="go">${icon('mic')} Go on stage</button><button class="ghost" id="calm">30 s calm reset first</button></div><div id="sig"></div></div>`;
  $('#exp').oninput = e => { $('#ev').textContent = e.target.value; };
  $('#bef').oninput = e => { $('#bv').textContent = e.target.value; };
  $('#calm').onclick = () => { $('#sig').innerHTML = '<div style="text-align:center"><div class="breath"></div><div class="prompt" id="bp"></div><p class="faint" id="bl"></p></div>'; sighSession($('#sig'), 30); };
  $('#go').onclick = async () => {
    const pre = { fear: pane.querySelector('input[name=fear]:checked').value, expect: +$('#exp').value, before: +$('#bef').value };
    const r = await capture(pane, { secs: 120, prompt: topic, label: `Level ${level}: ${L.name}`, audience: level, video: cam });
    if (!r || !pane.isConnected) return;
    after(pane, level, topic, pre, r);
  };
}

function after(pane, level, topic, pre, r) {
  pane.innerHTML = `<div class="card hl"><p class="eyebrow">Level ${level} · after</p><h2>You predicted: “${esc(pre.fear)}” (${pre.expect}% sure)</h2>
    <p>Did it actually happen?</p><div class="choice" id="hap"><label><input type="radio" name="h" value="0">No</label><label><input type="radio" name="h" value="0.5">A little</label><label><input type="radio" name="h" value="1">Yes</label></div>
    <div class="grid g2" style="margin-top:16px"><div><label>Highest nerves during the talk: <b id="pv">${pre.before}</b>/100</label><input type="range" id="peak" min="0" max="100" value="${pre.before}" style="width:100%"></div>
    <div><label>Nerves right now: <b id="av">${Math.max(0, pre.before - 15)}</b>/100</label><input type="range" id="aft" min="0" max="100" value="${Math.max(0, pre.before - 15)}" style="width:100%"></div></div>
    <button style="margin-top:14px" id="save">Save and see results</button></div>`;
  $('#peak').oninput = e => { $('#pv').textContent = e.target.value; };
  $('#aft').oninput = e => { $('#av').textContent = e.target.value; };
  $('#save').onclick = () => {
    const h = pane.querySelector('input[name=h]:checked');
    const happened = h ? +h.value : null;
    const rec = { ts: Date.now(), level, topic, ...pre, peak: +$('#peak').value, after: +$('#aft').value, happened, freezes: r.freezes };
    ensureArr('exposures').push(rec);
    S.anxiety.push({ ts: rec.ts, before: Math.round(pre.before / 10), after: Math.round(rec.after / 10), level });
    const rep = speechReport(r.text, r.speakSec);
    S.sessions.push({ ts: rec.ts, mode: 'audience', topic, rounds: [{ speakSec: Math.round(r.speakSec), wpm: rep.wpm, freezes: r.freezes, recovered: r.recovered, selfRestarts: 0, repetitions: rep.mazes.repetitions, fillers: rep.fillers, vaguePer100: rep.vaguePer100, zonePct: r.zonePct, clarity: r.clarity, explainScore: rep.explainScore }], anxBefore: Math.round(pre.before / 10), anxAfter: Math.round(rec.after / 10) });
    rememberText(r.text, topic);
    save();
    logActivity('audience');
    const lesson = happened === 0 ? `You were ${pre.expect}% sure, and it didn’t happen. Remember this next time the fear says the same thing.`
      : happened === 0.5 ? 'It happened a little, and you kept going. Surviving it is the lesson: it’s less bad than predicted.'
        : 'It happened, and you finished anyway. That’s the strongest lesson there is: you can handle it.';
    pane.innerHTML = `<div class="grid g2" style="align-items:start"><div class="card hl"><p class="eyebrow">What you learned</p><h2>${esc(lesson)}</h2>
      <div class="kpi" style="margin-top:14px"><div><b>${pre.before}→${rec.after}</b><span class="muted">nerves before → after</span></div><div><b>${rec.peak}</b><span class="muted">peak</span></div><div><b>${r.freezes}</b><span class="muted">freezes</span></div><div><b>${rep.fillers}</b><span class="muted">fillers</span></div></div>
      <p class="muted" style="margin-top:14px">${rec.after <= 40 ? (level < 6 ? `Level ${level + 1} is unlocked. Repeat this level once more if it still felt hard.` : 'Top level done. Now take it to a real room.') : 'Repeat this level until your nerves afterwards are 40 or lower. Repetition is what shrinks it.'}</p>
      <div class="row"><button id="again">Again</button><a class="btn ghost" href="#/calm?t=video">Review my video</a></div></div>
      <div class="card"><h2>Your talk</h2>${LEGEND}<div class="transcript">${transcriptHtml(r.text)}</div><br>${media(r.blob, r.video)}</div></div>`;
    $('#again').onclick = () => audience(pane);
  };
}

// ---------- video self-review with cognitive preparation ----------
function video(pane) {
  const vr = (S.videoReviews || []).slice(-6);
  pane.innerHTML = `<div class="grid g2" style="align-items:start"><div class="card hl"><h2>See yourself as others do</h2>
    <p class="muted">Record a 1-minute talk on camera. Before watching, predict how nervous you looked. Then watch it like a stranger’s video. People almost always look calmer than they predicted, and seeing that changes how you feel the next time (video feedback with cognitive preparation: Harvey, Clark et al. 2000).</p>
    <button class="big" id="go">${icon('mic')} Record on camera</button></div>
    <div class="card"><h2>Predicted vs actual</h2>${vr.length ? `<table><tr><th>Date</th><th>Predicted</th><th>Actually looked</th></tr>${vr.reverse().map(v => `<tr><td>${new Date(v.ts).toLocaleDateString()}</td><td>${v.predicted}/10</td><td><b class="${v.actual < v.predicted ? 'ok' : 'warnc'}">${v.actual}/10</b></td></tr>`).join('')}</table>` : '<p class="muted">No reviews yet.</p>'}</div></div><div id="play"></div>`;
  $('#go').onclick = async () => {
    const topic = pick(TOPICS.medium);
    const r = await capture($('#play'), { secs: 60, prompt: topic, label: 'On camera', video: true });
    if (!r || !pane.isConnected) return;
    $('#play').innerHTML = `<div class="card hl"><h2>Before you watch</h2>
      <label>How nervous do you think you <b>looked</b>? <b id="pv">6</b>/10</label><input type="range" id="pred" min="0" max="10" value="6" style="width:100%">
      <label style="display:block;margin-top:10px">What do you think a viewer will notice?</label><input id="notice" placeholder="e.g. shaky voice, looking away, lots of ums" style="width:100%">
      <p class="muted" style="margin-top:12px">Now watch it as if it’s a stranger’s video. Look at what is actually there, not at how it felt.</p><button id="watch">Watch</button></div>`;
    $('#pred').oninput = e => { $('#pv').textContent = e.target.value; };
    $('#watch').onclick = () => {
      const predicted = +$('#pred').value, notice = $('#notice').value;
      $('#play').innerHTML = `<div class="card hl">${media(r.blob, r.video)}<label style="display:block;margin-top:14px">Watching it as a stranger: how nervous did this person actually look? <b id="avv">${Math.max(0, predicted - 2)}</b>/10</label>
        <input type="range" id="act" min="0" max="10" value="${Math.max(0, predicted - 2)}" style="width:100%"><button id="sv" style="margin-top:12px">Save</button></div>`;
      $('#act').oninput = e => { $('#avv').textContent = e.target.value; };
      $('#sv').onclick = () => {
        const actual = +$('#act').value;
        ensureArr('videoReviews').push({ ts: Date.now(), predicted, actual, notice });
        save();
        logActivity('video');
        $('#play').innerHTML = `<div class="card hl"><h2>${actual < predicted ? `You predicted ${predicted}, you looked ${actual}. The nerves felt bigger inside than they looked outside.` : actual === predicted ? 'Prediction matched. Keep filming: most people find the gap grows as they watch more.' : 'You looked more nervous than you expected. That’s useful: pick one visible thing (eye contact, pace) and fix only that next time.'}</h2>
          <button id="again" class="ghost">Another</button></div>`;
        $('#again').onclick = () => video(pane);
      };
    };
  };
}

// ---------- volume ----------
async function measureVoiced(ms, meterId, noise) {
  const tr = new VoiceTracker({ thresholdDb: speechThreshold(noise) });
  await new Promise(res => { const stop = loop(mic, (d, t) => { tr.update(d, t); setMeter(meterId, d); }); setTimeout(() => { stop(); res(); }, ms); });
  return tr.avgVoicedDb();
}

function zone(pane) {
  const b = S.volume.baseline;
  const z = b != null ? [b + 4, b + 14] : null;
  const hist = S.zone.slice(-8).map(x => x.pct + '%').join(' · ') || 'none yet';
  pane.innerHTML = `<div class="grid g2">
    <div class="card"><h2>1. Calibrate your usual voice</h2>
      <p>Say in your <b>normal everyday voice</b>: <i>“Hi, I’m practising my English today. I want to speak clearly and confidently.”</i></p>
      ${meterHtml('cal')}<br><button id="calgo">Calibrate (6 s)</button>
      <p class="faint">Baseline: <b id="bv">${b == null ? 'not set' : b.toFixed(1) + ' dBFS'}</b>. Keep the same mic distance each time.</p></div>
    <div class="card hl"><h2>2. Hold the confident zone</h2>
      ${z ? `<p>Read aloud and keep the bar in the <span class="ok">green zone</span> (+4 to +14 dB over your usual voice). Talk to someone 3 metres away; Demosthenes practised over the roar of the sea.</p>
      ${meterHtml('zm', z)}<p class="faint">History: ${hist}</p><button id="zgo">Start 40 s reading</button>` : '<p class="warnc">Calibrate first.</p>'}
      <div id="zres"></div></div></div><br>
    <div class="card"><h2>Projection ladder</h2><p class="muted">Five lines, each one step louder: quiet → small room → classroom → hall → stage. Power from the belly, not the throat.</p>${meterHtml('lm')}<br><button class="ghost" id="lgo">Start ladder</button><div id="lres"></div></div>`;
  $('#calgo').onclick = async () => {
    if (!(await ensureMic())) return;
    $('#bv').textContent = 'quiet 1 s…';
    const noise = await calibrate(mic, 1000);
    $('#bv').textContent = 'speak now…';
    const avg = await measureVoiced(6000, 'cal', noise);
    if (avg == null) { $('#bv').textContent = 'no voice detected; try again'; return; }
    S.volume.baseline = avg; S.volume.noise = noise;
    save();
    zone(pane);
  };
  if (z) $('#zgo').onclick = async () => {
    if (!(await ensureMic())) return;
    $('#zres').innerHTML = `<br><div class="passage" style="font-size:18px">${esc(pick(READING_PASSAGES))}</div><div class="big" id="zt">40</div><p>In zone: <b id="zp">0</b>%</p>`;
    const noise = S.volume.noise ?? (await calibrate(mic, 800));
    const tr = new VoiceTracker({ thresholdDb: speechThreshold(noise) });
    await new Promise(res => {
      const stop = loop(mic, (d, t) => {
        tr.update(d, t, z); setMeter('zm', d);
        $('#zt').textContent = Math.max(0, Math.ceil(40 - t / 1000)); $('#zp').textContent = tr.zonePct();
        if (t >= 40000 || !pane.isConnected) { stop(); res(); }
      });
    });
    const pct = tr.zonePct();
    S.zone.push({ ts: Date.now(), pct, avg: tr.avgVoicedDb() });
    save();
    logActivity('zone');
    $('#zres').innerHTML = `<br><div class="kpi"><div><b class="${pct >= 70 ? 'ok' : 'warnc'}">${pct}%</b><span class="muted">in the confident zone</span></div><div><b>${tr.avgVoicedDb() == null ? '–' : '+' + (tr.avgVoicedDb() - S.volume.baseline).toFixed(1) + ' dB'}</b><span class="muted">vs usual voice</span></div></div>
      <p class="faint">${pct >= 70 ? 'Great projection. It didn’t sound like shouting from the outside.' : 'Push air from your belly, open your mouth wider, aim at the far wall.'}</p>`;
  };
  $('#lgo').onclick = async () => {
    if (!(await ensureMic())) return;
    const lines = ['Good morning, everyone.', 'Thanks for joining today.', 'Let me show you something important.', 'This is the key part.', 'And that is why it matters!'];
    const noise = await calibrate(mic, 800);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      if (!pane.isConnected) return;
      $('#lres').innerHTML = `<br><div style="text-align:center"><span class="pill">Level ${i + 1}/5 · ${['quiet', 'small room', 'classroom', 'hall', 'STAGE'][i]}</span><div class="prompt">${esc(lines[i])}</div></div>`;
      out.push(await measureVoiced(3500, 'lm', noise));
      await sleep(400);
    }
    const ok = out.every((v, i) => i === 0 || (v != null && out[i - 1] != null && v > out[i - 1]));
    logActivity('ladder');
    $('#lres').innerHTML = `<br><p class="${ok ? 'ok' : 'warnc'}">${ok ? 'Perfect staircase: you control your volume.' : 'Some steps didn’t get louder. Exaggerate the difference.'} <span class="faint">${out.map(v => v == null ? '–' : v.toFixed(0)).join(' → ')} dB</span></p>`;
  };
}

// ---------- real-world ladder ----------
function ladder(pane) {
  const next = EXPOSURE_LADDER.find(e => !S.exposure[e.id]);
  const log = (S.exposureLog || []).slice(-8).reverse();
  pane.innerHTML = `<div class="grid g2" style="align-items:start"><div class="card hl ladder"><h2>Real-world ladder</h2>
    <p class="muted">The virtual stage is practice; real rooms are the goal. Climb one rung at a time, repeat a rung until it feels boring, then move up.</p>
    ${EXPOSURE_LADDER.map(e => `<label><input type="checkbox" data-id="${e.id}" ${S.exposure[e.id] ? 'checked' : ''}> <span class="pill">L${e.level}</span> ${esc(e.text)} ${S.exposure[e.id] ? `<span class="faint">done ${new Date(S.exposure[e.id]).toLocaleDateString()}</span>` : ''}</label>`).join('')}</div>
  <div class="card"><h2>Log a real moment</h2>
    <p class="faint">Meetings, calls, Toastmasters, a reel. Write what you feared beforehand, then whether it happened.</p>
    <input id="ewhat" placeholder="What did you do?" style="width:100%" value="${next ? esc(next.text) : ''}"><br><br>
    <input id="efear" placeholder="What did you fear would happen?" style="width:100%"><br><br>
    <div class="row"><label>Before <input type="number" id="eb" min="0" max="10" value="7" style="width:64px"></label><label>After <input type="number" id="ea" min="0" max="10" value="4" style="width:64px"></label>
      <label><input type="checkbox" id="ehap"> fear came true</label><button id="elog">Log it</button></div>
    <table style="margin-top:10px">${log.map(x => `<tr><td>${new Date(x.ts).toLocaleDateString()}</td><td>${esc(x.what)}${x.fear ? `<br><span class="faint">feared: ${esc(x.fear)} · ${x.happened ? 'happened' : 'didn’t happen'}</span>` : ''}</td><td>${x.before}→<b class="${x.after < x.before ? 'ok' : 'warnc'}">${x.after}</b></td></tr>`).join('')}</table>
    <p class="faint" style="margin-top:10px">Recorded it? Upload it in <a href="#/real">Real life</a> to see how you actually spoke.</p></div></div>`;
  pane.querySelectorAll('input[type=checkbox][data-id]').forEach(cb => cb.onchange = () => {
    if (cb.checked) { S.exposure[cb.dataset.id] = Date.now(); logActivity('exposure'); } else { delete S.exposure[cb.dataset.id]; save(); }
    ladder(pane);
  });
  $('#elog').onclick = () => {
    const what = $('#ewhat').value.trim();
    if (!what) return;
    const before = Math.max(0, Math.min(10, +$('#eb').value)), after = Math.max(0, Math.min(10, +$('#ea').value));
    S.exposureLog = S.exposureLog || [];
    S.exposureLog.push({ ts: Date.now(), what, before, after, fear: $('#efear').value.trim(), happened: $('#ehap').checked });
    S.anxiety.push({ ts: Date.now(), before, after, real: true });
    logActivity('realworld');
    ladder(pane);
  };
}

