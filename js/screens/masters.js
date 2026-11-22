import { esc } from '../core.js';
import { PLAYBOOK } from '../library.js';
import { icon } from '../icons.js';

export function render(main) {
  main.innerHTML = `<p class="eyebrow">Learn from the best</p><h1>What great speakers actually did</h1>
    <p class="sub">No vague advice. Each card is something a great orator or explainer really did, the lesson in one line, and the drill in SpeakForge that trains it.</p>
    <div class="grid g2">${PLAYBOOK.map(p => `<div class="card"><p class="eyebrow">${esc(p.era)}</p><h2>${esc(p.who)}</h2>
      <p class="muted">${esc(p.did)}</p><p><b>${esc(p.lesson)}</b></p><a class="btn small ghost" href="${p.drill[0]}">${esc(p.drill[1])} ${icon('arrow')}</a></div>`).join('')}</div>
    <div class="section-title"><h2>Deep dive</h2></div>
    <a class="card hl" href="#/theo"><h2>Learn from Theo</h2><p class="muted" style="margin:0">His measured pace, pauses and pitch compared with yours after every speech, his seven hook patterns, his phrases, and an accent lab with real measurement.</p></a>`;
}
