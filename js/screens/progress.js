import { S, save, replaceState, $, esc, toast } from '../core.js';
import { listRecordings, deleteRecording } from '../audio.js';
import { dayKey, weekNumber } from '../metrics.js';
import { PHASES, WEEK_THEMES } from '../content.js';
import { skillMap } from './skills.js';

let tab = 'skills';

export function render(main, params = {}) {
  if (params.t) tab = params.t;
  main.innerHTML = `<p class="eyebrow">Progress</p><h1>Proof that you’re changing</h1>
    <p class="sub">Scores come from what you actually said, not from points for showing up. Listen to your first recording next to your latest one. That is the real scoreboard.</p>
    <div class="tabs">${[['skills', 'Skills'], ['recordings', 'Recordings'], ['history', 'History'], ['plan', 'Six-month plan'], ['data', 'Your data']].map(([k, l]) => `<button data-t="${k}">${l}</button>`).join('')}</div><div id="pane"></div>`;
  main.querySelectorAll('.tabs button').forEach(b => { b.classList.toggle('on', b.dataset.t === tab); b.onclick = () => { tab = b.dataset.t; render(main); }; });
  ({ skills: skillMap, recordings, history, plan, data })[tab]($('#pane'));
}

function mediaTag(r, preload, url) {
  const u = url || URL.createObjectURL(r.blob);
  return r.video || r.blob.type.startsWith('video') ? `<video controls preload="${preload}" src="${u}" style="width:100%;max-height:300px;border-radius:12px"></video>` : `<audio controls preload="${preload}" src="${u}" style="width:100%"></audio>`;
}

async function recordings(pane) {
  pane.innerHTML = '<div id="cmp"></div><div class="card"><h2>All recordings</h2><p class="faint">Saved only in this browser. Download the ones you want to keep forever.</p><div id="recs" class="muted">Loading…</div></div>';
  let recs = [];
  try { recs = await listRecordings(); } catch { /* unsupported */ }
  const bench = recs.filter(r => r.kind === 'benchmark');
  const sp = bench.length >= 2 ? bench : recs.filter(r => r.kind?.startsWith('speak') || r.kind === 'benchmark' || r.kind === 'explain');
  if (sp.length >= 2) {
    const first = sp[sp.length - 1], latest = sp[0];
    const card = (r, label, cls) => `<div class="card ${cls}"><p class="eyebrow">${label} · ${new Date(r.ts).toLocaleDateString()}</p><p class="muted">${esc(r.title)}</p>${mediaTag(r, 'auto')}
      <p class="faint" style="margin-top:8px">${r.metrics?.wpm ?? '–'} wpm · ${r.metrics?.freezes ?? '–'} freezes · ${Math.max(r.metrics?.repetitions || 0, r.metrics?.selfRestarts || 0)} restarts · ${r.metrics?.fillers ?? '–'} fillers</p></div>`;
    $('#cmp').innerHTML = `<h2>${bench.length >= 2 ? 'Benchmark: first vs latest' : 'First vs latest'}</h2><div class="grid g2">${card(first, 'First', '')}${card(latest, 'Latest', 'hl')}</div><br>`;
  }
  if (!pane.isConnected) return;
  $('#recs').innerHTML = recs.length ? `<table>${recs.slice(0, 80).map(r => {
    const u = URL.createObjectURL(r.blob);
    const ext = r.blob.type.includes('mp4') ? (r.video ? 'mp4' : 'm4a') : 'webm';
    return `<tr><td style="min-width:160px">${new Date(r.ts).toLocaleString()}<br><span class="faint">${r.video ? 'Video · ' : ''}${esc(r.title)}</span></td><td style="width:45%">${mediaTag(r, 'none', u)}</td>
      <td class="faint">${r.metrics ? `${r.metrics.wpm} wpm<br>${r.metrics.fillers ?? '–'} fillers` : ''}</td>
      <td><a href="${u}" download="speakforge-${dayKey(new Date(r.ts))}-${r.id}.${ext}">download</a><br><a href="#" data-del="${r.id}">delete</a></td></tr>`;
  }).join('')}</table>` : 'No recordings yet. Do a speech.';
  $('#recs').querySelectorAll('[data-del]').forEach(a => a.onclick = async e => { e.preventDefault(); await deleteRecording(a.dataset.del); recordings(pane); });
}

function history(pane) {
  const rows = S.sessions.slice().reverse().slice(0, 60);
  pane.innerHTML = `<div class="card"><h2>Speeches</h2>${rows.length ? `<table><tr><th>Date</th><th>Mode</th><th>Topic</th><th>WPM</th><th>Freezes</th><th>Restarts</th><th>Fillers</th><th>Vague/100</th><th>Clarity</th></tr>
    ${rows.map(s => { const r = s.rounds[s.rounds.length - 1]; return `<tr><td>${new Date(s.ts).toLocaleDateString()}</td><td>${esc(s.mode)}</td><td>${esc(s.topic)}</td><td>${r.wpm}</td><td>${r.freezes}</td><td>${Math.max(r.repetitions || 0, r.selfRestarts || 0)}</td><td>${r.fillers}</td><td>${r.vaguePer100 ?? '–'}</td><td>${r.aiClarity ?? r.explainScore ?? '–'}</td></tr>`; }).join('')}</table>` : '<p class="muted">No speeches yet.</p>'}</div><br>
    <div class="card"><h2>Explanations</h2>${(S.explains || []).length ? `<table><tr><th>Date</th><th>Task</th><th>Score</th><th>Point heard</th></tr>${S.explains.slice().reverse().slice(0, 40).map(e => `<tr><td>${new Date(e.ts).toLocaleDateString()}</td><td>${esc(e.prompt)}</td><td><b>${e.score}</b>/10</td><td class="muted">${esc(e.heard || '')}</td></tr>`).join('')}</table>` : '<p class="muted">None yet. Try the <a href="#/explain">Explain gym</a>.</p>'}</div><br>
    <div class="card"><h2>Audience exposures</h2>${(S.exposures || []).length ? `<table><tr><th>Date</th><th>Level</th><th>Feared outcome</th><th>Nerves</th><th>Happened?</th></tr>${S.exposures.slice().reverse().slice(0, 40).map(e => `<tr><td>${new Date(e.ts).toLocaleDateString()}</td><td>${e.level}</td><td>${esc(e.fear || '')} <span class="faint">(${e.expect ?? '–'}% sure)</span></td><td>${e.before}→<b class="${e.after < e.before ? 'ok' : 'warnc'}">${e.after}</b></td><td>${e.happened == null ? '–' : e.happened ? 'yes' : '<span class="ok">no</span>'}</td></tr>`).join('')}</table>` : '<p class="muted">None yet. Try the <a href="#/calm?t=audience">virtual audience</a>.</p>'}</div>`;
}

function plan(pane) {
  const week = Math.min(26, weekNumber(S.startDate, dayKey()));
  const phase = PHASES.find(p => week >= p.weeks[0] && week <= p.weeks[1]) || PHASES[3];
  pane.innerHTML = `
    <div class="card row"><span>Start date</span><input type="date" id="sd" value="${S.startDate}"><button class="ghost small" id="sds">Save</button><span class="muted">You are in <b>week ${week}</b> · ${esc(phase.name)}</span></div><br>
    <div class="grid g2">${PHASES.map(p => `<div class="card phase ${p === phase ? 'now' : ''}"><p class="eyebrow">Weeks ${p.weeks[0]}-${p.weeks[1]}</p><h2>${esc(p.name)}</h2><p class="muted">${esc(p.goal)}</p>
      <p>${Array.from({ length: p.weeks[1] - p.weeks[0] + 1 }, (_, i) => p.weeks[0] + i).map(w => `<span class="pill ${w === week ? 'on' : ''}">W${w}: ${esc(WEEK_THEMES[w])}</span>`).join(' ')}</p></div>`).join('')}</div><br>
    <div class="grid g2">
      <div class="card"><h2>Weekly rhythm</h2><table>
        <tr><td>Mon-Fri</td><td>Today’s workout (one button)</td></tr>
        <tr><td>Saturday</td><td><b>Benchmark</b>: same 1-minute self-introduction + R passage. Day 1 vs day 180.</td></tr>
        <tr><td>Sunday</td><td>Upload one real conversation from the week (Real life) and do one real-world rung.</td></tr>
        <tr><td>Weekly</td><td>Toastmasters or a tutor call from week 10. Climb one virtual-audience level when nerves after ≤ 30.</td></tr></table></div>
      <div class="card"><h2>Targets</h2><table><tr><th>Measure</th><th>Month 1</th><th>Month 3</th><th>Month 6</th></tr>
        <tr><td>Fillers per minute</td><td>&lt; 6</td><td>&lt; 3</td><td>&lt; 1.5</td></tr>
        <tr><td>Restarts per minute</td><td>&lt; 4</td><td>&lt; 2</td><td>&lt; 1</td></tr>
        <tr><td>Freezes per minute</td><td>&lt; 3</td><td>&lt; 1.5</td><td>&lt; 0.7</td></tr>
        <tr><td>Explanation score</td><td>5/10</td><td>7/10</td><td>8.5/10</td></tr>
        <tr><td>Vague words per 100</td><td>&lt; 7</td><td>&lt; 4</td><td>&lt; 2.5</td></tr>
        <tr><td>Word retrieval</td><td>&lt; 2.5 s</td><td>&lt; 1.8 s</td><td>&lt; 1.4 s</td></tr>
        <tr><td>Audience level (nerves after ≤ 30)</td><td>2</td><td>4</td><td>6</td></tr></table></div>
    </div>`;
  $('#sds').onclick = () => { S.startDate = $('#sd').value || dayKey(); save(); toast('Saved'); plan(pane); };
}

function data(pane) {
  pane.innerHTML = `<div class="card"><h2>Your data</h2><p class="muted">Progress lives in this browser (localStorage + IndexedDB). Export weekly as a backup.</p>
    <div class="row"><button class="ghost" id="exp">Export progress (JSON)</button><label class="btn ghost">Import<input type="file" id="imp" accept=".json" class="hidden"></label><span class="spacer"></span><button class="red small" id="reset">Reset everything</button></div></div>`;
  $('#exp').onclick = () => {
    const a = document.createElement('a');
    const safe = { ...S, ai: { ...S.ai, key: '' } };
    a.href = URL.createObjectURL(new Blob([JSON.stringify(safe, null, 1)], { type: 'application/json' }));
    a.download = `speakforge-progress-${dayKey()}.json`;
    a.click();
  };
  $('#imp').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try { replaceState(JSON.parse(await f.text())); toast('Imported'); } catch { toast('Invalid file'); }
  };
  $('#reset').onclick = () => { if (confirm('Delete all progress (recordings stay)?')) { replaceState({}); toast('Reset'); } };
}
