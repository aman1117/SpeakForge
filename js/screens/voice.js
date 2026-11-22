import { S, save, logActivity, $, esc, pick, mic, ensureMic, sleep, meterHtml, setMeter, lineChart } from '../core.js';
import { loop, calibrate } from '../audio.js';
import { VoiceTracker, speechThreshold } from '../metrics.js';
import { READING_PASSAGES, EXPOSURE_LADDER } from '../content.js';

let tab = 'zone';

export function render(main, params = {}) {
  if (params.t) tab = params.t;
  main.innerHTML = `
    <h1>📣 Confidence Lab</h1>
    <p class="sub">Being nervous makes you speak quietly, and speaking quietly makes you sound unsure, which makes you more nervous. Break the loop: <b>train volume deliberately</b> and <b>expose yourself gradually</b> to harder speaking situations.</p>
    <div class="tabs"><button data-t="zone">🎚️ Volume zone</button><button data-t="ladder">📶 Projection ladder</button><button data-t="breath">🫁 Box breathing</button><button data-t="exposure">🪜 Exposure ladder</button><button data-t="anx">📉 Nervousness trend</button></div>
    <div id="pane"></div>`;
  main.querySelectorAll('.tabs button').forEach(b => {
    b.classList.toggle('on', b.dataset.t === tab);
    b.onclick = () => { tab = b.dataset.t; render(main); };
  });
  ({ zone, ladder, breath, exposure, anx })[tab]($('#pane'));
}

async function measureVoiced(ms, meterId, noise) {
  const tr = new VoiceTracker({ thresholdDb: speechThreshold(noise) });
  await new Promise(res => {
    const stop = loop(mic, (d, t) => { tr.update(d, t); setMeter(meterId, d); });
    setTimeout(() => { stop(); res(); }, ms);
  });
  return tr.avgVoicedDb();
}

function zone(pane) {
  const b = S.volume.baseline;
  const z = b != null ? [b + 4, b + 14] : null;
  const hist = S.zone.slice(-8).map(x => x.pct + '%').join(' → ') || 'none yet';
  pane.innerHTML = `<div class="grid g2">
    <div class="card"><h2>1. Calibrate your usual voice</h2>
      <p>Say in your <b>normal everyday voice</b>: <i>“Hi, my name is ___ and I'm practising my English today. I want to speak clearly and confidently.”</i></p>
      ${meterHtml('cal')}<br><button id="calgo">Calibrate (6 s) ▶</button>
      <p class="muted">Baseline: <b id="bv">${b == null ? 'not set' : b.toFixed(1) + ' dBFS'}</b>. Keep the same mic distance every time.</p></div>
    <div class="card hl"><h2>2. Hold the confident zone</h2>
      ${z ? `<p>Read the passage aloud and keep the bar inside the <span class="ok">green zone</span> (+4 to +14 dB above your usual voice). Imagine talking to someone 3 metres away.</p>
      ${meterHtml('zm', z)}<p class="muted">History: ${hist}</p><button id="zgo">Start 40 s reading ▶</button>` : '<p class="warnc">Calibrate first (left).</p>'}
      <div id="zres"></div></div></div>`;
  $('#calgo').onclick = async () => {
    if (!(await ensureMic())) return;
    $('#bv').textContent = 'quiet 1 s…';
    const noise = await calibrate(mic, 1000);
    $('#bv').textContent = 'speak now…';
    const avg = await measureVoiced(6000, 'cal', noise);
    if (avg == null) { $('#bv').textContent = 'no voice detected; try again'; return; }
    S.volume.baseline = avg;
    S.volume.noise = noise;
    save();
    zone(pane);
  };
  if (z) $('#zgo').onclick = async () => {
    if (!(await ensureMic())) return;
    const passage = pick(READING_PASSAGES);
    $('#zres').innerHTML = `<br><div class="passage">${esc(passage)}</div><div class="big" id="zt">40</div><p>In zone: <b id="zp">0</b>%</p>`;
    const noise = S.volume.noise ?? (await calibrate(mic, 800));
    const tr = new VoiceTracker({ thresholdDb: speechThreshold(noise) });
    await new Promise(res => {
      const stop = loop(mic, (d, t) => {
        tr.update(d, t, z);
        setMeter('zm', d);
        $('#zt').textContent = Math.max(0, Math.ceil(40 - t / 1000));
        $('#zp').textContent = tr.zonePct();
        if (t >= 40000) { stop(); res(); }
      });
    });
    const pct = tr.zonePct();
    S.zone.push({ ts: Date.now(), pct, avg: tr.avgVoicedDb() });
    save();
    logActivity('zone', 10);
    $('#zres').innerHTML = `<br><div class="kpi"><div><b class="${pct >= 70 ? 'ok' : 'warnc'}">${pct}%</b><span class="muted">time in confident zone</span></div><div><b>${tr.avgVoicedDb() == null ? '-' : '+' + (tr.avgVoicedDb() - S.volume.baseline).toFixed(1) + ' dB'}</b><span class="muted">vs usual voice</span></div></div>
      <p class="muted">${pct >= 70 ? 'Great projection. Notice that it didn\'t feel like shouting from the outside.' : 'Push air from your belly, open your mouth wider, and aim your voice at the far wall.'}</p>`;
  };
}

function ladder(pane) {
  const lines = ['Good morning, everyone.', 'Thanks for joining today.', 'Let me show you something cool.', 'This is the most important part.', 'And that is why it matters!'];
  pane.innerHTML = `<div class="card hl"><h2>Projection ladder</h2>
    <p>Say each line one step louder than the last: whisper-level → small room → classroom → hall → stage. Each step should be clearly louder <i>without</i> straining your throat (power comes from the belly).</p>
    ${meterHtml('lm')}<br><button id="lgo">Start ▶</button><div id="lres"></div></div>`;
  $('#lgo').onclick = async () => {
    if (!(await ensureMic())) return;
    const noise = await calibrate(mic, 800);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      if (!pane.isConnected) return;
      $('#lres').innerHTML = `<br><div style="text-align:center"><span class="pill">Level ${i + 1}/5</span><div class="prompt">${esc(lines[i])}</div><p class="muted">${['quiet', 'small room', 'classroom', 'hall', 'STAGE'][i]}</p></div>`;
      out.push(await measureVoiced(3500, 'lm', noise));
      await sleep(400);
    }
    const ok = out.every((v, i) => i === 0 || (v != null && out[i - 1] != null && v > out[i - 1]));
    logActivity('ladder', 8);
    $('#lres').innerHTML = `<br><table><tr><th>Level</th><th>Avg dB</th></tr>${out.map((v, i) => `<tr><td>${i + 1}</td><td>${v == null ? '-' : v.toFixed(1)}</td></tr>`).join('')}</table>
      <p class="${ok ? 'ok' : 'warnc'}">${ok ? 'Perfect staircase: you control your volume.' : 'Some steps didn\'t get louder. Exaggerate the difference next time.'}</p>`;
  };
}

function breath(pane) {
  pane.innerHTML = `<div class="card hl" style="text-align:center"><h2>Box breathing (1 min)</h2>
    <p>Used by athletes and the military to calm nerves before performing. In 4 · hold 4 · out 4 · hold 4. Do it right before recording or a meeting.</p>
    <div class="breath" id="ball"></div><div class="prompt" id="bp">Ready</div><button id="bgo">Start ▶</button></div>`;
  $('#bgo').onclick = async () => {
    const ball = $('#ball');
    for (let c = 0; c < 4; c++) {
      if (!pane.isConnected) return;
      for (const [label, scale] of [['Breathe in', 1], ['Hold', 1], ['Breathe out', .55], ['Hold', .55]]) {
        $('#bp').textContent = label;
        ball.style.transform = `scale(${scale})`;
        await sleep(4000);
      }
    }
    $('#bp').textContent = 'Calm. Now go speak 🎤';
    logActivity('breath', 3);
  };
}

function exposure(pane) {
  const next = EXPOSURE_LADDER.find(e => !S.exposure[e.id]);
  const log = (S.exposureLog || []).slice(-8).reverse();
  pane.innerHTML = `<div class="grid g2"><div class="card hl ladder"><h2>Exposure ladder</h2>
    <p>Anxiety drops through <b>gradual, repeated exposure</b>. Climb one rung at a time; repeat a rung until it feels boring, then move up. Each completed rung = +25 XP.</p>
    ${EXPOSURE_LADDER.map(e => `<label><input type="checkbox" data-id="${e.id}" ${S.exposure[e.id] ? 'checked' : ''}> <span class="pill">L${e.level}</span> ${esc(e.text)} ${S.exposure[e.id] ? `<span class="muted">✔ ${new Date(S.exposure[e.id]).toLocaleDateString()}</span>` : ''}</label>`).join('')}
  </div>
  <div class="card"><h2>📝 Log a real-world speaking moment</h2>
    <p class="muted">Meetings, calls, Toastmasters, a reel… Logging before/after nerves shows you that reality is easier than the fear.</p>
    <input id="ewhat" placeholder="What did you do? e.g. asked a question in standup" style="width:100%" value="${next ? esc(next.text) : ''}"><br><br>
    <div class="row"><label>Before <input type="number" id="eb" min="0" max="10" value="7" style="width:60px"></label><label>After <input type="number" id="ea" min="0" max="10" value="4" style="width:60px"></label><button id="elog">Log it (+20 XP)</button></div>
    <table>${log.map(x => `<tr><td>${new Date(x.ts).toLocaleDateString()}</td><td>${esc(x.what)}</td><td>${x.before}→<b class="${x.after < x.before ? 'ok' : 'warnc'}">${x.after}</b></td></tr>`).join('')}</table></div></div>`;
  pane.querySelectorAll('input[type=checkbox]').forEach(cb => cb.onchange = () => {
    if (cb.checked) { S.exposure[cb.dataset.id] = Date.now(); logActivity('exposure', 25); } else { delete S.exposure[cb.dataset.id]; save(); }
    exposure(pane);
  });
  $('#elog').onclick = () => {
    const what = $('#ewhat').value.trim();
    if (!what) return;
    const before = Math.max(0, Math.min(10, +$('#eb').value)), after = Math.max(0, Math.min(10, +$('#ea').value));
    S.exposureLog = S.exposureLog || [];
    S.exposureLog.push({ ts: Date.now(), what, before, after });
    S.anxiety.push({ ts: Date.now(), before, after, real: true });
    logActivity('realworld', 20);
    exposure(pane);
  };
}

function anx(pane) {
  const a = S.anxiety;
  pane.innerHTML = `<div class="card"><h2>Nervousness before vs after speaking</h2><canvas id="ac"></canvas>
    <p class="muted">${a.length} ratings. Rate before and after each Speaking Arena session. The <b>after</b> line dropping below <b>before</b> is proof that speaking itself reduces fear.</p></div>`;
  lineChart($('#ac'), [{ label: 'before', values: a.map(x => x.before), color: '#f59e0b' }, { label: 'after', values: a.map(x => x.after), color: '#22c55e' }]);
}
