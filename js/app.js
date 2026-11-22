import { S, save, replaceState, renderXp, $, esc, todayCount, streak, lineChart, toast } from './core.js';
import { stopAllAudio, listRecordings, deleteRecording } from './audio.js';
import { dayKey, weekNumber, levelFromXp } from './metrics.js';
import { PHASES, WEEK_THEMES } from './content.js';
import * as speak from './screens/speak.js';
import * as words from './screens/words.js';
import * as mouth from './screens/mouth.js';
import * as voice from './screens/voice.js';
import * as shadow from './screens/shadow.js';
import * as phrases from './screens/phrases.js';
import * as coach from './screens/coach.js';
import * as skills from './screens/skills.js';
import { focusCard, weeklyCard } from './screens/skills.js';
import { aiReady } from './ai.js';

const MISSIONS = {
  Foundation: [
    ['warmup', 1, '3-min mouth warm-up', '#/mouth?t=warmup', 3],
    ['zone', 1, 'Hold the confident volume zone (40 s)', '#/voice?t=zone', 3],
    ['pen', 1, 'Pen-in-mouth reading', '#/mouth?t=pen', 4],
    ['speak', 2, '1-minute random topic ×2', '#/speak?mode=oneMin', 5],
    ['phrases', 1, 'Phrase Bank review (rescue phrases)', '#/phrases', 4],
    ['naming', 1, 'Rapid naming round', '#/words?t=naming', 3],
  ],
  'Fluency engine': [
    ['warmup', 1, '3-min mouth warm-up', '#/mouth?t=warmup', 3],
    ['speak432', 1, '4/3/2 fluency (quick or full)', '#/speak?mode=quick432', 6],
    ['taboo', 2, 'Taboo ×2 (talk around words)', '#/words?t=taboo', 4],
    ['naming', 1, 'Rapid naming round', '#/words?t=naming', 3],
    ['shadow', 1, 'Shadowing 10 min', '#/shadow?t=along', 10],
    ['phrases', 1, 'Phrase Bank review', '#/phrases', 4],
  ],
  Expression: [
    ['warmup', 1, '3-min mouth warm-up', '#/mouth?t=warmup', 3],
    ['shadow', 1, 'Shadow a Theo/Mona clip 10 min', '#/shadow?t=own', 10],
    ['speak', 2, 'PREP or 10-word-sentence speech ×2', '#/speak?mode=prep', 5],
    ['twister', 3, 'Tongue twisters ×3', '#/mouth?t=twister', 3],
    ['phrases', 1, 'Phrase Bank review', '#/phrases', 4],
    ['zone', 1, 'Volume zone', '#/voice?t=zone', 2],
  ],
  'Creator mode': [
    ['warmup', 1, '3-min mouth warm-up', '#/mouth?t=warmup', 3],
    ['speakCreator', 2, 'Creator reel practice ×2 (Hook → CTA)', '#/speak?mode=creator', 6],
    ['shadow', 1, 'Shadow a creator clip 10 min', '#/shadow?t=own', 10],
    ['twister', 2, 'Tongue twisters ×2', '#/mouth?t=twister', 2],
    ['pairs', 1, 'Minimal pairs round', '#/mouth?t=pairs', 3],
    ['phrases', 1, 'Phrase Bank review', '#/phrases', 4],
  ],
};

export function currentWeek() { return Math.min(26, weekNumber(S.startDate, dayKey())); }
export function currentPhase() { const w = currentWeek(); return PHASES.find(p => w >= p.weeks[0] && w <= p.weeks[1]) || PHASES[PHASES.length - 1]; }

// Builds today's mission from the phase, the user's daily time budget and the weekday.
export function todaysTasks(phaseName, minutes, weekday, aiOn = false) {
  const all = MISSIONS[phaseName];
  let tasks;
  if (minutes <= 10) tasks = [all[0], ['speak', 1, '1-minute random topic', '#/speak?mode=oneMin', 3], ['phrases', 1, 'Phrase Bank review', '#/phrases', 4]];
  else if (minutes <= 20) tasks = all.slice(0, 4);
  else if (minutes >= 60) tasks = [...all, aiOn ? ['partner', 1, 'AI conversation partner (10 min)', '#/coach', 10] : ['taboo', 2, 'Taboo ×2 (describe without the word)', '#/words?t=taboo', 4], ['category', 1, 'Category sprint', '#/words?t=category', 2]];
  else tasks = all;
  if (weekday === 6) tasks = [['benchmark', 1, '⭐ Saturday benchmark speech', '#/speak?mode=benchmark', 3], ...tasks];
  if (weekday === 0) tasks = [...tasks, ['realworld', 1, '🌍 Sunday: one real-world speaking moment (then log it)', '#/voice?t=exposure', 10]];
  return tasks;
}

function home(main) {
  const week = currentWeek(), phase = currentPhase();
  const tasks = todaysTasks(phase.name, S.settings.dailyMinutes, new Date().getDay(), aiReady(S.ai));
  const done = tasks.filter(t => todayCount(t[0]) >= t[1]).length;
  const speakSessions = S.sessions.map(s => s.rounds[s.rounds.length - 1]);
  const totalSec = S.sessions.reduce((a, s) => a + s.rounds.reduce((b, r) => b + (r.speakSec || 0), 0), 0);
  const l = levelFromXp(S.xp);
  const restartsOf = r => Math.max(r.repetitions || 0, r.selfRestarts || 0);
  main.innerHTML = `
    <h1>Today · Week ${week}/26 · ${esc(phase.name)}</h1>
    <p class="sub">This week: <b>${esc(WEEK_THEMES[week] || '')}</b>. ${esc(phase.goal)} <a href="#/coach">(${S.settings.dailyMinutes} min/day · change)</a></p>
    <div class="grid g4">
      <div class="card"><div class="stat">${l.level} <small>level</small></div><div class="muted">${S.xp} XP</div></div>
      <div class="card"><div class="stat">🔥 ${streak()} <small>day streak</small></div><div class="muted">Don't break the chain</div></div>
      <div class="card"><div class="stat">${S.sessions.length} <small>speeches</small></div><div class="muted">${Math.round(totalSec / 60)} min spoken</div></div>
      <div class="card"><div class="stat">${done}/${tasks.length} <small>today</small></div><div class="muted">~${tasks.reduce((a, t) => a + t[4], 0)} min mission</div></div>
    </div><br>
    <div class="grid g2">
      <div class="card hl"><h2>✅ Today's mission</h2>
        ${tasks.map(t => { const c = todayCount(t[0]), ok = c >= t[1]; return `<a href="${t[3]}" style="text-decoration:none;color:inherit"><div class="task ${ok ? 'done' : ''}"><div class="chk">${ok ? '✔' : ''}</div><div class="t">${esc(t[2])}</div><span class="pill">${Math.min(c, t[1])}/${t[1]} · ${t[4]}m</span></div></a>`; }).join('')}
        <p class="muted">Order matters: warm-up first, speaking last. Miss a day? Just do the next one.</p></div>
      <div>${focusCard()}<br>${weeklyCard()}</div>
    </div><br>
    <div class="card"><h2>🧭 Your 5 problems → where to train</h2>
      <table>
        <tr><td><b>1. Forget a word → restart</b></td><td>Speaking Arena (BRIDGE cards, SPACE restart counter, No-Restart, Question chain), Word Lab (Taboo, Rapid naming incl. <i>My lost words</i>), Phrase Bank, AI conversation partner</td></tr>
        <tr><td><b>2. Articulation</b></td><td>Mouth Gym (warm-up, pen-in-mouth, twisters and minimal pairs with model-vs-you playback), clarity % in every speech, Shadowing</td></tr>
        <tr><td><b>3. Nervous to speak loudly</b></td><td>Live “speak up” coaching in the Arena, camera mode, calm-down ritual, Confidence Lab (volume zone, ladder, real-world exposure log)</td></tr>
        <tr><td><b>4. Daily system</b></td><td>This adaptive mission, focus of the day, weekly report, Saturday benchmark, 6-Month Plan, streak/XP</td></tr>
        <tr><td><b>5. Which skills?</b></td><td><a href="#/skills">Skill map</a>: your live score on each skill + lessons</td></tr>
      </table></div><br>
    <div class="grid g2">
      <div class="card"><h3>Speaking speed & freezes</h3><canvas id="c1"></canvas></div>
      <div class="card"><h3>Restarts & fillers per speech</h3><canvas id="c2"></canvas></div>
      <div class="card"><h3>Word retrieval speed (ms, lower = better)</h3><canvas id="c3"></canvas></div>
      <div class="card"><h3>Clarity % & volume-zone % per speech</h3><canvas id="c4"></canvas></div>
    </div>`;
  lineChart($('#c1'), [{ label: 'words/min', values: speakSessions.map(r => r.wpm), color: '#7c5cff' }, { label: 'freezes', values: speakSessions.map(r => r.freezes), color: '#f59e0b' }]);
  lineChart($('#c2'), [{ label: 'restarts', values: speakSessions.map(restartsOf), color: '#ef4444' }, { label: 'fillers', values: speakSessions.map(r => r.fillers), color: '#06b6d4' }]);
  lineChart($('#c3'), [{ label: 'naming ms', values: S.naming.map(n => n.avgMs), color: '#22c55e' }]);
  lineChart($('#c4'), [{ label: 'clarity %', values: speakSessions.filter(r => r.clarity != null).map(r => r.clarity), color: '#22c55e' }, { label: 'zone %', values: speakSessions.filter(r => r.zonePct != null).map(r => r.zonePct), color: '#06b6d4' }]);
}
function plan(main) {
  const week = currentWeek(), phase = currentPhase();
  main.innerHTML = `
    <h1>🗺️ Your 6-month plan</h1>
    <p class="sub">26 weeks, 4 phases, ~35 min/day. Built from the research on fluency (4/3/2, formulaic chunks, shadowing), articulation (motor drills), and anxiety (graded exposure), plus Mona's (babystepstothemic) proven routine.</p>
    <div class="card row"><span>Start date:</span><input type="date" id="sd" value="${S.startDate}"><button class="ghost small" id="sds">Save</button><span class="muted">You are in <b>week ${week}</b> · ${esc(phase.name)}</span></div><br>
    <div class="grid g2">${PHASES.map(p => `<div class="card phase ${p === phase ? 'now' : ''}"><h2>Weeks ${p.weeks[0]}-${p.weeks[1]} · ${esc(p.name)}</h2><p>${esc(p.goal)}</p>
      <p class="muted">${Array.from({ length: p.weeks[1] - p.weeks[0] + 1 }, (_, i) => p.weeks[0] + i).map(w => `<span class="pill" style="${w === week ? 'background:var(--accent);color:#fff' : ''}">W${w}: ${esc(WEEK_THEMES[w])}</span>`).join(' ')}</p></div>`).join('')}</div><br>
    <div class="grid g2">
      <div class="card"><h2>Daily routine (~35 min)</h2><table>
        <tr><td>3 min</td><td>Warm-up (Mouth Gym) + box breathing if nervous</td></tr>
        <tr><td>5 min</td><td>Articulation drill of the week (pen, twisters, minimal pairs)</td></tr>
        <tr><td>10 min</td><td>Shadowing (Theo/Mona clip or built-in scripts)</td></tr>
        <tr><td>5 min</td><td>Word Lab (naming / Taboo / sprints)</td></tr>
        <tr><td>3 min</td><td>Phrase Bank review</td></tr>
        <tr><td>8 min</td><td>Speaking Arena: 1-min topics, 4/3/2, PREP or Creator</td></tr>
        <tr><td>1 min</td><td>Rate nervousness, listen back to ONE recording</td></tr></table></div>
      <div class="card"><h2>Weekly rhythm</h2><table>
        <tr><td>Mon-Fri</td><td>Daily mission (Today tab)</td></tr>
        <tr><td>Sat</td><td><b>Benchmark speech:</b> “Introduce yourself and what you do” (1 min, same topic every week). Day 1 vs day 180 will shock you.</td></tr>
        <tr><td>Sun</td><td>Real-world rung on the Exposure Ladder (from month 2: Toastmasters / tutor call / meeting)</td></tr>
        <tr><td>Monthly</td><td>Deep analysis: download your benchmark recording and run <code>tools\\analyze_me.py</code> (compares you to Theo's numbers)</td></tr></table></div>
    </div><br>
    <div class="card"><h2>Targets</h2><table><tr><th>Metric</th><th>Month 1</th><th>Month 3</th><th>Month 6</th><th>Theo</th></tr>
      <tr><td>Freezes (&gt;1.8 s) per minute</td><td>&lt; 4</td><td>&lt; 2</td><td>&lt; 1</td><td>~0</td></tr>
      <tr><td>Restarts per minute</td><td>&lt; 4</td><td>&lt; 2</td><td>&lt; 1</td><td>rare</td></tr>
      <tr><td>Words per minute (impromptu)</td><td>110-130</td><td>130-150</td><td>150-170</td><td>~190</td></tr>
      <tr><td>Rapid naming avg</td><td>&lt; 2500 ms</td><td>&lt; 1800 ms</td><td>&lt; 1400 ms</td><td>-</td></tr>
      <tr><td>Volume zone %</td><td>50%</td><td>70%</td><td>85%</td><td>-</td></tr>
      <tr><td>Exposure ladder</td><td>L1-L3</td><td>L4-L6</td><td>L8-L10</td><td>-</td></tr></table></div>`;
  $('#sds').onclick = () => { S.startDate = $('#sd').value || dayKey(); save(); toast('Saved'); plan(main); };
}

function mediaTag(r, preload, url) {
  const u = url || URL.createObjectURL(r.blob);
  return r.video || r.blob.type.startsWith('video') ? `<video controls preload="${preload}" src="${u}" style="width:100%;max-height:300px;border-radius:10px"></video>` : `<audio controls preload="${preload}" src="${u}" style="width:100%"></audio>`;
}

async function journal(main) {
  main.innerHTML = `<h1>📓 Journal</h1><p class="sub">Every speech is saved locally (never uploaded). Listen to your first vs latest. That is your proof of progress.</p>
    <div id="cmp"></div><div class="card"><h2>Recordings</h2><div id="recs" class="muted">Loading…</div></div><br>
    <div class="card"><h2>Speech history</h2><div id="hist"></div></div><br>
    <div class="card"><h2>Your data</h2><div class="row"><button class="ghost" id="exp">⬇ Export progress (JSON)</button><label class="btn" style="background:var(--panel2);border:1px solid var(--line)">⬆ Import<input type="file" id="imp" accept=".json" class="hidden"></label><span class="spacer"></span><button class="red small" id="reset">Reset everything</button></div>
    <p class="muted">Progress lives in this browser (localStorage + IndexedDB). Export weekly as a backup.</p></div>`;
  let recs = [];
  try { recs = await listRecordings(); } catch { /* unsupported */ }
  const bench = recs.filter(r => r.kind === 'benchmark');
  const sp = bench.length >= 2 ? bench : recs.filter(r => r.kind?.startsWith('speak') || r.kind === 'benchmark');
  if (sp.length >= 2) {
    const first = sp[sp.length - 1], latest = sp[0];
    const card = (r, label, cls) => `<div class="card ${cls}"><h3>${label}: ${new Date(r.ts).toLocaleDateString()}</h3><p class="muted">${esc(r.title)}</p>${mediaTag(r, 'auto')}
      <p class="muted">${r.metrics?.wpm ?? '-'} wpm · ${r.metrics?.freezes ?? '-'} freezes · ${Math.max(r.metrics?.repetitions || 0, r.metrics?.selfRestarts || 0)} restarts${r.metrics?.clarity != null ? ` · ${r.metrics.clarity}% clarity` : ''}</p></div>`;
    $('#cmp').innerHTML = `<h2>${bench.length >= 2 ? '⭐ Benchmark: first vs latest' : 'First vs latest speech'}</h2><div class="grid g2">${card(first, 'First', '')}${card(latest, 'Latest', 'hl')}</div><br>`;
  }
  $('#recs').innerHTML = recs.length ? `<table>${recs.slice(0, 60).map(r => {
    const u = URL.createObjectURL(r.blob);
    const ext = r.blob.type.includes('mp4') ? (r.video ? 'mp4' : 'm4a') : 'webm';
    return `<tr><td>${new Date(r.ts).toLocaleString()}<br><span class="muted">${r.video ? '🎥 ' : ''}${esc(r.title)}</span></td><td>${mediaTag(r, 'none', u)}</td>
      <td class="muted">${r.metrics ? `${r.metrics.wpm} wpm<br>${r.metrics.freezes} freezes` : ''}</td>
      <td><a href="${u}" download="speakforge-${dayKey(new Date(r.ts))}-${r.id}.${ext}">download</a><br><a href="#" data-del="${r.id}">delete</a></td></tr>`;
  }).join('')}</table>` : 'No recordings yet. Do a Speaking Arena session.';
  $('#recs').querySelectorAll('[data-del]').forEach(a => a.onclick = async e => { e.preventDefault(); await deleteRecording(a.dataset.del); journal(main); });
  $('#hist').innerHTML = S.sessions.length ? `<table><tr><th>Date</th><th>Mode</th><th>Topic</th><th>WPM</th><th>Freezes</th><th>Restarts</th><th>Fillers</th><th>Nerves</th></tr>
    ${S.sessions.slice().reverse().slice(0, 50).map(s => { const r = s.rounds[s.rounds.length - 1]; return `<tr><td>${new Date(s.ts).toLocaleDateString()}</td><td>${esc(s.mode)}</td><td>${esc(s.topic)}</td><td>${r.wpm}</td><td>${r.freezes}</td><td>${Math.max(r.repetitions || 0, r.selfRestarts || 0)}</td><td>${r.fillers}</td><td>${s.anxBefore ?? '-'}→${s.anxAfter ?? '-'}</td></tr>`; }).join('')}</table>` : '<p class="muted">No speeches yet.</p>';
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
    try { replaceState(JSON.parse(await f.text())); toast('Imported'); journal(main); } catch { toast('Invalid file'); }
  };
  $('#reset').onclick = () => { if (confirm('Delete all progress (recordings stay)?')) { replaceState({}); journal(main); } };
}

const ROUTES = { home, plan, journal, speak: speak.render, words: words.render, mouth: mouth.render, voice: voice.render, shadow: shadow.render, phrases: phrases.render, coach: coach.render, skills: skills.render };

function route() {
  stopAllAudio();
  const raw = location.hash.replace(/^#\/?/, '') || 'home';
  const [name, qs] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  const fn = ROUTES[name] || home;
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#/' + name));
  const main = document.getElementById('app');
  window.scrollTo(0, 0);
  try { fn(main, params); } catch (e) { main.innerHTML = `<div class="card bad">Something broke: ${esc(e.message)}</div>`; console.error(e); }
}

window.addEventListener('hashchange', route);
if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
  const w = document.getElementById('warn');
  w.textContent = 'Speech recognition is not available in this browser. Open SpeakForge in Microsoft Edge or Google Chrome for transcripts and scoring.';
  w.classList.remove('hidden');
}
if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
renderXp();
route();
