import { esc } from './core.js';
import { markup } from './metrics.js';
import { dial } from './icons.js';

export function transcriptHtml(text) {
  const m = markup(text);
  return m.length ? m.map(([w, c]) => c ? `<span class="${c}">${esc(w)}</span>` : esc(w)).join(' ') : '<span class="faint">No speech recognised. Check the mic.</span>';
}
export const LEGEND = '<p class="faint"><span class="fill">filler</span> · <span class="rep">restart</span> · <span class="vague">vague word</span></p>';

export function scoreBlock(score, max, title, sub = '', invert = false) {
  return `<div class="score">${dial(score, max, 96, invert)}<div><h2 style="margin:0">${esc(title)}</h2><p class="muted" style="margin:4px 0 0">${sub}</p></div></div>`;
}

export function rubricBars(rows) {
  return `<div class="rubric">${rows.map(([label, v, max]) => `<div class="r"><span>${esc(label)}</span><div class="bar"><i style="width:${100 * v / max}%;background:${v / max >= 0.75 ? 'var(--seaglass)' : v / max >= 0.5 ? 'var(--brass)' : 'var(--coral)'}"></i></div><b>${v}/${max}</b></div>`).join('')}</div>`;
}

export function media(blob, video) {
  if (!blob || !blob.size) return '';
  const u = URL.createObjectURL(blob);
  return video ? `<video controls src="${u}" style="width:100%;max-height:360px;border-radius:12px"></video>` : `<audio controls src="${u}" style="width:100%"></audio>`;
}
