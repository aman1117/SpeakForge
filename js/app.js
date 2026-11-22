import { S, save, renderXp, $, esc, todayCount, lineChart, todayMinutesSpoken } from './core.js';
import { stopAllAudio, setListenMode } from './audio.js';
import { dayKey, weekNumber, skillScores, focusOfDay, SKILL_GROUPS, SKILL_LINKS } from './metrics.js';
import { PHASES, WEEK_THEMES } from './content.js';
import { icon, ringsSvg } from './icons.js';
import { todaysTasks, startWorkout, workoutBar, stepDone, activeWorkout, skipStep } from './workout.js';
import * as speak from './screens/speak.js';
import * as words from './screens/words.js';
import * as mouth from './screens/mouth.js';
import * as calm from './screens/calm.js';
import * as shadow from './screens/shadow.js';
import * as phrases from './screens/phrases.js';
import * as coach from './screens/coach.js';
import * as progress from './screens/progress.js';
import * as theo from './screens/theo.js';
import * as explain from './screens/explain.js';
import * as fillers from './screens/fillers.js';
import * as real from './screens/real.js';
import * as masters from './screens/masters.js';
import { LOCAL, detectLocal, waitUntilReady, retryDetect } from './local.js';
import { aiReady } from './ai.js';
import { weeklyCard } from './screens/skills.js';

const NAV = [
  ['home', 'Today', 'today'], ['speak', 'Speak', 'mic', 'cta-link'],
  ['practice', 'Practice', 'practice', '', 'words,mouth,calm,voice,shadow,phrases,explain,fillers,partner,drills'],
  ['real', 'Real life', 'real'], ['progress', 'Progress', 'progress', '', 'skills,journal,plan'],
  ['masters', 'Learn from the best', 'masters', '', 'theo'], ['settings', 'Settings', 'settings', '', 'coach'],
];
const TABS = ['home', 'speak', 'practice', 'real', 'progress'];

function renderNav() {
  $('#nav').innerHTML = NAV.map(([r, label, ic, cls = '', also = '']) => `<a href="#/${r}" class="${cls}" data-also="${also}">${icon(ic)}${label}</a>`).join('');
  $('#tabbar').innerHTML = NAV.filter(n => TABS.includes(n[0])).map(([r, label, ic, , also = '']) => `<a href="#/${r}" data-also="${also}">${icon(ic)}${label}</a>`).join('');
}

export function currentWeek() { return Math.min(26, weekNumber(S.startDate, dayKey())); }
export function currentPhase() { const w = currentWeek(); return PHASES.find(p => w >= p.weeks[0] && w <= p.weeks[1]) || PHASES[PHASES.length - 1]; }
export { todaysTasks };

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Late-night rehearsal.' : h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : 'Good evening.';
}

export function groupScores(sc) {
  return Object.entries(SKILL_GROUPS).map(([g, ks]) => {
    const v = ks.map(k => sc[k]).filter(x => x != null);
    return [g, v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null, SKILL_LINKS[ks[0]]];
  });
}

function home(main) {
  const week = currentWeek(), phase = currentPhase();
  const sc = skillScores(S);
  const focus = focusOfDay(sc);
  const w = activeWorkout();
  const tasks = w ? w.steps : todaysTasks(phase.name, S.settings.dailyMinutes, new Date().getDay(), aiReady(S.ai), focus.skill);
  const done = tasks.filter(stepDone).length;
  const next = tasks.find(t => !stepDone(t));
  const minutesLeft = tasks.filter(t => !stepDone(t)).reduce((a, t) => a + t[4], 0);
  const talk = todayMinutesSpoken();
  const reps = todayCount('explain');
  main.innerHTML = `
    <p class="eyebrow">Week ${week} of 26 · ${esc(phase.name)}</p>
    <h1>${greeting()} ${next ? 'Your stage is ready.' : 'Today’s workout is done.'}</h1>
    <p class="sub">This week: <b>${esc(WEEK_THEMES[week] || '')}</b>. ${esc(phase.goal)}</p>
    <div class="hero">
      <div class="card hl workout-card">
        <div class="top">${ringsSvg([{ pct: done / tasks.length, color: '#7fd1c4' }, { pct: talk / 8, color: '#f2b544' }, { pct: reps / 2, color: '#b9a6ff' }])}
          <div class="ring-legend"><span><i style="background:var(--seaglass)"></i><b>${done}/${tasks.length}</b> workout steps</span>
            <span><i style="background:var(--brass)"></i><b>${talk}/8</b> minutes speaking</span><span><i style="background:var(--lilac)"></i><b>${reps}/2</b> explanations</span></div></div>
        <div class="row" style="margin:16px 0 4px">${next ? `<button class="big" id="startw">${icon('play')} ${w && done ? 'Continue workout' : 'Start today’s workout'}</button><span class="muted">${tasks.length - done} steps · about ${minutesLeft} min</span>`
          : '<a class="btn big" href="#/progress?t=recordings">Listen to today’s recordings</a><span class="muted">Come back tomorrow. Consistency beats intensity.</span>'}</div>
        <div class="runsheet">${tasks.map(t => { const ok = stepDone(t); return `<a href="${t[3]}" style="text-decoration:none;color:inherit"><div class="task ${ok ? 'done' : t === next ? 'now' : ''}"><div class="chk"></div><div class="t">${esc(t[2])}</div><span class="faint">${t[1] > 1 ? `${Math.min(todayCount(t[0]), t[1])}/${t[1]} · ` : ''}${t[4]} min</span></div></a>`; }).join('')}</div>
        <p class="faint" style="margin:12px 0 0">Daily time: ${S.settings.dailyMinutes} min (<a href="#/settings">change</a>). Missed a day? Just do the next one.</p>
      </div>
      <div class="grid" style="align-content:start">
        <a class="card" href="${focus.link[0]}"><p class="eyebrow">${icon('spark')} Focus of the day</p><h2>${esc(focus.skill)}</h2><p class="muted" style="margin:0">${esc(focus.reason.replace(/^./, c => c.toUpperCase()))}. Drill: <b>${esc(focus.link[1])}</b></p></a>
        <a class="card" href="#/calm?t=sigh"><p class="eyebrow">${icon('calm')} Nervous right now?</p><h2>60-second calm reset</h2><p class="muted" style="margin:0">Two inhales, one long exhale. The fastest breathing method for lowering stress in a 2023 Stanford trial.</p></a>
        <a class="card" href="#/real"><p class="eyebrow">${icon('real')} Real life</p><h2>Review a real conversation</h2><p class="muted" style="margin:0">Upload a meeting or call. SpeakForge finds your voice and scores how you really speak.</p></a>
      </div>
    </div>
    <div class="section-title"><h2>Your five problems</h2><span class="spacer"></span><a href="#/progress">All skills</a></div>
    <div class="problems">${groupScores(sc).map(([g, v, link]) => `<a class="problem" href="${link[0]}"><span class="lbl">${esc(g)}</span><span class="n" style="color:${v == null ? 'var(--dusk)' : v >= 75 ? 'var(--seaglass)' : v >= 50 ? 'var(--brass)' : 'var(--coral)'}">${v ?? '–'}</span><div class="bar"><i style="width:${v ?? 0}%;background:${v == null ? 'transparent' : v >= 75 ? 'var(--seaglass)' : v >= 50 ? 'var(--brass)' : 'var(--coral)'}"></i></div><span class="faint">${v == null ? 'Not measured yet' : 'out of 100'}</span></a>`).join('')}</div>
    <div class="section-title"><h2>How you’re changing</h2></div>
    <div class="grid g2c">
      <div class="card"><h3>Fillers and restarts per minute</h3><canvas id="c1"></canvas></div>
      <div class="card"><h3>Explanation clarity (0-10)</h3><canvas id="c2"></canvas></div>
      <div class="card"><h3>Vague words per 100 words</h3><canvas id="c3"></canvas></div>
      <div class="card"><h3>Nerves on stage, before and after (0-100)</h3><canvas id="c4"></canvas></div>
    </div><br>${weeklyCard()}`;
  if (next) $('#startw').onclick = () => startWorkout(tasks);
  const rs = S.sessions.map(s => s.rounds[s.rounds.length - 1]).filter(r => r.speakSec >= 10);
  const per = (r, k) => +((r[k] || 0) / Math.max(r.speakSec / 60, 0.25)).toFixed(1);
  lineChart($('#c1'), [{ label: 'fillers/min', values: rs.map(r => per(r, 'fillers')), color: '#b9a6ff' }, { label: 'restarts/min', values: rs.map(r => +(Math.max(r.repetitions || 0, r.selfRestarts || 0) / Math.max(r.speakSec / 60, 0.25)).toFixed(1)), color: '#ff8a7a' }]);
  lineChart($('#c2'), [{ label: 'explain gym', values: (S.explains || []).map(e => e.score), color: '#f2b544' }, { label: 'speeches (AI)', values: rs.map(r => r.aiClarity).filter(v => v != null), color: '#7fd1c4' }]);
  lineChart($('#c3'), [{ label: 'vague/100', values: [...rs.map(r => r.vaguePer100), ...(S.reallife || []).map(x => x.metrics?.vaguePer100)].filter(v => v != null), color: '#f2b544' }]);
  lineChart($('#c4'), [{ label: 'before', values: (S.exposures || []).map(e => e.before), color: '#ff8a7a' }, { label: 'after', values: (S.exposures || []).map(e => e.after), color: '#7fd1c4' }]);
}

const TRACKS = [
  { ic: 'word', title: 'I forget a word and restart the sentence', what: 'Retrieve words faster, and when one escapes, talk around it instead of rewinding.', why: 'Retrieval practice makes words faster to access; circumlocution can be trained (Dörnyei 1995).',
    drills: [['#/words?t=naming', 'Rapid word retrieval'], ['#/words?t=taboo', 'Taboo'], ['#/speak?mode=noRestart', 'No-Restart challenge'], ['#/phrases', 'Rescue phrases']] },
  { ic: 'gem', title: 'I use basic words', what: 'Find the vague words in your own speech and replace them with precise ones, out loud, in a sentence.', why: 'Words you need, choose and use yourself are remembered best (involvement load: Laufer & Hulstijn 2001).',
    drills: [['#/words?t=upgrade', 'Word upgrade'], ['#/words?t=better', 'Say it better'], ['#/words?t=naming&type=precise', 'Precise word retrieval']] },
  { ic: 'filler', title: 'I say “um” and “basically” a lot', what: 'Notice every filler, then replace it with a silent pause. This is the habit-reversal method.', why: 'Awareness training plus a competing response cut filled pauses in public speakers (Mancuso & Miltenberger 2016).',
    drills: [['#/fillers?t=aware', 'Spot your fillers'], ['#/fillers?t=live', 'Filler-free minute'], ['#/fillers?t=starts', 'Fresh starts']] },
  { ic: 'explain', title: 'My explanations get confusing', what: 'Plan for 20 seconds, lead with the point, give one example, stop. Then hear what the listener actually understood.', why: 'Planning time improves fluency and structure (Foster & Skehan 1996); repeating a task with feedback improves it (Bygate 2001).',
    drills: [['#/explain?f=answer', 'Answer first'], ['#/explain?f=feynman', 'Explain to a 12-year-old'], ['#/explain?f=answer&one=1', 'One-sentence headline'], ['#/partner', 'Confused listener']] },
  { ic: 'calm', title: 'I get nervous in front of people', what: 'Calm your body, test your fears in front of a virtual audience that grows, then take it into real life.', why: 'Graded and virtual-audience exposure reduce public-speaking anxiety (Anderson et al. 2005); cyclic sighing calms fastest (Balban et al. 2023).',
    drills: [['#/calm?t=sigh', 'Calm reset'], ['#/calm?t=audience', 'Virtual audience'], ['#/calm?t=video', 'Video self-review'], ['#/calm?t=ladder', 'Real-world ladder']] },
  { ic: 'voice', title: 'I want a clear, strong voice', what: 'Pause between thought groups, stress the key word, open your mouth, project.', why: 'Rhythm and pausing practice improved how easy learners were to understand more than sound drills did (Derwing et al. 1998).',
    drills: [['#/mouth?t=groups', 'Thought groups'], ['#/mouth?t=pen', 'Pebble drill'], ['#/mouth?t=twister', 'Tongue twisters'], ['#/mouth?t=pairs', 'Sound pairs'], ['#/calm?t=zone', 'Volume zone']] },
];

function practice(main) {
  main.innerHTML = `<p class="eyebrow">Practice</p><h1>Train the exact problem</h1>
    <p class="sub">Every drill here is backed by research or used by great speakers. Today’s workout picks them for you; come here when you want more reps on one thing.</p>
    <div class="grid g2">${TRACKS.map(t => `<div class="card track"><div class="ic">${icon(t.ic)}</div><div><h2>${esc(t.title)}</h2><p class="muted" style="margin:0 0 6px">${esc(t.what)}</p><p class="why">${esc(t.why)}</p>
      <div class="drills">${t.drills.map(([h, l]) => `<a href="${h}">${esc(l)}</a>`).join('')}</div></div></div>`).join('')}</div>
    <div class="section-title"><h2>Always useful</h2></div>
    <div class="grid g3">
      <a class="card" href="#/speak"><h3>${icon('mic')} Speak</h3><p class="muted" style="margin:0">1-minute topics, 4/3/2, PREP, question chain, reels, in front of a virtual audience.</p></a>
      <a class="card" href="#/partner"><h3>${icon('phrases')} Conversation partner</h3><p class="muted" style="margin:0">Talk with Gemma by voice: interviews, stand-ups, small talk, a confused listener.</p></a>
      <a class="card" href="#/shadow"><h3>${icon('shadow')} Shadowing</h3><p class="muted" style="margin:0">Speak along with a model voice, Theo and Mona clips, or classic speeches.</p></a>
      <a class="card" href="#/phrases"><h3>${icon('phrases')} Phrases and your words</h3><p class="muted" style="margin:0">Spaced repetition of chunks, lost words and upgrades, said in a sentence.</p></a>
      <a class="card" href="#/masters"><h3>${icon('masters')} Learn from the best</h3><p class="muted" style="margin:0">What Lincoln, Churchill, Feynman, Theo and Mona actually did, each linked to a drill.</p></a>
    </div>`;
}

const ROUTES = {
  home, practice, drills: practice, speak: speak.render, words: words.render, mouth: mouth.render, calm: calm.render, voice: calm.render,
  shadow: shadow.render, phrases: phrases.render, settings: coach.render, coach: coach.render, partner: coach.renderPartner,
  progress: progress.render, skills: progress.render, journal: (m, p) => progress.render(m, { ...p, t: 'recordings' }), plan: (m, p) => progress.render(m, { ...p, t: 'plan' }),
  theo: theo.render, masters: masters.render, explain: explain.render, fillers: fillers.render, real: real.render,
};

function route() {
  stopAllAudio();
  const raw = location.hash.replace(/^#\/?/, '') || 'home';
  const [name, qs] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  const fn = ROUTES[name] || home;
  document.querySelectorAll('#nav a, #tabbar a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#/' + name || (a.dataset.also || '').split(',').includes(name)));
  const main = document.getElementById('app');
  window.scrollTo(0, 0);
  main.style.animation = 'none'; void main.offsetWidth; main.style.animation = '';
  try { fn(main, params); main.focus({ preventScroll: true }); } catch (e) { main.innerHTML = `<div class="card bad">Something broke: ${esc(e.message)}</div>`; console.error(e); }
  renderBar(name);
}

function renderBar(name) {
  const slot = document.getElementById('wslot');
  slot.innerHTML = workoutBar(name);
  slot.querySelectorAll('[data-skip]').forEach(a => a.addEventListener('click', () => skipStep(a.dataset.skip)));
}

window.addEventListener('hashchange', route);
window.addEventListener('sf:activity', () => { const name = (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0]; if (name === 'home') return; renderBar(name); });
renderNav();
if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
  const w = document.getElementById('warn');
  w.textContent = 'This browser has no built-in speech recognition. Use Safari, Chrome or Edge, or start SpeakForge with ./start.sh to recognise speech privately on your computer.';
  w.classList.remove('hidden');
}
if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
renderXp();
renderEngine();
route();
detectLocal().then(() => {
  applyEngine();
  renderEngine();
  if (LOCAL.ok) route();
  waitUntilReady(renderEngine);
  retryDetect(() => { applyEngine(); renderEngine(); waitUntilReady(renderEngine); if (/^#?\/?(home)?$/.test(location.hash.replace('#/', ''))) route(); });
});

// Use local Whisper and local AI automatically when the SpeakForge server is running on this computer.
export function applyEngine() {
  const e = S.settings.engine || 'auto';
  setListenMode(LOCAL.ok && LOCAL.whisper && e !== 'browser' ? 'local' : 'browser');
  if (LOCAL.ok && LOCAL.ollama && S.ai.provider === 'none' && !S.ai.chosen) { S.ai.provider = 'local'; save(); }
  const w = document.getElementById('warn');
  if (LOCAL.ok && LOCAL.whisper && e !== 'browser') { w.classList.add('hidden'); }
}

function renderEngine() {
  const el = document.getElementById('engine');
  if (!el) return;
  el.innerHTML = LOCAL.ok
    ? `<span class="dot"></span>Private mode: everything runs on this computer.<br>Speech: <b>${esc(LOCAL.whisper || 'browser')}</b>${LOCAL.whisper && !LOCAL.ready ? ' (loading…)' : ''}${LOCAL.ollama ? `<br>Coach: <b>${esc(LOCAL.model || 'Ollama')}</b>` : ''}`
    : '<span class="dot off"></span>Browser mode. Start ./start.sh to run everything privately on your computer.';
}
