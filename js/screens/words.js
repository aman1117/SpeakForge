import { S, save, logActivity, addToDeck, ensureArr, $, esc, pick, shuffle, ensureMic, sleep } from '../core.js';
import { Listener, speechSupported, say, listenMode } from '../audio.js';
import { tokenize, containsPhrase, sentencesOf } from '../metrics.js';
import { NAMING_DEFS, TABOO_CARDS } from '../content.js';
import { UPGRADES, PRECISE_WORDS, SAY_BETTER } from '../library.js';
import { aiReady, chatJson, betterMessages, BETTER_SCHEMA } from '../ai.js';
import { scoreBlock } from '../ui.js';
import { icon } from '../icons.js';

let tab = 'naming';

export function render(main, params = {}) {
  if (params.t) tab = params.t;
  main.innerHTML = `
    <p class="eyebrow"><a href="#/practice">Practice</a> · Words</p>
    <h1>Word lab</h1>
    <p class="sub">Two problems, one lab. <b>Losing words</b>: retrieve them faster and talk around the ones that escape. <b>Basic words</b>: replace the vague words you actually use with precise ones, out loud, in your own sentences.</p>
    <div class="tabs"><button data-t="naming">Rapid retrieval</button><button data-t="taboo">Taboo</button><button data-t="upgrade">Word upgrade</button><button data-t="better">Say it better</button></div>
    <div id="pane"></div>`;
  main.querySelectorAll('.tabs button').forEach(b => { b.classList.toggle('on', b.dataset.t === tab); b.onclick = () => { tab = b.dataset.t; render(main); }; });
  ({ naming, taboo, upgrade, better })[tab]($('#pane'), params);
}

function needSpeech(pane) {
  if (speechSupported()) return false;
  pane.innerHTML = '<div class="card">This drill needs speech recognition: use Safari, Chrome or Edge, or start SpeakForge with ./start.sh.</div>';
  return true;
}

const heardSince = (l, mark) => l.finalText.slice(mark) + ' ' + l.interim;

function matches(heard, target) {
  if (containsPhrase(heard, target)) return true;
  const toks = tokenize(heard), tw = tokenize(target);
  const last = tw[tw.length - 1];
  return toks.some(t => t === last || t === last + 's' || t === last + 'es' || t === last + 'd' || (last.length > 5 && t.startsWith(last.slice(0, -2))));
}

function deckItems(cat) {
  return Object.values(S.srs).filter(c => c.cat === cat).map(c => {
    const re = new RegExp(c.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return [`${c.cue.replace(re, '____')} (starts with “${c.phrase[0]}”, ${c.phrase.length} letters)`, c.phrase];
  });
}

// ---------- rapid retrieval ----------
function naming(pane, params = {}) {
  const hist = S.naming.slice(-8).map(n => `<tr><td>${new Date(n.ts).toLocaleDateString()}</td><td>${esc(n.type)}</td><td><b>${n.avgMs}</b> ms</td><td>${n.acc}%</td></tr>`).join('');
  const lost = deckItems('Lost word'), ups = deckItems('Upgrade');
  const sel = params.type || (lost.length >= 5 ? 'lost' : 'precise');
  pane.innerHTML = `<div class="grid g2" style="align-items:start">
    <div class="card hl"><h2>Rapid retrieval</h2>
      <p>A definition appears. <b>Say the word out loud as fast as you can.</b> Each fast retrieval makes the next one faster: that’s how words stop disappearing mid-sentence.</p>
      <div class="row"><select id="ntype">
        <option value="precise" ${sel === 'precise' ? 'selected' : ''}>Precise words (upgrade your vocabulary)</option>
        <option value="lost" ${lost.length ? '' : 'disabled'} ${sel === 'lost' ? 'selected' : ''}>My lost words (${lost.length})</option>
        <option value="upgrades" ${ups.length ? '' : 'disabled'} ${sel === 'upgrades' ? 'selected' : ''}>My upgrades (${ups.length})</option>
        <option value="defs" ${sel === 'defs' ? 'selected' : ''}>Everyday words</option></select>
      <button id="nstart">${icon('play')} Start 10 words</button></div>
      <p class="faint">Lost words come from your speeches (you type them, or the AI spots them). Upgrades come from Word upgrade.</p></div>
    <div class="card"><h2>History</h2>${hist ? `<table><tr><th>Date</th><th>Set</th><th>Avg</th><th>Found</th></tr>${hist}</table>` : '<p class="muted">No rounds yet.</p>'}<p class="faint">Goal: under 1.5 s with 90%+. ${listenMode() === 'local' ? 'Whisper adds ~0.7 s; compare yourself to yourself.' : 'Recognition adds ~0.5 s; compare yourself to yourself.'}</p></div></div>
    <div id="play"></div>`;
  $('#nstart').onclick = async () => {
    if (needSpeech($('#play')) || !(await ensureMic())) return;
    const type = $('#ntype').value;
    const pool = type === 'lost' ? deckItems('Lost word') : type === 'upgrades' ? deckItems('Upgrade') : type === 'defs' ? NAMING_DEFS : PRECISE_WORDS;
    const items = shuffle(pool).slice(0, 10);
    const listener = new Listener();
    listener.start();
    await sleep(500);
    const res = [];
    for (let i = 0; i < items.length; i++) {
      const r = await namingItem($('#play'), listener, items[i][0], items[i][1], i, items.length);
      if (r === 'quit' || !pane.isConnected) break;
      res.push(r);
    }
    listener.stop();
    if (!pane.isConnected) return;
    const hits = res.filter(r => r.ok);
    const avgMs = hits.length ? Math.round(hits.reduce((a, r) => a + r.ms, 0) / hits.length) : 0;
    const acc = res.length ? Math.round(100 * hits.length / res.length) : 0;
    if (res.length) {
      S.naming.push({ ts: Date.now(), type, avgMs, acc });
      res.filter(r => !r.ok).forEach(r => addToDeck(r.target, `${r.cue}`, type === 'upgrades' ? 'Upgrade' : 'Lost word'));
      save();
      logActivity('naming');
    }
    $('#play').innerHTML = `<br><div class="card"><div class="kpi"><div><b>${avgMs} ms</b><span class="muted">average retrieval</span></div><div><b>${acc}%</b><span class="muted">found</span></div></div>
      <p style="margin-top:12px">Missed: ${res.filter(r => !r.ok).map(r => `<b>${esc(r.target)}</b>`).join(', ') || 'none'}</p>
      <p class="faint">Missed words went into your deck. Say each one in a sentence right now, out loud.</p></div>`;
  };
}

function namingItem(pane, listener, cue, target, i, n) {
  return new Promise(resolve => {
    const mark = listener.finalText.length;
    const t0 = performance.now();
    pane.innerHTML = `<br><div class="card" style="text-align:center"><span class="pill">${i + 1}/${n}</span><div class="prompt">${esc(cue)}</div>
      <div class="muted" id="heard">listening…</div><br>
      <div class="row" style="justify-content:center"><button class="ghost small" id="self">I said it</button><button class="ghost small" id="skip">Skip</button><button class="ghost small" id="quit">End round</button></div></div>`;
    let done = false;
    const finish = r => { if (done) return; done = true; clearInterval(iv); resolve(r); };
    const iv = setInterval(async () => {
      const heard = heardSince(listener, mark);
      $('#heard').textContent = heard.trim() || 'listening…';
      if (matches(heard, target)) {
        const ms = Math.round(performance.now() - t0);
        clearInterval(iv);
        pane.querySelector('.card').insertAdjacentHTML('beforeend', `<p class="ok"><b>${esc(target)}</b> · ${ms} ms</p>`);
        await sleep(600);
        finish({ ok: true, ms, target, cue });
      } else if (performance.now() - t0 > 8000) {
        clearInterval(iv);
        pane.querySelector('.card').insertAdjacentHTML('beforeend', `<p class="bad">It was: <b>${esc(target)}</b></p>`);
        say(target);
        await sleep(1600);
        finish({ ok: false, ms: 8000, target, cue });
      }
    }, 100);
    $('#self').onclick = () => finish({ ok: true, ms: Math.round(performance.now() - t0), target, cue });
    $('#skip').onclick = () => { say(target); finish({ ok: false, ms: 8000, target, cue }); };
    $('#quit').onclick = () => finish('quit');
  });
}

// ---------- taboo (circumlocution) ----------
function taboo(pane) {
  pane.innerHTML = `<div class="card hl"><h2>Taboo: describe it without the obvious words</h2>
    <p>Describe the word for <b>45 seconds</b> so a friend could guess it, without saying it or the banned words. This is exactly what to do when a word escapes you mid-sentence: talk around it, keep going.</p>
    <p class="faint">Frames: “It’s a kind of…”, “You use it to…”, “It looks like…”, “You find it in…”, “It’s the opposite of…”</p>
    <button id="tstart">${icon('play')} Draw a card</button></div><div id="play"></div>`;
  $('#tstart').onclick = async () => {
    if (needSpeech($('#play')) || !(await ensureMic())) return;
    const card = pick(TABOO_CARDS);
    const listener = new Listener();
    listener.start();
    const forbidden = [card.word, ...card.banned];
    let buzzes = 0, left = 45, ended = false;
    const seen = new Set();
    $('#play').innerHTML = `<br><div class="card" style="text-align:center"><div class="prompt">${esc(card.word)}</div>
      <p>Banned: ${card.banned.map(b => `<span class="pill badp">${esc(b)}</span>`).join(' ')}</p><div class="big" id="tt">45</div>
      <p id="buzz" class="muted">Go! Describe it.</p><div class="transcript" id="tr"></div><br><button class="ghost" id="tstop">Done</button></div>`;
    const iv = setInterval(() => {
      const text = listener.text();
      $('#tr').textContent = text;
      const toks = tokenize(text);
      for (const f of forbidden) {
        const n = toks.filter(t => t === f.toLowerCase() || t === f.toLowerCase() + 's').length;
        if (n && !seen.has(f + n)) { seen.add(f + n); buzzes++; $('#buzz').innerHTML = `<b class="bad">BZZT! You said “${esc(f)}”. Rephrase!</b>`; }
      }
    }, 200);
    const tick = setInterval(() => { left--; $('#tt').textContent = left; if (left <= 0) end(); }, 1000);
    $('#tstop').onclick = () => end();
    async function end() {
      if (ended) return;
      ended = true;
      clearInterval(iv); clearInterval(tick);
      const text = await listener.stop();
      const words = tokenize(text).length;
      S.taboo.push({ ts: Date.now(), word: card.word, buzzes, words });
      save();
      logActivity('taboo');
      $('#play').innerHTML = `<br><div class="card"><h2>${esc(card.word)}: ${words} words, ${buzzes} buzz${buzzes === 1 ? '' : 'es'}</h2>
        <div class="transcript">${esc(text) || '…'}</div>
        <p class="faint" style="margin-top:10px">Would a stranger guess “${esc(card.word)}”? Try again with different frames: function, look, place, contrast.</p></div>`;
    }
  };
}

// ---------- word upgrade: vague words from YOUR transcripts ----------
const UP_KEYS = Object.keys(UPGRADES).sort((a, b) => b.length - a.length);
export function findUpgradable(texts, max = 5) {
  const out = [], used = new Set();
  for (const t of texts.slice().reverse()) {
    for (const sent of sentencesOf(t.text)) {
      const norm = ' ' + tokenize(sent).join(' ') + ' ';
      const key = UP_KEYS.find(k => norm.includes(' ' + k + ' ') && !used.has(k));
      if (key && tokenize(sent).length >= 4 && tokenize(sent).length <= 40) { used.add(key); out.push({ sentence: sent, key, source: t.source }); }
      if (out.length >= max) return out;
    }
  }
  return out;
}

function upgrade(pane) {
  const mine = findUpgradable(S.transcripts || []);
  const examples = shuffle(SAY_BETTER).map(b => ({ sentence: b.vague, key: UP_KEYS.find(k => (' ' + tokenize(b.vague).join(' ') + ' ').includes(' ' + k + ' ')), source: 'example' })).filter(x => x.key && !mine.some(m => m.key === x.key));
  const items = [...mine, ...examples].slice(0, 5);
  pane.innerHTML = `<div class="grid g2" style="align-items:start"><div class="card hl"><h2>Word upgrade</h2>
    <p>${mine.length ? `Found <b>${mine.length}</b> sentence${mine.length === 1 ? '' : 's'} in your own recent speech with vague words${mine.length < 5 ? ', plus examples' : ''}.` : 'No recent speeches with vague words yet, so these are examples. Do a few speeches and this drill will use your own sentences.'}
    For each one: read the options, <b>choose the word that fits what you meant</b>, then say the whole sentence out loud with it.</p>
    <p class="why">Words you need, search for and choose yourself stick far better than words from a list (Laufer &amp; Hulstijn 2001).</p>
    <button class="big" id="go" ${items.length ? '' : 'disabled'}>${icon('play')} Upgrade ${items.length} sentences</button></div>
    <div class="card"><h2>Your upgrades</h2>${deckItems('Upgrade').length ? `<p>${Object.values(S.srs).filter(c => c.cat === 'Upgrade').slice(-24).map(c => `<span class="pill" title="${esc(c.cue)}">${esc(c.phrase)} · box ${c.box}</span>`).join(' ')}</p><p class="faint">They come back in Phrases and Rapid retrieval until they’re automatic.</p>` : '<p class="muted">None yet.</p>'}</div></div><div id="play"></div>`;
  $('#go').onclick = async () => {
    if (needSpeech($('#play')) || !(await ensureMic())) return;
    const l = new Listener();
    l.start();
    await sleep(400);
    const scores = [];
    for (let i = 0; i < items.length && pane.isConnected; i++) {
      const it = items[i], opts = UPGRADES[it.key];
      const re = new RegExp(`\\b(${it.key.replace(/ /g, '\\s+')})\\b`, 'i');
      const mark = l.finalText.length;
      $('#play').innerHTML = `<br><div class="card"><span class="pill">${i + 1}/${items.length}</span> <span class="faint">${it.source === 'example' ? 'Example' : `You said (${esc(it.source)})`}</span>
        <p class="passage" style="font-size:20px;margin:10px 0">“${esc(it.sentence).replace(re, '<span class="vague"><b>$1</b></span>')}”</p>
        <p class="muted">Instead of <b>${esc(it.key)}</b>, choose what you meant:</p>
        <div class="grid g3">${opts.map(([w, when]) => `<div class="card flat" style="padding:12px 14px"><b style="font-size:18px">${esc(w)}</b><br><span class="faint">${esc(when)}</span></div>`).join('')}</div>
        <p class="warnc" style="margin-top:12px">Now say the whole sentence out loud with your choice.</p><div class="transcript" id="utr"></div>
        <div class="row" style="margin-top:10px"><button class="ghost small" id="unext">Next</button><span class="faint" id="uv"></span></div></div>`;
      let next = false, chosen = null;
      $('#unext').onclick = () => { next = true; };
      for (let k = 0; k < 120 && !next && pane.isConnected; k++) {
        await sleep(150);
        const heard = heardSince(l, mark);
        $('#utr').textContent = heard.trim();
        chosen = opts.find(([w]) => w !== '(silence)' && containsPhrase(heard, w))?.[0] || chosen;
        if (chosen && k > 10) { $('#uv').innerHTML = `<span class="ok">Used <b>${esc(chosen)}</b></span>`; if (/[.?!]\s*$/.test(l.finalText) && l.finalText.length > mark + 10) { await sleep(700); break; } }
      }
      const heard = heardSince(l, mark);
      const keptVague = containsPhrase(heard, it.key);
      const sc = chosen ? (keptVague ? 60 : 100) : 0;
      scores.push(sc);
      if (chosen) addToDeck(chosen, `Instead of “${it.key}”: ${it.sentence.replace(re, '____')}`, 'Upgrade');
      $('#uv').innerHTML = chosen ? `<span class="ok">+ ${esc(chosen)} added to your deck</span>` : '<span class="warnc">No option heard. Skipped.</span>';
      await sleep(900);
    }
    await l.stop();
    if (!pane.isConnected) return;
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    ensureArr('upgrades').push({ ts: Date.now(), score: avg, n: scores.length });
    save();
    logActivity('upgrade');
    $('#play').innerHTML = `<br><div class="card hl">${scoreBlock(avg, 100, 'Upgrade score', `${scores.filter(s => s > 0).length} of ${scores.length} sentences upgraded out loud.`)}<div class="row" style="margin-top:12px"><button id="again">Again</button><a class="btn ghost" href="#/words?t=naming&type=upgrades">Retrieve them fast ${icon('arrow')}</a></div></div>`;
    $('#again').onclick = () => upgrade(pane);
  };
}

// ---------- say it better: precise rephrasing ----------
function better(pane) {
  pane.innerHTML = `<div class="card hl"><h2>Say it better</h2>
    <p>A vague sentence appears. Say a <b>specific</b> version out loud: what exactly, how much, in what way. Precise doesn’t mean fancy; it means the listener can picture it.</p>
    <p class="faint">${aiReady(S.ai) ? 'Your AI coach scores each version and shows a strong one.' : 'Scored by whether you avoided the vague words and said something specific. Connect AI for richer feedback.'}</p>
    <button class="big" id="go">${icon('play')} 5 sentences</button></div><div id="play"></div>`;
  $('#go').onclick = async () => {
    if (needSpeech($('#play')) || !(await ensureMic())) return;
    const items = shuffle(SAY_BETTER).slice(0, 5);
    const l = new Listener();
    l.start();
    await sleep(400);
    const out = [];
    for (let i = 0; i < items.length && pane.isConnected; i++) {
      const it = items[i], mark = l.finalText.length;
      $('#play').innerHTML = `<br><div class="card"><span class="pill">${i + 1}/${items.length}</span><div class="prompt" style="text-align:left;margin:8px 0">“${esc(it.vague)}”</div>
        <p class="muted">${esc(it.hint)}</p><details><summary>Ideas</summary><p>${it.ideas.map(x => `<span class="pill">${esc(x)}</span>`).join(' ')}</p></details>
        <div class="transcript" id="btr" style="margin-top:10px"></div><div class="row" style="margin-top:10px"><button id="bnext">Done</button><span class="faint">or wait 20 s</span></div></div>`;
      let next = false;
      $('#bnext').onclick = () => { next = true; };
      for (let k = 0; k < 80 && !next && pane.isConnected; k++) { await sleep(250); $('#btr').textContent = heardSince(l, mark).trim(); }
      await sleep(listenMode() === 'local' ? 900 : 300);
      out.push({ it, said: heardSince(l, mark).trim() });
    }
    await l.stop();
    if (!pane.isConnected) return;
    $('#play').innerHTML = '<br><div class="card"><p class="muted">Scoring…</p></div>';
    for (const o of out) {
      const toks = tokenize(o.said);
      const avoided = o.it.avoid.filter(a => toks.includes(a)).length === 0;
      o.score = toks.length < 4 ? 0 : (avoided ? 70 : 35) + Math.min(30, toks.filter(t => t.length >= 7).length * 10);
      if (aiReady(S.ai) && toks.length >= 3) {
        try { const j = await chatJson(S.ai, betterMessages(o.it.vague, o.said), BETTER_SCHEMA, { timeoutMs: 60000 }); o.score = Math.max(0, Math.min(100, +j.score || 0)); o.verdict = j.verdict; o.best = j.best; } catch { /* keep offline score */ }
      }
    }
    const avg = Math.round(out.reduce((a, o) => a + o.score, 0) / Math.max(1, out.length));
    ensureArr('upgrades').push({ ts: Date.now(), score: avg, n: out.length, kind: 'better' });
    save();
    logActivity('better');
    $('#play').innerHTML = `<br><div class="card hl">${scoreBlock(avg, 100, 'Precision', 'How specific and natural your versions were.')}<br>
      <table><tr><th>Vague</th><th>You said</th><th>Score</th></tr>${out.map(o => `<tr><td class="muted">${esc(o.it.vague)}</td><td>${esc(o.said) || '<span class="faint">nothing heard</span>'}${o.verdict ? `<br><span class="faint">${esc(o.verdict)}</span>` : ''}${o.best ? `<br><span class="ok">${esc(o.best)}</span>` : ''}</td><td><b>${o.score}</b></td></tr>`).join('')}</table>
      <div class="row" style="margin-top:12px"><button id="again">Again</button></div></div>`;
    $('#again').onclick = () => better(pane);
  };
}
