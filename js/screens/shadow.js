import { S, save, logActivity, $, esc, ensureMic, sleep, toast } from '../core.js';
import { Listener, speechSupported, say } from '../audio.js';
import { similarity, missedWords } from '../metrics.js';
import { SHADOW_SCRIPTS } from '../content.js';

let tab = 'along';
let scriptText = SHADOW_SCRIPTS[0].text;

export function render(main, params = {}) {
  if (params.t) tab = params.t;
  main.innerHTML = `
    <h1>🗣️ Shadowing Studio</h1>
    <p class="sub">Shadowing = speaking <b>at the same time</b> as a native speaker, copying their rhythm, stress, pitch and pauses. Research (Hamada et al.) shows gains in pronunciation and fluency. Mona did it 100 days in a row.</p>
    <div class="tabs"><button data-t="along">🎧 Speak along</button><button data-t="echo">🔁 Echo &amp; score</button><button data-t="own">🎬 Your own clips (Theo, Mona…)</button></div>
    <div id="pane"></div>`;
  main.querySelectorAll('.tabs button').forEach(b => {
    b.classList.toggle('on', b.dataset.t === tab);
    b.onclick = () => { tab = b.dataset.t; render(main); };
  });
  ({ along, echo, own })[tab]($('#pane'));
}

function scriptPicker() {
  return `<div class="row"><select id="sp">${SHADOW_SCRIPTS.map((s, i) => `<option value="${i}">${esc(s.title)}</option>`).join('')}<option value="custom">✏️ Paste my own text</option></select></div>
    <textarea id="stext" class="hidden" placeholder="Paste a transcript (e.g. 3-4 sentences from a Theo video)"></textarea>`;
}
function bindPicker(onChange) {
  $('#sp').onchange = () => {
    const v = $('#sp').value;
    $('#stext').classList.toggle('hidden', v !== 'custom');
    if (v !== 'custom') scriptText = SHADOW_SCRIPTS[+v].text;
    onChange();
  };
  $('#stext').oninput = () => { scriptText = $('#stext').value; onChange(); };
}

function along(pane) {
  pane.innerHTML = `<div class="card hl"><h2>Speak along</h2>${scriptPicker()}<br>
    <div class="passage" id="words"></div><br>
    <div class="row"><label class="muted">Speed</label><select id="rate"><option value="0.7">0.7× (learn)</option><option value="0.85">0.85×</option><option value="1" selected>1× (natural)</option><option value="1.15">1.15× (challenge)</option></select>
    <button id="play">▶ Play &amp; shadow</button><button class="ghost" id="stop">■ Stop</button><button class="green" id="done">✔ Log 5 reps</button></div>
    <p class="muted">Method: (1) listen once at 0.7×, (2) read along silently, (3) shadow out loud at 0.85×, (4) shadow at 1× copying the <b>stress and melody</b>, not just the words. 5 reps.</p></div>`;
  const draw = () => {
    $('#words').innerHTML = scriptText.split(/(\s+)/).map(tok => /^\s+$/.test(tok) || !tok ? tok : `<span class="word">${esc(tok)}</span>`).join('');
    let pos = 0;
    $('#words').querySelectorAll('.word').forEach(w => { const i = scriptText.indexOf(w.textContent, pos); w.dataset.c = i; pos = i + w.textContent.length; });
  };
  draw();
  bindPicker(draw);
  $('#play').onclick = () => {
    const spans = [...$('#words').querySelectorAll('.word')];
    say(scriptText, {
      rate: +$('#rate').value,
      onBoundary: e => {
        spans.forEach(s => s.classList.remove('now'));
        const s = [...spans].reverse().find(sp => +sp.dataset.c <= e.charIndex);
        s?.classList.add('now');
      },
      onEnd: () => spans.forEach(s => s.classList.remove('now')),
    });
  };
  $('#stop').onclick = () => speechSynthesis.cancel();
  $('#done').onclick = () => { S.shadow.push({ ts: Date.now(), mode: 'along' }); save(); logActivity('shadow', 15); };
}

function sentences(text) {
  return (text.match(/[^.!?]+[.!?]*/g) || []).map(s => s.trim()).filter(s => s.split(/\s+/).length >= 2);
}

function echo(pane) {
  pane.innerHTML = `<div class="card hl"><h2>Echo &amp; score</h2>${scriptPicker()}
    <p>The voice says one sentence → you repeat it immediately, copying the melody → SpeakForge scores clarity. Press <b>Next</b> after you finish each sentence.</p>
    <div class="row"><select id="rate"><option value="0.85">0.85×</option><option value="1" selected>1×</option></select><button id="go">Start ▶</button></div><div id="play"></div></div>`;
  bindPicker(() => {});
  $('#go').onclick = async () => {
    if (!speechSupported()) { $('#play').innerHTML = '<p class="bad">Needs Edge/Chrome.</p>'; return; }
    if (!(await ensureMic())) return;
    const sents = sentences(scriptText);
    const rate = +$('#rate').value;
    const scores = [];
    for (let i = 0; i < sents.length; i++) {
      if (!pane.isConnected) return;
      const s = sents[i];
      $('#play').innerHTML = `<br><div style="text-align:center"><span class="pill">${i + 1}/${sents.length}</span><div class="prompt">${esc(s)}</div><p class="muted" id="st">🔊 Listen…</p><div class="transcript" id="tr"></div><br><button id="next" disabled>Next ▶</button> <button class="ghost small" id="again">🔊 again</button></div>`;
      await new Promise(res => say(s, { rate, onEnd: res }));
      $('#st').innerHTML = '<b class="warnc">🎙️ Your turn: repeat it!</b>';
      const l = new Listener();
      l.start();
      $('#next').disabled = false;
      $('#again').onclick = () => say(s, { rate });
      const iv = setInterval(() => { $('#tr').textContent = l.text(); }, 150);
      await new Promise(res => { $('#next').onclick = res; });
      clearInterval(iv);
      const heard = await l.stop();
      const sc = similarity(s, heard);
      scores.push(sc);
      const miss = missedWords(s, heard);
      $('#st').innerHTML = `<b class="${sc >= 85 ? 'ok' : 'warnc'}">${sc}%</b> ${miss.length ? 'unclear: ' + miss.map(esc).join(', ') : ''}`;
      await sleep(900);
    }
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    S.shadow.push({ ts: Date.now(), mode: 'echo', score: avg });
    save();
    logActivity('shadow', 15);
    $('#play').innerHTML = `<br><div class="kpi"><div><b class="${avg >= 85 ? 'ok' : 'warnc'}">${avg}%</b><span class="muted">average clarity</span></div><div><b>${scores.length}</b><span class="muted">sentences</span></div></div>`;
  };
}

function own(pane) {
  pane.innerHTML = `<div class="card hl"><h2>Shadow your own clips</h2>
    <p>Save a short clip (30-90 s) of Theo, Mona or any speaker you admire as an audio/video file (screen-record it on your phone or PC), then load it here. It never leaves your computer.</p>
    <input type="file" id="file" accept="audio/*,video/*"><br><br>
    <video id="media" controls style="width:100%;max-height:340px;background:#000" class="hidden"></video>
    <div class="row" id="ctrls" style="margin-top:10px">
      <label class="muted">Speed</label><select id="spd"><option>0.5</option><option>0.65</option><option>0.75</option><option>0.85</option><option selected>1</option><option>1.1</option></select>
      <button class="ghost small" id="ba">Set A</button><button class="ghost small" id="bb">Set B</button><button class="ghost small" id="bclr">Clear loop</button>
      <span class="muted" id="loopinfo">No loop</span><span class="spacer"></span><button class="ghost small" id="back3">⏪ 3s</button>
    </div><br>
    <textarea id="script" placeholder="Optional: paste the transcript here to read along (YouTube → … → Show transcript)"></textarea><br><br>
    <div class="row"><input type="number" id="mins" value="10" min="1" style="width:80px"><span class="muted">minutes practised</span><button class="green" id="log">✔ Log session</button></div>
    <p class="muted">Pro routine (Theo clip): loop one sentence A→B at 0.75× ×5, then 1× ×5, then the whole clip at 1× ×3. Mark stressed words in the transcript with CAPS and pauses with “/”.</p></div>`;
  const m = $('#media');
  let A = null, B = null;
  $('#file').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    m.src = URL.createObjectURL(f);
    m.classList.remove('hidden');
  };
  $('#spd').onchange = () => { m.playbackRate = +$('#spd').value; };
  m.onplay = () => { m.playbackRate = +$('#spd').value; };
  const info = () => { $('#loopinfo').textContent = A != null && B != null ? `Loop ${A.toFixed(1)}s → ${B.toFixed(1)}s` : A != null ? `A = ${A.toFixed(1)}s` : 'No loop'; };
  $('#ba').onclick = () => { A = m.currentTime; info(); };
  $('#bb').onclick = () => { B = m.currentTime; if (A != null && B > A) m.currentTime = A; info(); };
  $('#bclr').onclick = () => { A = B = null; info(); };
  $('#back3').onclick = () => { m.currentTime = Math.max(0, m.currentTime - 3); };
  m.ontimeupdate = () => { if (A != null && B != null && B > A && m.currentTime >= B) m.currentTime = A; };
  $('#log').onclick = () => {
    const mins = Math.max(1, +$('#mins').value || 1);
    S.shadow.push({ ts: Date.now(), mode: 'own', mins });
    save();
    logActivity('shadow', 10 + mins * 2);
    toast('Shadowing logged 💪');
  };
}
