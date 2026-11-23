import { S, save, logActivity, addToDeck, ensureArr, rememberText, $, esc, mic, ensureMic, toast, sleep, lineChart } from '../core.js';
import { Recorder } from '../audio.js';
import { speechReport, countWords } from '../metrics.js';
import { LOCAL } from '../local.js';
import { aiReady, chatJson, realMessages, REAL_SCHEMA } from '../ai.js';
import { transcriptHtml, LEGEND } from '../ui.js';
import { icon } from '../icons.js';

const ENROLL_TEXT = 'I’m recording my voice so SpeakForge can recognise me in meetings. I usually talk about software, my projects, and what my team is building. Sometimes I explain things quickly, sometimes slowly, and that’s fine. The more naturally I speak now, the better it will find me later.';
const COLORS = ['#f2b544', '#7fd1c4', '#b9a6ff', '#ff8a7a', '#8fb8ff', '#e6a3d1', '#a8d98a', '#c9b8cc'];
let last = null;

export async function render(main) {
  main.innerHTML = `<p class="eyebrow">Real life</p><h1>How you really speak</h1>
    <p class="sub">Upload a meeting, call, interview or voice note. SpeakForge finds your voice, measures only what <b>you</b> said, and turns your real mistakes into tomorrow’s drills. Practice transfers when it’s built from real conversations.</p>
    <div id="body"></div>`;
  const body = $('#body');
  if (!LOCAL.ok || !LOCAL.whisper) {
    body.innerHTML = `<div class="card hl"><h2>Runs on your Mac only</h2><p class="muted">Real recordings contain other people’s voices, so they are never sent anywhere. This feature needs the local engine (Whisper + speaker recognition). Start SpeakForge with <code>./start.sh</code> (after <code>./setup_mac.sh</code> once), then reload.</p></div>${history()}`;
    drawHistory();
    return;
  }
  let st = { enrolled: false };
  try { st = await (await fetch('api/enroll', { cache: 'no-store' })).json(); } catch { /* old server */ }
  if (!body.isConnected) return;
  body.innerHTML = `<div class="grid g2" style="align-items:start">
      <div class="card hl"><p class="eyebrow">${icon('upload')} Upload</p><h2>Add a recording</h2>
        <div class="drop" id="drop"><p style="margin:0 0 10px"><b>Drop an audio or video file here</b></p><p class="faint">m4a, mp3, wav, webm, mp4, mov · up to 2 hours</p>
          <label class="btn ghost">Choose file<input type="file" id="file" accept="audio/*,video/*" class="hidden"></label></div>
        <input id="title" placeholder="Name it (e.g. Monday stand-up)" style="width:100%;margin-top:12px">
        <p class="faint" style="margin-top:10px">Everything is processed on this Mac and nothing is uploaded anywhere. Ask people before you record them.</p><div id="job"></div></div>
      <div class="card"><p class="eyebrow">Your voiceprint</p><h2>${st.enrolled ? 'SpeakForge knows your voice' : 'Teach SpeakForge your voice'}</h2>
        <p class="muted">${st.enrolled ? `Enrolled ${st.ts ? new Date(st.ts * (st.ts < 1e12 ? 1000 : 1)).toLocaleDateString() : ''}. Your turns are picked out automatically.` : 'Read the passage below for about 20 seconds so your turns are found automatically. Without it, you pick yourself from the speakers after each upload.'}</p>
        <p class="passage" style="font-size:16px">${esc(ENROLL_TEXT)}</p>
        <div class="row"><button id="enroll" class="${st.enrolled ? 'ghost' : ''}">${icon('mic')} ${st.enrolled ? 'Re-record' : 'Record my voiceprint'}</button>${st.enrolled ? '<button class="ghost small" id="forget">Forget it</button>' : ''}<span class="faint" id="est"></span></div></div>
    </div><div id="result"></div>${history()}`;
  drawHistory();
  if (last) showResult(last.result, last.url, last.title);
  bindEnroll(main);
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) upload(f); });
  $('#file').onchange = e => { const f = e.target.files[0]; if (f) upload(f); };
}

function bindEnroll(main) {
  let rec = null;
  $('#enroll').onclick = async e => {
    const btn = e.currentTarget;
    if (!rec) {
      if (!(await ensureMic())) return;
      rec = new Recorder(mic.stream); rec.start();
      btn.innerHTML = 'Done reading'; $('#est').textContent = 'Recording… read the passage naturally.';
      return;
    }
    const blob = await rec.stop(); rec = null;
    btn.disabled = true; $('#est').textContent = 'Learning your voice…';
    try {
      const r = await fetch('api/enroll', { method: 'POST', body: blob, headers: { 'Content-Type': blob.type || 'audio/webm' } });
      const j = await r.json();
      if (r.status === 404) throw new Error('Your SpeakForge server is out of date. Close it and run ./start.sh again.');
      if (!r.ok || j.error) throw new Error(j.error || r.status);
      toast('Voiceprint saved');
      render(main);
    } catch (err) { $('#est').innerHTML = `<span class="bad">${esc(err.message)}</span>`; btn.disabled = false; btn.innerHTML = 'Try again'; }
  };
  const f = $('#forget');
  f.onclick = async () => { await fetch('api/enroll', { method: 'DELETE' }); toast('Voiceprint deleted'); render(main); };
}

async function upload(file) {
  const title = $('#title').value.trim() || file.name.replace(/\.[^.]+$/, '');
  const url = URL.createObjectURL(file);
  const jobEl = $('#job');
  jobEl.innerHTML = `<br><div class="row"><b id="stage">Uploading…</b><span class="spacer"></span><span class="faint" id="pct"></span></div><div class="bar" style="margin-top:8px"><i id="pbar" style="width:2%"></i></div>`;
  try {
    const r = await fetch('api/reallife', { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
    const j = await r.json();
    if (r.status === 404) throw new Error('Your SpeakForge server is out of date. Close it and run ./start.sh again.');
    if (!r.ok || j.error) throw new Error(j.error || r.status);
    const t0 = Date.now();
    for (;;) {
      await sleep(1500);
      const s = await (await fetch(`api/job?id=${encodeURIComponent(j.job)}`, { cache: 'no-store' })).json();
      if (!jobEl.isConnected) { last = s.status === 'done' ? { result: s.result, url, title } : last; return; }
      if (s.status === 'error') throw new Error(s.error || 'analysis failed');
      if (s.status === 'done') { jobEl.innerHTML = ''; last = { result: s.result, url, title }; showResult(s.result, url, title, true); return; }
      $('#stage').textContent = (s.stage || 'working').replace(/^./, c => c.toUpperCase()) + '…';
      $('#pbar').style.width = Math.round(100 * (s.progress || 0.02)) + '%';
      $('#pct').textContent = `${Math.round((Date.now() - t0) / 1000)} s`;
    }
  } catch (e) { jobEl.innerHTML = `<p class="bad">Couldn’t analyse it: ${esc(e.message)}</p>`; }
}

// Metrics for one speaker, from word timings.
export function speakerMetrics(result, id) {
  const segs = result.segments.filter(s => s.speaker === id);
  const words = segs.flatMap(s => s.words || []);
  const text = segs.map(s => s.text).join(' ');
  const talkSec = segs.reduce((a, s) => a + Math.max(0, s.end - s.start), 0);
  const rep = speechReport(text, talkSec);
  let freezes = 0;
  for (const s of segs) for (let i = 1; i < (s.words || []).length; i++) if (s.words[i].s - s.words[i - 1].e >= 1.8) freezes++;
  const total = result.segments.reduce((a, s) => a + Math.max(0, s.end - s.start), 0) || 1;
  const turns = segs.map(s => ({ ...s, n: countWords(s.text) })).sort((a, b) => b.n - a.n);
  return { text, rep, talkSec, freezes, freezesPerMin: +(freezes / Math.max(talkSec / 60, 0.25)).toFixed(1), talkShare: Math.round(100 * talkSec / total), turns, words: words.length || rep.words, longestTurn: turns[0]?.n || 0, avgTurn: segs.length ? Math.round(countWords(text) / segs.length) : 0 };
}

const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function showResult(result, url, title, fresh = false) {
  const box = $('#result');
  if (!result.segments?.length) { box.innerHTML = '<br><div class="card bad">No speech found in that file.</div>'; return; }
  let me = result.me || (result.speakers.length === 1 ? result.speakers[0].id : null);
  const dur = result.duration || Math.max(...result.segments.map(s => s.end));
  const color = id => id === me ? '#f2b544' : COLORS[1 + (result.speakers.findIndex(s => s.id === id) % (COLORS.length - 1))];
  const draw = () => {
    box.innerHTML = `<br><div class="card"><p class="eyebrow">${esc(title)} · ${fmt(dur)}</p><h2>Who is who</h2>
      <audio id="rau" src="${url}" controls preload="metadata" style="width:100%;margin-bottom:10px"></audio>
      <div class="tl" title="timeline">${result.segments.map(s => `<i style="left:${100 * s.start / dur}%;width:${Math.max(0.2, 100 * (s.end - s.start) / dur)}%;background:${color(s.speaker)};opacity:${s.speaker === me ? 1 : .55}"></i>`).join('')}</div>
      ${result.speakers.map(sp => `<label class="speaker ${sp.id === me ? 'me' : ''}"><input type="radio" name="me" value="${sp.id}" ${sp.id === me ? 'checked' : ''}>
        <span><b style="color:${color(sp.id)}">${sp.id === me ? 'You' : 'Speaker ' + sp.id.replace(/\D/g, '')}</b> <span class="faint">· ${fmt(sp.seconds)} talking · ${sp.turns ?? ''} turns${sp.similarity != null ? ` · voice match ${Math.round(100 * sp.similarity)}%` : ''}</span></span>
        <button class="ghost small" data-play="${sp.sample?.start ?? 0}" data-end="${sp.sample?.end ?? 0}">${icon('play')} sample</button></label>`).join('')}
      ${me ? '' : '<p class="warnc">Which one is you? Play the samples and pick.</p>'}</div><div id="mine"></div>`;
    box.querySelectorAll('input[name=me]').forEach(r => r.onchange = () => { me = r.value; draw(); });
    const au = $('#rau');
    box.querySelectorAll('[data-play]').forEach(b => b.onclick = e => { e.preventDefault(); au.currentTime = +b.dataset.play; au.play(); const end = +b.dataset.end; if (end) { const stop = () => { if (au.currentTime >= end) { au.pause(); au.removeEventListener('timeupdate', stop); } }; au.addEventListener('timeupdate', stop); } });
    if (me) mine(result, me, title, url, fresh);
    fresh = false;
  };
  draw();
}

function mine(result, me, title, url, fresh) {
  const m = speakerMetrics(result, me);
  const r = m.rep;
  const el = $('#mine');
  el.innerHTML = `<br><div class="grid g2" style="align-items:start">
    <div class="card hl"><h2>Your numbers in real life</h2><div class="kpi">
      <div><b class="${r.fillersPerMin > 3 ? 'bad' : 'ok'}">${r.fillersPerMin}</b><span class="muted">fillers/min</span></div>
      <div><b class="${r.mazesPerMin > 2 ? 'warnc' : 'ok'}">${r.mazesPerMin}</b><span class="muted">restarts/min</span></div>
      <div><b class="${r.vaguePer100 > 4 ? 'warnc' : 'ok'}">${r.vaguePer100}</b><span class="muted">vague words/100</span></div>
      <div><b>${m.freezesPerMin}</b><span class="muted">long pauses/min</span></div>
      <div><b>${r.wpm}</b><span class="muted">words/min</span></div>
      <div><b>${m.talkShare}%</b><span class="muted">of the talking</span></div></div>
      <p class="faint" style="margin-top:12px">${m.turns.length} turns · longest ${m.longestTurn} words · average ${m.avgTurn} words. ${Object.entries(r.fillerItems).slice(0, 5).map(([k, v]) => `${esc(k)} ×${v}`).join(' · ')}</p>
      <p class="faint">${Object.keys(r.lex.vagueItems).length ? `Your vague words: ${Object.entries(r.lex.vagueItems).slice(0, 6).map(([k, v]) => `${esc(k)} ×${v}`).join(', ')}` : ''}</p></div>
    <div class="card" id="rai"><h2>Coach review</h2><div id="raiout"></div></div></div><br>
    <div class="card"><h2>Your longest turns</h2>${LEGEND}${m.turns.slice(0, 6).map(t => `<div style="margin:12px 0"><div class="row"><button class="ghost small" data-seek="${t.start}">${icon('play')} ${fmt(t.start)}</button><span class="faint">${t.n} words</span><span class="spacer"></span><a class="faint" href="#/explain?q=${encodeURIComponent(t.text.slice(0, 140))}">Re-explain this ${icon('arrow')}</a></div><div class="transcript">${transcriptHtml(t.text)}</div></div>`).join('')}</div>`;
  el.querySelectorAll('[data-seek]').forEach(b => b.onclick = () => { const au = $('#rau'); au.currentTime = +b.dataset.seek; au.play(); });
  if (fresh) {
    ensureArr('reallife').push({ ts: Date.now(), title, duration: Math.round(result.duration || 0), metrics: { fillersPerMin: r.fillersPerMin, vaguePer100: r.vaguePer100, mazesPerMin: r.mazesPerMin, wpm: r.wpm, talkShare: m.talkShare, freezesPerMin: m.freezesPerMin, words: r.words } });
    rememberText(m.text, 'Real: ' + title);
    save();
    logActivity('reallife');
  }
  review(m, result, me);
}

function turnsForAi(result, me) {
  const out = [];
  let budget = 2600;
  const segs = result.segments;
  const mineIdx = segs.map((s, i) => [s, i]).filter(([s]) => s.speaker === me).sort((a, b) => countWords(b[0].text) - countWords(a[0].text)).slice(0, 10).sort((a, b) => a[1] - b[1]);
  for (const [s, i] of mineIdx) {
    const prev = segs.slice(0, i).reverse().find(x => x.speaker !== me);
    const line = `${prev ? `[Other] ${prev.text.slice(0, 140)}\n` : ''}[Learner] ${s.text}`;
    const w = countWords(line);
    if (w > budget) break;
    budget -= w;
    out.push(line);
  }
  return out.join('\n\n');
}

async function review(m, result, me) {
  const box = $('#raiout');
  if (!aiReady(S.ai)) { box.innerHTML = '<p class="muted">Connect the AI coach in <a href="#/settings">Settings</a> for a review of your real turns: patterns, unclear moments and upgrades.</p>'; return; }
  if (m.rep.words < 25) { box.innerHTML = '<p class="muted">Not enough of your speech in this recording for a review.</p>'; return; }
  box.innerHTML = '<p class="muted">Reading your turns…</p>';
  try {
    const cache = last && last.result === result ? (last.reviews = last.reviews || {}) : {};
    const j = cache[me] || await chatJson(S.ai, realMessages(turnsForAi(result, me), S.settings), REAL_SCHEMA, { timeoutMs: 300000 });
    cache[me] = j;
    if (!box.isConnected) return;
    const ups = (j.upgrades || []).filter(u => u && u.said && u.better), lost = (j.lost_words || []).filter(w => w && w.word);
    const rec = (S.reallife || []).slice(-1)[0];
    if (rec && j.focus_this_week) { rec.focus = j.focus_this_week; save(); }
    box.innerHTML = `${j.summary ? `<p>${esc(j.summary)}</p>` : ''}
      ${j.focus_this_week ? `<div class="heard">This week: ${esc(j.focus_this_week)}</div><br>` : ''}
      ${(j.patterns || []).length ? `<h3>Patterns</h3><ul>${j.patterns.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      ${(j.wins || []).length ? `<h3>What went well</h3><ul class="ok">${j.wins.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      ${(j.unclear_moments || []).length ? `<h3>Where it got unclear</h3>${j.unclear_moments.map(u => `<p>“${esc(u.quote)}”<br><span class="ok">→ ${esc(u.better)}</span></p>`).join('')}` : ''}
      ${ups.length ? `<h3>Word upgrades</h3><table>${ups.map(u => `<tr><td class="warnc">${esc(u.said)}</td><td class="ok">${esc(u.better)}</td></tr>`).join('')}</table>` : ''}
      ${lost.length ? `<h3>Words to own</h3><p>${lost.map(w => `<span class="pill" title="${esc(w.example || '')}"><b>${esc(w.word)}</b> · ${esc(w.meaning || '')}</span>`).join(' ')}</p>` : ''}
      ${ups.length || lost.length ? '<button id="todeck">Turn these into drills</button>' : ''}`;
    $('#todeck').onclick = () => {
      ups.forEach(u => addToDeck(u.better, `Instead of “${u.said}” (from a real conversation). Say it in a sentence.`, 'Upgrade'));
      lost.forEach(w => addToDeck(w.word, `${w.meaning || ''}${w.example ? ` e.g. “${w.example}”` : ''}`));
      toast(`${ups.length + lost.length} items added to your deck`);
    };
  } catch (e) { box.innerHTML = `<p class="bad">AI review failed: ${esc(e.message)}</p>`; }
}

function history() {
  const h = (S.reallife || []).slice(-12);
  if (!h.length) return '';
  return `<div class="section-title"><h2>Your real conversations over time</h2></div><div class="grid g2"><div class="card"><canvas id="rlc"></canvas></div>
    <div class="card"><table><tr><th>Date</th><th>Recording</th><th>Fillers/min</th><th>Vague/100</th><th>Share</th></tr>${h.slice().reverse().map(x => `<tr><td>${new Date(x.ts).toLocaleDateString()}</td><td>${esc(x.title)}${x.focus ? `<br><span class="faint">${esc(x.focus)}</span>` : ''}</td><td>${x.metrics.fillersPerMin}</td><td>${x.metrics.vaguePer100}</td><td>${x.metrics.talkShare}%</td></tr>`).join('')}</table></div></div>`;
}
function drawHistory() {
  const h = (S.reallife || []).slice(-12);
  if (h.length) lineChart($('#rlc'), [{ label: 'fillers/min', values: h.map(x => x.metrics.fillersPerMin), color: '#b9a6ff' }, { label: 'vague/100', values: h.map(x => x.metrics.vaguePer100), color: '#f2b544' }, { label: 'restarts/min', values: h.map(x => x.metrics.mazesPerMin), color: '#ff8a7a' }]);
}

