import { S, save, logActivity, $, esc, ensureMic, sleep, shuffle } from '../core.js';
import { Listener, speechSupported, say } from '../audio.js';
import { reviewCard, dueCards, containsPhrase, LEITNER_DAYS } from '../metrics.js';
import { PHRASE_BANK } from '../content.js';

function cards() {
  for (const p of PHRASE_BANK) if (!S.srs[p.phrase]) S.srs[p.phrase] = { ...p, box: 0, due: 0 };
  return Object.values(S.srs);
}

export function render(main) {
  const all = cards();
  save();
  const due = dueCards(all);
  const byCat = {};
  all.forEach(c => { (byCat[c.cat] = byCat[c.cat] || []).push(c); });
  main.innerHTML = `
    <h1>Phrases</h1>
    <p class="sub">Fluent speakers don't build sentences word by word; they pull <b>ready-made chunks</b> (“to be clear”, “the thing is”, “which means”). Studies on formulaic sequences show learning chunks directly improves speaking fluency. Spaced repetition makes them automatic.</p>
    <div class="grid g2">
      <div class="card hl"><h2>${due.length} phrases due</h2>
        <p>You see a <b>situation</b>. Say a full sentence that uses the right phrase. If the recogniser hears the phrase, it counts automatically.</p>
        <button id="rev" ${due.length ? '' : 'disabled'}>Review now</button><div id="play"></div></div>
      <div class="card"><h2>Add your own phrase</h2>
        <input id="np" placeholder="phrase, e.g. “that being said”" style="width:100%"><br><br>
        <input id="nc" placeholder="when to use it" style="width:100%"><br><br><button class="ghost" id="add">Add</button>
        <p class="muted">Add phrases you hear from Theo/Mona or that AI feedback gives you.</p></div>
    </div><br>
    <div class="card"><h2>All phrases</h2><p class="muted">Box 0-5 → reviewed after ${LEITNER_DAYS.join(', ')} days.</p>
      ${Object.entries(byCat).map(([cat, cs]) => `<h3>${esc(cat)}</h3><p>${cs.map(c => `<span class="pill" title="${esc(c.cue)}">${esc(c.phrase)} · ${c.box}</span>`).join(' ')}</p>`).join('')}</div>`;
  $('#add').onclick = () => {
    const p = $('#np').value.trim();
    if (!p) return;
    S.srs[p] = { cat: 'Mine', phrase: p, cue: $('#nc').value.trim() || 'Your own phrase', box: 0, due: 0 };
    save();
    render(main);
  };
  $('#rev').onclick = () => review(main, shuffle(due).slice(0, 12));
}

async function review(main, queue) {
  const canListen = speechSupported() && (await ensureMic());
  const l = canListen ? new Listener() : null;
  l?.start();
  let right = 0;
  const playEl = document.getElementById('play');
  for (let i = 0; i < queue.length; i++) {
    if (!playEl.isConnected) return;
    const c = queue[i];
    const mark = l ? l.finalText.length : 0;
    $('#play').innerHTML = `<br><div class="card" style="background:var(--panel2)"><span class="pill">${i + 1}/${queue.length} · ${esc(c.cat)}</span>
      <div class="prompt">${esc(c.cue.replace(new RegExp(c.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '____'))}</div><p class="muted" style="text-align:center">Say a sentence using the ${c.cat === 'Lost word' ? `word (starts with “${esc(c.phrase[0])}”)` : 'phrase'}…</p>
      <p style="text-align:center" id="ans" class="hidden"><b style="font-size:20px">“${esc(c.phrase)}”</b></p>
      <div class="transcript" id="tr"></div><br>
      <div class="row"><button class="ghost" id="reveal">Reveal</button><span class="spacer"></span><button class="red" id="bad">Again</button><button class="green" id="good">Got it</button></div></div>`;
    $('#reveal').onclick = () => { $('#ans').classList.remove('hidden'); say(c.phrase); };
    const verdict = await new Promise(res => {
      let done = false;
      const iv = setInterval(() => {
        if (!l) return;
        const heard = l.finalText.slice(mark) + ' ' + l.interim;
        $('#tr').textContent = heard.trim();
        if (!done && containsPhrase(heard, c.phrase)) { done = true; $('#ans').classList.remove('hidden'); clearInterval(iv); setTimeout(() => res(true), 900); }
      }, 150);
      $('#good').onclick = () => { if (!done) { done = true; clearInterval(iv); res(true); } };
      $('#bad').onclick = () => { if (!done) { done = true; clearInterval(iv); res(false); } };
    });
    if (verdict) right++;
    S.srs[c.phrase] = reviewCard(S.srs[c.phrase], verdict);
    save();
    await sleep(200);
  }
  await l?.stop();
  logActivity('phrases', 5 + right * 2);
  $('#play').innerHTML = `<br><p class="ok"><b>${right}/${queue.length}</b> recalled. Now use 3 of them in your next speech!</p><button class="ghost" id="back">Back</button>`;
  $('#back').onclick = () => render(main);
}
