import { S, esc } from '../core.js';
import { skillScores, focusOfDay, weeklyReport, SKILL_LINKS } from '../metrics.js';
import { LESSONS } from '../content.js';

const color = v => v == null ? 'var(--line)' : v >= 75 ? 'var(--accent2)' : v >= 50 ? 'var(--warn)' : 'var(--bad)';

export function weeklyCard() {
  const w = weeklyReport(S.sessions);
  const row = (label, k, better) => {
    const a = w.thisWeek[k], b = w.lastWeek[k];
    let trend = '';
    if (a != null && b != null && a !== b) trend = (better === 'up' ? a > b : a < b) ? '<span class="ok">▲ better</span>' : '<span class="warnc">▼ worse</span>';
    return `<tr><td>${label}</td><td><b>${a ?? '-'}</b></td><td class="muted">${b ?? '-'}</td><td>${trend}</td></tr>`;
  };
  return `<div class="card"><h2>📅 Weekly report</h2><table><tr><th></th><th>This week</th><th>Last week</th><th></th></tr>
    ${row('Speeches', 'speeches', 'up')}${row('Minutes spoken', 'minutes', 'up')}${row('Words/min', 'wpm', 'up')}${row('Freezes/min', 'freezesPerMin', 'down')}${row('Restarts/min', 'restartsPerMin', 'down')}</table></div>`;
}

export function focusCard() {
  const f = focusOfDay(skillScores(S));
  return `<div class="card hl"><h2>🎯 Focus of the day: ${esc(f.skill)}</h2><p>${esc(f.reason)}.</p><a class="btn" href="${f.link[0]}">${esc(f.link[1])} ▶</a></div>`;
}

export function render(main) {
  const sc = skillScores(S);
  main.innerHTML = `
    <h1>🧠 Skill map</h1>
    <p class="sub">Your live score (0-100) on each skill of great speaking, computed from your recent practice. Grey = not measured yet. Train the lowest bar first.</p>
    <div class="grid g2">${focusCard()}${weeklyCard()}</div><br>
    <div class="card">${Object.entries(sc).map(([k, v]) => `
      <div style="margin:10px 0"><div class="row"><b>${esc(k)}</b><span class="spacer"></span><span class="muted">${v == null ? 'not measured' : v + '/100'}</span></div>
      <div class="meter" style="height:12px"><i style="width:${v ?? 0}%;background:${color(v)}"></i></div></div>`).join('')}</div><br>
    <div class="grid g2">${Object.entries(LESSONS).map(([k, l]) => `
      <div class="card"><h3>${esc(k)} ${sc[k] != null ? `<span class="pill">${sc[k]}/100</span>` : ''}</h3>
        <p><b>What good looks like:</b> ${esc(l.good)}</p><ul>${l.how.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
        <p class="muted">Target: ${esc(l.target)}</p>${SKILL_LINKS[k] ? `<a class="btn" href="${SKILL_LINKS[k][0]}">${esc(SKILL_LINKS[k][1])} ▶</a>` : ''}</div>`).join('')}</div>`;
}
