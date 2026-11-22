import { S, save, logActivity, rememberText, $, esc, pick, mic, ensureMic, toast, sleep } from '../core.js';
import { icon } from '../icons.js';
import { Listener, speechSupported, say, loop, calibrate, cue } from '../audio.js';
import { VoiceTracker, speechThreshold, countWords } from '../metrics.js';
import { PROVIDERS, aiReady, chat, chatJson, partnerSystem, parsePartner, SCENARIOS, PARTNER_SCHEMA } from '../ai.js';
import { RESCUE_PHRASES } from '../content.js';
import { LOCAL } from '../local.js';
import { setListenMode } from '../audio.js';

const L1S = ['Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Other'];

export function renderPartner(main) {
  const ready = aiReady(S.ai);
  main.innerHTML = `<p class="eyebrow"><a href="#/practice">Practice</a> · Conversation</p><h1>Conversation partner</h1>
    <p class="sub">Real back-and-forth practice by voice. The AI talks out loud, you answer, and after each answer you get one correction and a clearer way to say it. Freezes trigger rescue phrases. Use headphones so the mic doesn’t hear the AI.</p>
    <div class="card hl"><div class="row"><select id="scen" style="flex:1">${SCENARIOS.map(s => `<option>${esc(s)}</option>`).join('')}</select><button id="startc" ${ready ? '' : 'disabled'}>${icon('mic')} Start conversation</button></div>
      ${ready ? '<p class="faint" style="margin-top:10px">Tip: “Confused listener” tells you honestly when your explanation loses them.</p>' : '<p class="warnc" style="margin-top:10px">Connect the AI coach in <a href="#/settings">Settings</a> first.</p>'}
      <div id="conv"></div></div>`;
  if (ready) $('#startc').onclick = () => conversation($('#conv'), $('#scen').value);
}

export function render(main) {
  const a = S.ai, st = S.settings;
  main.innerHTML = `
    <p class="eyebrow">Settings</p>
    <h1>Profile and coach</h1>
    <p class="sub">Your profile tunes the drills. The AI coach gives feedback after every speech, scores explanations and talks with you. On your Mac it runs privately through Ollama with Gemma 4. Keys for cloud providers stay <b>only in this browser</b>.</p>
    <div class="grid g2">
      <div class="card"><h2>Your profile</h2>
        <label class="muted">First language (prioritises the sounds you drill)</label><br><select id="l1">${L1S.map(l => `<option ${st.l1 === l ? 'selected' : ''}>${l}</option>`).join('')}</select><br><br>
        <label class="muted">Accent goal</label><br><select id="acc"><option value="american" ${st.accent === 'american' ? 'selected' : ''}>American (like Theo)</option><option value="neutral" ${st.accent === 'neutral' ? 'selected' : ''}>Clear neutral English</option></select><br><br>
        <label class="muted">Speech recognition</label><br><select id="eng"><option value="auto" ${(st.engine || 'auto') === 'auto' ? 'selected' : ''}>Automatic (on this computer when available)</option><option value="local" ${st.engine === 'local' ? 'selected' : ''} ${LOCAL.whisper ? '' : 'disabled'}>On this computer (Whisper)</option><option value="browser" ${st.engine === 'browser' ? 'selected' : ''}>Browser (sends audio to the browser’s speech service)</option></select>
        <p class="muted" style="margin-top:6px">${LOCAL.ok ? (LOCAL.whisper ? `Local engine found: ${esc(LOCAL.whisper)}.` : 'Local server found, but Whisper is not installed. Run setup_mac.sh.') : 'No local engine. Start SpeakForge with ./start.sh on your Mac for private, on-device speech.'}</p><br>
        <label class="muted">Daily practice time</label><br><select id="mins">${[10, 20, 35, 60].map(m => `<option value="${m}" ${st.dailyMinutes === m ? 'selected' : ''}>${m} min</option>`).join('')}</select><br><br>
        <label><input type="checkbox" id="lf" ${st.liveFillers !== false ? 'checked' : ''}> Live filler cue (soft tone + “pause instead” when you say um)</label><br><br>
        <button id="savep">Save profile</button></div>
      <div class="card hl"><h2>AI connection</h2>
        <select id="prov" style="width:100%">${Object.entries(PROVIDERS).map(([k, v]) => `<option value="${k}" ${a.provider === k ? 'selected' : ''}>${v}</option>`).join('')}</select><br><br>
        <div id="pfields"></div>
        <label><input type="checkbox" id="auto" ${a.auto ? 'checked' : ''}> Automatic feedback after every speech</label><br><br>
        <div class="row"><button id="savea">Save</button><button class="ghost" id="test">Test connection</button></div>
        <p id="testres" class="muted"></p>
        <details><summary class="muted">Which should I choose?</summary><p class="muted">
          <b>This computer</b> (recommended): private and free. <code>./setup_mac.sh</code> installs Ollama and Gemma 4 (26B, a mixture-of-experts model that is fast on Apple Silicon); start SpeakForge with <code>./start.sh</code>.<br>
          <b>OpenAI</b>: cloud, costs a little per day (platform.openai.com → API keys).<br>
          <b>Azure OpenAI</b>: use your resource endpoint, deployment name and key.<br>
          <b>Ollama</b>: free and private. Install from ollama.com, run <code>ollama pull gemma4:26b</code>, and start it with CORS allowed:
          <code>OLLAMA_ORIGINS="*" ollama serve</code>. Endpoint: http://localhost:11434</p></details></div>
    </div>`;
  const fields = () => {
    const p = $('#prov').value;
    const f = (id, label, val, type = 'text', ph = '') => `<label class="muted">${label}</label><br><input id="${id}" type="${type}" value="${esc(val || '')}" placeholder="${ph}" style="width:100%"><br><br>`;
    $('#pfields').innerHTML = p === 'local' ? (LOCAL.ok && LOCAL.ollama ? `<label class="muted">Model on this computer</label><br><select id="model" style="width:100%">${LOCAL.models.map(m => `<option ${m === (a.model || LOCAL.model) ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select><br><br>` : '<p class="warnc">Ollama isn’t running. Open the Ollama app (or run <code>ollama serve</code>), then reload.</p>')
      : p === 'openai' ? f('key', 'API key', a.key, 'password', 'sk-…') + f('model', 'Model', a.model || 'gpt-4o-mini')
      : p === 'azure' ? f('endpoint', 'Endpoint', a.endpoint, 'text', 'https://YOUR-RESOURCE.openai.azure.com') + f('deployment', 'Deployment name', a.deployment) + f('key', 'API key', a.key, 'password') + f('apiVersion', 'API version', a.apiVersion || '2024-10-21')
        : p === 'ollama' ? f('endpoint', 'Endpoint', a.endpoint || 'http://localhost:11434') + f('model', 'Model', a.model || 'llama3.1') + f('key', 'API key (optional)', a.key, 'password')
          : '<p class="muted">AI is off. Everything else in SpeakForge still works.</p>';
  };
  fields();
  $('#prov').onchange = fields;
  const collect = () => {
    S.ai.provider = $('#prov').value;
    S.ai.chosen = true;
    S.ai.auto = $('#auto').checked;
    for (const k of ['key', 'model', 'endpoint', 'deployment', 'apiVersion']) { const el = document.getElementById(k); if (el) S.ai[k] = el.value.trim(); }
    save();
  };
  $('#savep').onclick = () => {
    Object.assign(S.settings, { l1: $('#l1').value, accent: $('#acc').value, dailyMinutes: +$('#mins').value, engine: $('#eng').value, liveFillers: $('#lf').checked });
    setListenMode(LOCAL.ok && LOCAL.whisper && S.settings.engine !== 'browser' ? 'local' : 'browser');
    save(); toast('Profile saved');
  };
  $('#savea').onclick = () => { collect(); toast('AI settings saved'); render(main); };
  $('#test').onclick = async () => {
    collect();
    if (!aiReady(S.ai)) { $('#testres').innerHTML = '<span class="bad">Fill in the required fields first.</span>'; return; }
    $('#testres').textContent = 'Testing…';
    try {
      const r = await chat(S.ai, [{ role: 'user', content: 'Reply with exactly: ready' }], { timeoutMs: 30000 });
      $('#testres').innerHTML = `<span class="ok">Connected. AI says: “${esc(r.slice(0, 60))}”</span>`;
    } catch (e) { $('#testres').innerHTML = `<span class="bad">${esc(e.message)}</span>`; }
  };
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
    $('#live').innerHTML = '<p class="muted">Thinking…</p>';
    let rep;
    try { rep = parsePartner(await chatJson(S.ai, messages, PARTNER_SCHEMA)); } catch (e) { $('#live').innerHTML = `<p class="bad">AI error: ${esc(e.message)}</p>`; break; }
    messages.push({ role: 'assistant', content: JSON.stringify(rep) });
    if (rep.correction || rep.better) add(`<div class="card" style="background:var(--panel2);margin:6px 0"><span class="warnc">${esc(rep.correction)}</span>${rep.better ? `<br><span class="ok">Better: “${esc(rep.better)}”</span>` : ''}</div>`);
    add(`<p><b>Coach</b> ${esc(rep.reply)}</p>`);
    $('#live').innerHTML = '<p class="muted">Speaking…</p>';
    await new Promise(res => { say(rep.reply, { rate: 0.95, onEnd: res }); setTimeout(res, 20000); });
    if (ended || !box.isConnected) break;
    const userText = await listenTurn($('#live'), threshold, f => { freezesTotal += f; }, () => ended || !box.isConnected);
    if (ended || !box.isConnected) break;
    if (!userText) { add('<p class="muted">(no speech heard: try again)</p>'); messages.push({ role: 'user', content: '(I did not answer. Ask the question again more simply.)' }); continue; }
    add(`<p><b>You</b> ${esc(userText)}</p>`);
    turns.push(userText);
    messages.push({ role: 'user', content: userText });
  }
  $('#live').innerHTML = '';
  if (turns.length) {
    const words = turns.reduce((a, t) => a + countWords(t), 0);
    S.partner.push({ ts: Date.now(), scenario, turns: turns.length, words, freezes: freezesTotal });
    save();
    rememberText(turns.join('. '), 'Conversation: ' + scenario);
    logActivity('partner');
    add(`<p class="ok"><b>Conversation saved:</b> ${turns.length} answers, ${words} words, ${freezesTotal} freezes.</p>`);
  }
}

function listenTurn(live, threshold, onFreezes, isEnded = () => false) {
  return new Promise(resolve => {
    live.innerHTML = `<div class="card" style="background:var(--panel2)"><b class="ok">Your turn</b> <span class="muted">(auto-sends after 6 s of silence)</span>
      <div id="pbridge" style="min-height:70px"></div><div class="transcript" id="ptr"></div><br><button id="send">Send</button></div>`;
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
        $('#pbridge').innerHTML = `<div class="bridge">Bridge it: <b>“${esc(p.phrase)}”</b></div>`;
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
