import { S, save, logActivity, $, esc, pick, mic, ensureMic, toast, sleep } from '../core.js';
import { Listener, speechSupported, say, loop, calibrate, cue } from '../audio.js';
import { VoiceTracker, speechThreshold, countWords } from '../metrics.js';
import { PROVIDERS, aiReady, chat, partnerSystem, parsePartner, SCENARIOS } from '../ai.js';
import { RESCUE_PHRASES } from '../content.js';

const L1S = ['Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Other'];

export function render(main) {
  const a = S.ai, st = S.settings;
  main.innerHTML = `
    <h1>🤖 AI Coach &amp; Profile</h1>
    <p class="sub">Your profile tunes the drills. An AI connection unlocks automatic feedback after every speech and a voice conversation partner. Keys are stored <b>only in this browser</b> and sent only to the provider you choose.</p>
    <div class="grid g2">
      <div class="card"><h2>Your profile</h2>
        <label class="muted">First language (prioritises the sounds you drill)</label><br><select id="l1">${L1S.map(l => `<option ${st.l1 === l ? 'selected' : ''}>${l}</option>`).join('')}</select><br><br>
        <label class="muted">Accent goal</label><br><select id="acc"><option value="american" ${st.accent === 'american' ? 'selected' : ''}>American (like Theo)</option><option value="neutral" ${st.accent === 'neutral' ? 'selected' : ''}>Clear neutral English</option></select><br><br>
        <label class="muted">Daily practice time</label><br><select id="mins">${[10, 20, 35, 60].map(m => `<option value="${m}" ${st.dailyMinutes === m ? 'selected' : ''}>${m} min</option>`).join('')}</select><br><br>
        <button id="savep">Save profile</button></div>
      <div class="card hl"><h2>AI connection</h2>
        <select id="prov" style="width:100%">${Object.entries(PROVIDERS).map(([k, v]) => `<option value="${k}" ${a.provider === k ? 'selected' : ''}>${v}</option>`).join('')}</select><br><br>
        <div id="pfields"></div>
        <label><input type="checkbox" id="auto" ${a.auto ? 'checked' : ''}> Automatic feedback after every speech</label><br><br>
        <div class="row"><button id="savea">Save</button><button class="ghost" id="test">Test connection</button></div>
        <p id="testres" class="muted"></p>
        <details><summary class="muted">Which should I choose?</summary><p class="muted">
          <b>OpenAI</b>: best quality, a few rupees per day (platform.openai.com → API keys; model gpt-4o-mini is cheap).<br>
          <b>Azure OpenAI</b>: use your resource endpoint, deployment name and key.<br>
          <b>Ollama</b>: free and private. Install from ollama.com, run <code>ollama pull llama3.1</code>, and start it with CORS allowed:
          <code>$env:OLLAMA_ORIGINS="*"; ollama serve</code>. Endpoint: http://localhost:11434</p></details></div>
    </div><br>
    <div class="card hl"><h2>🗣️ Conversation partner</h2>
      <p>Real conversation practice: the AI talks (out loud), you answer by voice. Freezes trigger BRIDGE cards; after each answer you get one correction. Use headphones so the mic doesn't hear the AI.</p>
      <div class="row"><select id="scen">${SCENARIOS.map(s => `<option>${esc(s)}</option>`).join('')}</select><button id="startc" ${aiReady(a) ? '' : 'disabled'}>Start conversation ▶</button></div>
      ${aiReady(a) ? '' : '<p class="warnc">Connect an AI above first.</p>'}
      <div id="conv"></div></div>`;
  const fields = () => {
    const p = $('#prov').value;
    const f = (id, label, val, type = 'text', ph = '') => `<label class="muted">${label}</label><br><input id="${id}" type="${type}" value="${esc(val || '')}" placeholder="${ph}" style="width:100%"><br><br>`;
    $('#pfields').innerHTML = p === 'openai' ? f('key', 'API key', a.key, 'password', 'sk-…') + f('model', 'Model', a.model || 'gpt-4o-mini')
      : p === 'azure' ? f('endpoint', 'Endpoint', a.endpoint, 'text', 'https://YOUR-RESOURCE.openai.azure.com') + f('deployment', 'Deployment name', a.deployment) + f('key', 'API key', a.key, 'password') + f('apiVersion', 'API version', a.apiVersion || '2024-10-21')
        : p === 'ollama' ? f('endpoint', 'Endpoint', a.endpoint || 'http://localhost:11434') + f('model', 'Model', a.model || 'llama3.1') + f('key', 'API key (optional)', a.key, 'password')
          : '<p class="muted">AI is off. Everything else in SpeakForge still works.</p>';
  };
  fields();
  $('#prov').onchange = fields;
  const collect = () => {
    S.ai.provider = $('#prov').value;
    S.ai.auto = $('#auto').checked;
    for (const k of ['key', 'model', 'endpoint', 'deployment', 'apiVersion']) { const el = document.getElementById(k); if (el) S.ai[k] = el.value.trim(); }
    save();
  };
  $('#savep').onclick = () => { Object.assign(S.settings, { l1: $('#l1').value, accent: $('#acc').value, dailyMinutes: +$('#mins').value }); save(); toast('Profile saved'); };
  $('#savea').onclick = () => { collect(); toast('AI settings saved'); render(main); };
  $('#test').onclick = async () => {
    collect();
    if (!aiReady(S.ai)) { $('#testres').innerHTML = '<span class="bad">Fill in the required fields first.</span>'; return; }
    $('#testres').textContent = 'Testing…';
    try {
      const r = await chat(S.ai, [{ role: 'user', content: 'Reply with exactly: ready' }], { timeoutMs: 30000 });
      $('#testres').innerHTML = `<span class="ok">✔ Connected. AI says: “${esc(r.slice(0, 60))}”</span>`;
      $('#startc').disabled = false;
    } catch (e) { $('#testres').innerHTML = `<span class="bad">✘ ${esc(e.message)}</span>`; }
  };
  $('#startc').onclick = () => conversation($('#conv'), $('#scen').value);
}

async function conversation(box, scenario) {
  if (!speechSupported()) { box.innerHTML = '<p class="bad">Needs Edge/Chrome for speech recognition.</p>'; return; }
  if (!(await ensureMic())) return;
  const messages = [{ role: 'system', content: partnerSystem(S.settings, scenario) }, { role: 'user', content: '(Start the conversation: greet me naturally and ask your first question.)' }];
  const turns = [];
  let ended = false, freezesTotal = 0;
  const noise = await calibrate(mic, 800);
  const threshold = speechThreshold(noise);
  box.innerHTML = '<br><div id="log"></div><div id="live"></div><br><div class="row"><button class="red small" id="endc">End conversation</button></div>';
  $('#endc').onclick = () => { ended = true; };
  const logEl = $('#log');
  const add = html => { logEl.insertAdjacentHTML('beforeend', html); };
  while (!ended && box.isConnected) {
    $('#live').innerHTML = '<p class="muted">🤖 thinking…</p>';
    let rep;
    try { rep = parsePartner(await chat(S.ai, messages)); } catch (e) { $('#live').innerHTML = `<p class="bad">AI error: ${esc(e.message)}</p>`; break; }
    messages.push({ role: 'assistant', content: JSON.stringify(rep) });
    if (rep.correction || rep.better) add(`<div class="card" style="background:var(--panel2);margin:6px 0"><span class="warnc">💡 ${esc(rep.correction)}</span>${rep.better ? `<br><span class="ok">Better: “${esc(rep.better)}”</span>` : ''}</div>`);
    add(`<p><b>🤖</b> ${esc(rep.reply)}</p>`);
    $('#live').innerHTML = '<p class="muted">🔊 speaking…</p>';
    await new Promise(res => { say(rep.reply, { rate: 0.95, onEnd: res }); setTimeout(res, 20000); });
    if (ended || !box.isConnected) break;
    const userText = await listenTurn($('#live'), threshold, f => { freezesTotal += f; }, () => ended || !box.isConnected);
    if (ended || !box.isConnected) break;
    if (!userText) { add('<p class="muted">(no speech heard: try again)</p>'); messages.push({ role: 'user', content: '(I did not answer. Ask the question again more simply.)' }); continue; }
    add(`<p><b>🧑</b> ${esc(userText)}</p>`);
    turns.push(userText);
    messages.push({ role: 'user', content: userText });
  }
  $('#live').innerHTML = '';
  if (turns.length) {
    const words = turns.reduce((a, t) => a + countWords(t), 0);
    S.partner.push({ ts: Date.now(), scenario, turns: turns.length, words, freezes: freezesTotal });
    save();
    logActivity('partner', 10 + turns.length * 4);
    add(`<p class="ok"><b>Conversation saved:</b> ${turns.length} answers, ${words} words, ${freezesTotal} freezes.</p>`);
  }
}

function listenTurn(live, threshold, onFreezes, isEnded = () => false) {
  return new Promise(resolve => {
    live.innerHTML = `<div class="card" style="background:var(--panel2)"><b class="ok">🎙️ Your turn</b> <span class="muted">(auto-sends after 6 s of silence)</span>
      <div id="pbridge" style="min-height:70px"></div><div class="transcript" id="ptr"></div><br><button id="send">Send ➤</button></div>`;
    const l = new Listener({ onText: t => { $('#ptr').textContent = t; } });
    l.start();
    const tr = new VoiceTracker({ thresholdDb: threshold });
    let freezes = 0, inFreeze = false, done = false;
    const stop = loop(mic, (db, t) => {
      if (isEnded()) { finish(); return; }
      const sil = tr.update(db, t);
      if (sil > S.settings.bridgeMs && !inFreeze) {
        inFreeze = true; freezes++;
        const p = pick(RESCUE_PHRASES);
        $('#pbridge').innerHTML = `<div class="bridge">🌉 <b>“${esc(p.phrase)}”</b></div>`;
        if (S.settings.cue) cue(660, 120);
      }
      if (inFreeze && sil === 0) { inFreeze = false; $('#pbridge').innerHTML = ''; }
      if (tr.started && sil > 6000) finish();
      if (!tr.started && t > 20000) finish();
    });
    $('#send').onclick = () => finish();
    async function finish() {
      if (done) return;
      done = true;
      stop();
      onFreezes(freezes);
      await sleep(200);
      resolve((await l.stop()).replace(/\.\s*$/, '').trim());
    }
  });
}
