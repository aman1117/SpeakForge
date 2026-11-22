import { S, save, logActivity, $, esc, pick, shuffle, ensureMic, toast, sleep } from '../core.js';
import { Listener, speechSupported, say } from '../audio.js';
import { tokenize, containsPhrase } from '../metrics.js';
import { NAMING_EMOJI, NAMING_DEFS, TABOO_CARDS, CATEGORIES, SYNONYM_SPRINT } from '../content.js';

const STOP = new Set('a an the and or but so um uh er like i you it is are was to of in on for with that this my me we they he she um okay ok yeah also and then just'.split(' '));

let tab = 'naming';

export function render(main, params = {}) {
  if (params.t) tab = params.t;
  main.innerHTML = `
    <h1>🧠 Word Lab</h1>
    <p class="sub">Trains <b>lexical retrieval</b> (finding words fast) and <b>circumlocution</b> (talking around a word you can't find). These are the two skills behind “I forget a word and restart the sentence”.</p>
    <div class="tabs">
      <button data-t="naming">⚡ Rapid naming</button><button data-t="taboo">🚫 Taboo (describe it)</button>
      <button data-t="category">📚 Category sprint</button><button data-t="synonym">🔁 Synonym sprint</button>
    </div>
    <div id="pane"></div>`;
  main.querySelectorAll('.tabs button').forEach(b => {
    b.classList.toggle('on', b.dataset.t === tab);
    b.onclick = () => { tab = b.dataset.t; render(main); };
  });
  ({ naming, taboo, category, synonym })[tab]($('#pane'));
}

function needSpeech(pane) {
  if (speechSupported()) return false;
  pane.innerHTML = '<div class="card">This drill needs speech recognition: open SpeakForge in <b>Microsoft Edge</b> or <b>Google Chrome</b>.</div>';
  return true;
}

function heardSince(listener, mark) {
  return listener.finalText.slice(mark) + ' ' + listener.interim;
}

function matches(heard, target) {
  if (containsPhrase(heard, target)) return true;
  const toks = tokenize(heard), tw = tokenize(target);
  const last = tw[tw.length - 1];
  return toks.some(t => t === last || t === last + 's' || t === last + 'es' || (last.length > 5 && t.startsWith(last.slice(0, -1))));
}

function naming(pane) {
  const hist = S.naming.slice(-8).map(n => `${new Date(n.ts).toLocaleDateString()}: ${n.avgMs} ms, ${n.acc}%`).join('<br>') || 'No rounds yet.';
  pane.innerHTML = `<div class="grid g2">
    <div class="card hl"><h2>Rapid naming</h2>
      <p>A picture or definition appears. <b>Say the word out loud as fast as you can.</b> SpeakForge measures your retrieval speed. 10 items per round.</p>
      <div class="row"><select id="ntype"><option value="emoji">Pictures (everyday words)</option><option value="defs">Definitions (richer vocabulary)</option></select>
      <button id="nstart">Start round ▶</button></div></div>
    <div class="card"><h2>Your history</h2><p class="muted">${hist}</p><p class="muted">Goal: average under 1500 ms with 90%+ accuracy. Speech recognition adds ~0.5 s, so compare yourself to yourself.</p></div></div>
    <div id="play"></div>`;
  $('#nstart').onclick = async () => {
    if (needSpeech($('#play')) || !(await ensureMic())) return;
    const type = $('#ntype').value;
    const items = shuffle(type === 'emoji' ? NAMING_EMOJI : NAMING_DEFS).slice(0, 10);
    const listener = new Listener();
    listener.start();
    await sleep(500);
    const res = [];
    for (let i = 0; i < items.length; i++) {
      const [cue, target] = items[i];
      const r = await namingItem($('#play'), listener, cue, target, type, i, items.length);
      res.push(r);
      if (r === 'quit' || !pane.isConnected) break;
    }
    listener.stop();
    const done = res.filter(r => r !== 'quit');
    const hits = done.filter(r => r.ok);
    const avgMs = hits.length ? Math.round(hits.reduce((a, r) => a + r.ms, 0) / hits.length) : 0;
    const acc = done.length ? Math.round(100 * hits.length / done.length) : 0;
    if (done.length) {
      S.naming.push({ ts: Date.now(), type, avgMs, acc });
      save();
      logActivity('naming', 15);
    }
    $('#play').innerHTML = `<div class="card"><h2>Round done</h2><div class="kpi"><div><b>${avgMs} ms</b><span class="muted">avg retrieval time</span></div><div><b>${acc}%</b><span class="muted">found</span></div></div>
      <p>Missed: ${done.filter(r => !r.ok).map(r => `<b>${esc(r.target)}</b>`).join(', ') || 'none 🎉'}</p>
      <p class="muted">Missed words: say each one 3× in a sentence right now. Retrieval practice is how words become fast.</p></div>`;
  };
}

function namingItem(pane, listener, cue, target, type, i, n) {
  return new Promise(resolve => {
    const mark = listener.finalText.length;
    const t0 = performance.now();
    pane.innerHTML = `<div class="card" style="text-align:center"><span class="pill">${i + 1}/${n}</span>
      ${type === 'emoji' ? `<div class="emoji">${cue}</div>` : `<div class="prompt">${esc(cue)}</div>`}
      <div class="muted" id="heard">listening…</div><br>
      <div class="row" style="justify-content:center"><button class="ghost small" id="self">I said it ✓</button><button class="ghost small" id="skip">Skip</button><button class="ghost small" id="quit">End round</button></div></div>`;
    let done = false;
    const finish = (r) => { if (done) return; done = true; clearInterval(iv); resolve(r); };
    const iv = setInterval(async () => {
      const heard = heardSince(listener, mark);
      $('#heard').textContent = heard.trim() || 'listening…';
      if (matches(heard, target)) {
        const ms = Math.round(performance.now() - t0);
        pane.querySelector('.card').insertAdjacentHTML('beforeend', `<p class="ok"><b>${esc(target)}</b> · ${ms} ms</p>`);
        clearInterval(iv);
        await sleep(600);
        finish({ ok: true, ms, target });
      } else if (performance.now() - t0 > 7000) {
        clearInterval(iv);
        pane.querySelector('.card').insertAdjacentHTML('beforeend', `<p class="bad">It was: <b>${esc(target)}</b></p>`);
        say(target);
        await sleep(1600);
        finish({ ok: false, ms: 7000, target });
      }
    }, 100);
    $('#self').onclick = () => finish({ ok: true, ms: Math.round(performance.now() - t0), target });
    $('#skip').onclick = () => { say(target); finish({ ok: false, ms: 7000, target }); };
    $('#quit').onclick = () => finish('quit');
  });
}

function taboo(pane) {
  pane.innerHTML = `<div class="card hl"><h2>Taboo: describe without the obvious words</h2>
    <p>Describe the word for <b>45 seconds</b> so a friend could guess it, but you can't say the word or the banned words. This is <i>exactly</i> the skill you need when you forget a word mid-sentence.</p>
    <p class="muted">Useful frames: “It’s a kind of…”, “You use it to…”, “It looks like…”, “You find it in…”, “It’s the opposite of…”</p>
    <button id="tstart">Draw a card ▶</button></div><div id="play"></div>`;
  $('#tstart').onclick = async () => {
    if (needSpeech($('#play')) || !(await ensureMic())) return;
    const card = pick(TABOO_CARDS);
    const listener = new Listener();
    listener.start();
    const forbidden = [card.word, ...card.banned];
    let buzzes = 0, left = 45;
    const seen = new Set();
    $('#play').innerHTML = `<br><div class="card" style="text-align:center"><div class="prompt">${esc(card.word)}</div>
      <p>Banned: ${card.banned.map(b => `<span class="pill">${esc(b)}</span>`).join(' ')}</p><div class="big" id="tt">45</div>
      <p id="buzz" class="muted">Go! Describe it.</p><div class="transcript" id="tr"></div><br><button class="ghost" id="tstop">Done</button></div>`;
    const iv = setInterval(() => {
      const text = listener.text();
      $('#tr').textContent = text;
      const toks = tokenize(text);
      for (const f of forbidden) {
        const n = toks.filter(t => t === f.toLowerCase() || t === f.toLowerCase() + 's').length;
        const key = f + n;
        if (n && !seen.has(key)) { seen.add(key); buzzes++; $('#buzz').innerHTML = `<b class="bad">BZZT! You said “${esc(f)}”. Rephrase!</b>`; }
      }
    }, 200);
    const tick = setInterval(() => { left--; $('#tt').textContent = left; if (left <= 0) end(); }, 1000);
    $('#tstop').onclick = () => end();
    let ended = false;
    async function end() {
      if (ended) return;
      ended = true;
      clearInterval(iv); clearInterval(tick);
      const text = await listener.stop();
      const words = tokenize(text).length;
      S.taboo.push({ ts: Date.now(), word: card.word, buzzes, words });
      save();
      logActivity('taboo', 15);
      $('#play').innerHTML = `<br><div class="card"><h2>${esc(card.word)}: ${words} words, ${buzzes} buzz${buzzes === 1 ? '' : 'es'}</h2>
        <div class="transcript">${esc(text) || '…'}</div>
        <p class="muted">Ask yourself: would a stranger guess “${esc(card.word)}”? Try again and use different frames (function, look, place, contrast).</p></div>`;
    }
  };
}

function category(pane) {
  const best = Math.max(0, ...S.category.map(c => c.count));
  pane.innerHTML = `<div class="card hl"><h2>Category sprint (60 s)</h2>
    <p>Name as many things in the category as you can. Builds fast access to your vocabulary “shelves”. Best so far: <b>${best}</b></p>
    <button id="cstart">Start ▶</button></div><div id="play"></div>`;
  $('#cstart').onclick = async () => {
    if (needSpeech($('#play')) || !(await ensureMic())) return;
    const cat = pick(CATEGORIES);
    const listener = new Listener();
    listener.start();
    let left = 60;
    $('#play').innerHTML = `<br><div class="card" style="text-align:center"><div class="prompt">${esc(cat)}</div><div class="big" id="ct">60</div><div class="transcript" id="tr"></div><p>Unique words: <b id="cc">0</b></p><button class="ghost" id="cstop">Done</button></div>`;
    const uniq = () => [...new Set(tokenize(listener.text()).filter(t => !STOP.has(t)))];
    const iv = setInterval(() => { $('#tr').textContent = uniq().join(', '); $('#cc').textContent = uniq().length; }, 250);
    const tick = setInterval(() => { left--; $('#ct').textContent = left; if (left <= 0) end(); }, 1000);
    $('#cstop').onclick = () => end();
    let ended = false;
    async function end() {
      if (ended) return;
      ended = true;
      clearInterval(iv); clearInterval(tick);
      await listener.stop();
      const words = uniq();
      S.category.push({ ts: Date.now(), category: cat, count: words.length });
      save();
      logActivity('category', 10);
      $('#play').innerHTML = `<br><div class="card"><h2>${words.length} ${esc(cat)}</h2><p>${esc(words.join(', '))}</p></div>`;
    }
  };
}

function synonym(pane) {
  pane.innerHTML = `<div class="card hl"><h2>Synonym sprint</h2>
    <p>5 words × 12 seconds. Say as many alternatives as you can (“good → great, nice, solid, excellent…”). When a word escapes you mid-sentence, you'll have backups ready.</p>
    <button id="sstart">Start ▶</button></div><div id="play"></div>`;
  $('#sstart').onclick = async () => {
    if (needSpeech($('#play')) || !(await ensureMic())) return;
    const words = shuffle(SYNONYM_SPRINT).slice(0, 5);
    const listener = new Listener();
    listener.start();
    const out = [];
    for (const w of words) {
      if (!pane.isConnected) return;
      const mark = listener.finalText.length;
      for (let s = 12; s > 0; s--) {
        const said = [...new Set(tokenize(heardSince(listener, mark)).filter(t => !STOP.has(t) && t !== w))];
        $('#play').innerHTML = `<br><div class="card" style="text-align:center"><div class="prompt">${esc(w)} →</div><div class="big">${s}</div><p>${esc(said.join(', '))}</p></div>`;
        await sleep(1000);
      }
      out.push([w, [...new Set(tokenize(heardSince(listener, mark)).filter(t => !STOP.has(t) && t !== w))]]);
    }
    await listener.stop();
    logActivity('synonym', 10);
    $('#play').innerHTML = `<br><div class="card"><h2>Your alternatives</h2><table>${out.map(([w, s]) => `<tr><td><b>${esc(w)}</b></td><td>${esc(s.join(', ')) || '<span class="bad">none</span>'}</td></tr>`).join('')}</table>
      <p class="muted">Weak ones? Ask an AI for 5 spoken-English synonyms and add them to your Phrase Bank habit.</p></div>`;
  };
}
