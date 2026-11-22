import { S, esc } from '../core.js';
import { skillScores, focusOfDay, weeklyReport, SKILL_LINKS, SKILL_GROUPS } from '../metrics.js';
import { LESSONS } from '../content.js';

const color = v => v == null ? 'var(--velvet-3)' : v >= 75 ? 'var(--seaglass)' : v >= 50 ? 'var(--brass)' : 'var(--coral)';

export function weeklyCard() {
  const w = weeklyReport(S.sessions);
  const row = (label, k, better) => {
    const a = w.thisWeek[k], b = w.lastWeek[k];
    let trend = '';
    if (a != null && b != null && a !== b) trend = (better === 'up' ? a > b : a < b) ? '<span class="ok">▲ better</span>' : '<span class="warnc">▼ worse</span>';
    return `<tr><td>${label}</td><td><b>${a ?? '–'}</b></td><td class="muted">${b ?? '–'}</td><td>${trend}</td></tr>`;
  };
  return `<div class="card"><h2>Weekly report</h2><table><tr><th></th><th>This week</th><th>Last week</th><th></th></tr>
    ${row('Speeches', 'speeches', 'up')}${row('Minutes spoken', 'minutes', 'up')}${row('Freezes per min', 'freezesPerMin', 'down')}${row('Restarts per min', 'restartsPerMin', 'down')}${row('Fillers per min', 'fillersPerMin', 'down')}${row('Vague words per 100', 'vaguePer100', 'down')}${row('Words per min', 'wpm', 'up')}</table></div>`;
}

export function focusCard() {
  const f = focusOfDay(skillScores(S));
  return `<div class="card hl"><p class="eyebrow">Focus of the day</p><h2>${esc(f.skill)}</h2><p class="muted">${esc(f.reason)}.</p><a class="btn" href="${f.link[0]}">${esc(f.link[1])}</a></div>`;
}

export function skillMap(pane) {
  const sc = skillScores(S);
  pane.innerHTML = `<div class="grid g2">${focusCard()}${weeklyCard()}</div><br>
    <div class="grid g2">${Object.entries(SKILL_GROUPS).map(([g, ks]) => `<div class="card"><p class="eyebrow">${esc(g)}</p>${ks.map(k => {
      const v = sc[k], l = LESSONS[k] || {};
      return `<div style="margin:6px 0 18px"><div class="row"><h3 style="margin:0">${esc(k)}</h3><span class="spacer"></span><b style="font-family:var(--display);font-size:20px;color:${color(v)}">${v ?? '–'}</b></div>
        <div class="bar" style="margin:8px 0 10px"><i style="width:${v ?? 0}%;background:${color(v)}"></i></div>
        <p class="muted" style="margin:0 0 6px">${esc(l.good || '')}</p><p class="faint" style="margin:0 0 8px">Target: ${esc(l.target || '')}</p>
        ${SKILL_LINKS[k] ? `<a class="btn small ghost" href="${SKILL_LINKS[k][0]}">${esc(SKILL_LINKS[k][1])}</a>` : ''}</div>`;
    }).join('')}</div>`).join('')}</div>`;
}
