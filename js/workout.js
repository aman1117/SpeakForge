// Guided daily workout: one button on Today runs the whole session, step by step, with a sticky progress bar.
import { S, save, todayCount, esc } from './core.js';
import { dayKey } from './metrics.js';
import { icon } from './icons.js';

// [kind, count, label, href, minutes, why]
const PLANS = {
  Foundation: [
    ['breath', 1, 'Calm reset: physiological sigh', '#/calm?t=sigh', 1],
    ['warmup', 1, 'Mouth warm-up', '#/mouth?t=warmup', 3],
    ['naming', 1, 'Rapid word retrieval', '#/words?t=naming', 3],
    ['explain', 1, 'Explain gym: answer first', '#/explain?f=answer', 6],
    ['speak', 1, '1-minute topic', '#/speak?mode=oneMin', 4],
    ['fillers', 1, 'Filler-free minute', '#/fillers?t=live', 3],
    ['phrases', 1, 'Phrase review', '#/phrases', 4],
    ['zone', 1, 'Volume zone', '#/calm?t=zone', 3],
  ],
  'Fluency engine': [
    ['breath', 1, 'Calm reset: physiological sigh', '#/calm?t=sigh', 1],
    ['warmup', 1, 'Mouth warm-up', '#/mouth?t=warmup', 3],
    ['upgrade', 1, 'Word upgrade from your own speech', '#/words?t=upgrade', 4],
    ['explain', 1, 'Explain gym: explain to a 12-year-old', '#/explain?f=feynman', 6],
    ['speak432', 1, 'Quick 4/3/2 (same talk, less time)', '#/speak?mode=quick432', 6],
    ['taboo', 1, 'Taboo: talk around a word', '#/words?t=taboo', 3],
    ['phrases', 1, 'Phrase review', '#/phrases', 4],
    ['shadow', 1, 'Shadowing', '#/shadow?t=along', 6],
  ],
  Expression: [
    ['breath', 1, 'Calm reset: physiological sigh', '#/calm?t=sigh', 1],
    ['warmup', 1, 'Mouth warm-up', '#/mouth?t=warmup', 3],
    ['groups', 1, 'Thought groups and stress', '#/mouth?t=groups', 4],
    ['explain', 1, 'Explain gym: tell a story', '#/explain?f=story', 6],
    ['speak', 1, 'PREP speech in front of an audience', '#/speak?mode=prep&aud=3', 5],
    ['better', 1, 'Say it better (precise words)', '#/words?t=better', 3],
    ['shadow', 1, 'Shadowing', '#/shadow?t=along', 6],
    ['phrases', 1, 'Phrase review', '#/phrases', 4],
  ],
  'Creator mode': [
    ['breath', 1, 'Calm reset: physiological sigh', '#/calm?t=sigh', 1],
    ['warmup', 1, 'Mouth warm-up', '#/mouth?t=warmup', 3],
    ['explain', 1, 'One-sentence headline', '#/explain?f=answer&one=1', 3],
    ['speakCreator', 1, 'Reel practice on camera', '#/speak?mode=creator', 6],
    ['audience', 1, 'Virtual audience exposure', '#/calm?t=audience', 6],
    ['upgrade', 1, 'Word upgrade', '#/words?t=upgrade', 4],
    ['shadow', 1, 'Shadow a creator clip', '#/shadow?t=own', 6],
    ['phrases', 1, 'Phrase review', '#/phrases', 4],
  ],
};

const SKILL_STEP = {
  'Repair fluency': ['speak', 'No-Restart challenge', '#/speak?mode=noRestart', 4], 'Word retrieval': ['naming', 'Rapid word retrieval', '#/words?t=naming', 3],
  'Precise vocabulary': ['upgrade', 'Word upgrade', '#/words?t=upgrade', 4], 'Filler control': ['fillers', 'Filler-free minute', '#/fillers?t=live', 3],
  'Clear explanations': ['explain', 'Explain gym', '#/explain', 6], 'Pace': ['speak432', 'Quick 4/3/2', '#/speak?mode=quick432', 6],
  'Articulation': ['pen', 'Pebble drill', '#/mouth?t=pen', 4], 'Rhythm and pausing': ['groups', 'Thought groups', '#/mouth?t=groups', 4],
  'Volume': ['zone', 'Volume zone', '#/calm?t=zone', 3], 'Calm on stage': ['audience', 'Virtual audience', '#/calm?t=audience', 6], 'Ready-made chunks': ['phrases', 'Phrase review', '#/phrases', 4],
};
const PRIORITY = { explain: 1, speak: 2, speak432: 2, speakCreator: 2, benchmark: 0, fillers: 3, focus: 2.5, naming: 4, upgrade: 4, better: 4.5, phrases: 5, breath: 6, audience: 5, taboo: 6, warmup: 7 };

// Builds today's workout from the phase, the daily time budget, the weekday and the weakest skill.
export function todaysTasks(phaseName, minutes, weekday, _aiOn = false, focusSkill = null) {
  let all = (PLANS[phaseName] || PLANS.Foundation).map(t => [...t]);
  const f = focusSkill && SKILL_STEP[focusSkill];
  if (f && !all.some(t => t[0] === f[0])) all.splice(2, 0, [f[0], 1, `Focus: ${f[1]}`, f[2], f[3], 'focus']);
  if (weekday === 6) all.unshift(['benchmark', 1, 'Saturday benchmark speech', '#/speak?mode=benchmark', 3]);
  if (weekday === 0) all.push(['reallife', 1, 'Sunday: review a real conversation from this week', '#/real', 6]);
  const budget = Math.max(8, minutes);
  const ranked = all.map((t, i) => ({ t, i, p: t[5] === 'focus' ? PRIORITY.focus : PRIORITY[t[0]] ?? 6 })).sort((a, b) => a.p - b.p || a.i - b.i);
  let used = 0;
  const keep = new Set();
  for (const r of ranked) if (used + r.t[4] <= budget + 2 || keep.size < 3) { keep.add(r.i); used += r.t[4]; }
  return all.filter((_, i) => keep.has(i));
}

export function stepDone(t) { return todayCount(t[0]) >= t[1] || (activeWorkout()?.skipped || []).includes(t[2]); }

export function skipStep(label) {
  const w = activeWorkout();
  if (!w) return;
  w.skipped = [...(w.skipped || []), label];
  save();
}

export function startWorkout(tasks) {
  S.workout = { day: dayKey(), steps: tasks };
  save();
  const next = tasks.find(t => !stepDone(t)) || tasks[0];
  location.hash = next[3];
}

export function activeWorkout() {
  const w = S.workout;
  return w && w.day === dayKey() && Array.isArray(w.steps) && w.steps.length ? w : null;
}

const routeOf = h => (h || '').replace(/^#\/?/, '').split('?')[0];

// Sticky bar shown on every drill screen while a workout is running.
export function workoutBar(route) {
  const w = activeWorkout();
  if (!w || route === 'home') return '';
  const steps = w.steps;
  const idx = steps.findIndex(t => !stepDone(t));
  const segs = `<div class="segs">${steps.map((t, i) => `<i class="${stepDone(t) ? 'done' : i === idx ? 'now' : ''}"></i>`).join('')}</div>`;
  if (idx < 0) return `<div class="wbar ready">${segs}<span class="lbl"><b>Workout complete.</b> Listen back to one recording, then rest.</span><a class="btn small" href="#/home">Finish</a></div>`;
  const here = routeOf(location.hash);
  const cur = steps[idx];
  const justDone = steps.some(t => stepDone(t) && routeOf(t[3]) === here) && routeOf(cur[3]) !== here;
  const onCur = routeOf(cur[3]) === here;
  const nextAfter = steps.findIndex((t, i) => i > idx && !stepDone(t));
  const action = justDone ? `<a class="btn small next" href="${cur[3]}">Next: ${esc(cur[2])} ${icon('arrow')}</a>`
    : onCur ? `<a class="btn small ghost" data-skip="${esc(cur[2])}" href="${nextAfter >= 0 ? steps[nextAfter][3] : '#/home'}">Skip step</a>`
      : `<a class="btn small" href="${cur[3]}">Back to step ${idx + 1} ${icon('arrow')}</a>`;
  return `<div class="wbar${justDone ? ' ready' : ''}" id="wbar">${segs}<span class="lbl">${justDone ? '<b class="ok">Step done.</b> ' : ''}Step <b>${idx + 1}</b> of ${steps.length}: <b>${esc(cur[2])}</b></span>${action}</div>`;
}
