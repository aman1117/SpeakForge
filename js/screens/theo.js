import { S, save, logActivity, addToDeck, $, esc, ensureMic, mic, toast } from '../core.js';
import { Recorder, say } from '../audio.js';
import { roundRates } from '../metrics.js';
import { THEO, COMPARE, ACCENT, ACCENT_PASSAGE, HOOKS, THEO_PHRASES, THEO_STYLE } from '../theo.js';
import { LOCAL, postAudio } from '../local.js';

// Your recent numbers in the same units as THEO (null when not measured yet).
export function yourNumbers() {
  const rounds = (S.sessions || []).slice(-6).map(s => s.rounds[s.rounds.length - 1]).filter(r => r && r.speakSec >= 15);
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const rates = rounds.map(roundRates);
  const deep = (S.deep || []).slice(-3);
  const dAvg = k => { const v = deep.map(d => d[k]).filter(x => x != null); return v.length ? avg(v) : null; };
  const acc = (S.accent || []).slice(-1)[0] || {};
  return {
    wpm: rounds.length ? Math.round(avg(rounds.map(r => r.wpm))) : null,
    freezesPerMin: rounds.length ? +avg(rates.map(r => r.freezesPerMin)).toFixed(1) : null,
    restartsPerMin: rounds.length ? +avg(rates.map(r => r.restartsPerMin)).toFixed(1) : null,
    fillersPerMin: rounds.length ? +avg(rates.map(r => r.fillersPerMin)).toFixed(1) : null,
    pctPausesAtSentenceEnd: dAvg('pct_pauses_sentence_end'),
    pctPausesMidPhrase: dAvg('pct_pauses_mid_phrase'),
    f0RangeSt: dAvg('f0_range_st'),
    pctStatementsFalling: dAvg('pct_statements_falling'),
    nurseF3Ratio: acc.nurse_f3_ratio ?? dAvg('nurse_f3_ratio'),
  };
}

export function compareTable(you) {
  const fmt = v => v == null ? '<span class="muted">not yet</span>' : (Math.round(v * 100) / 100);
  const verdict = (v, t, dir) => {
    if (v == null) return '';
    const good = dir === 'up' ? v >= t * 0.85 : dir === 'down' ? v <= Math.max(t * 1.5, t + 0.5) : Math.abs(v - t) / t <= 0.25;
    return good ? '<span class="ok">close to Theo</span>' : '<span class="warnc">keep training</span>';
  };
  return `<table><tr><th>Measure</th><th>You</th><th>Theo</th><th></th></tr>
    ${COMPARE.map(([label, key, t, dir, why]) => `<tr><td>${esc(label)}<br><span class="muted">${esc(why)}</span></td><td><b>${fmt(you[key])}</b></td><td>${t}</td><td>${verdict(you[key], t, dir)}</td></tr>`).join('')}</table>`;
}

export function render(main) {
  const you = yourNumbers();
  main.innerHTML = `
    <h1>Learn from Theo</h1>
    <p class="sub">Everything here comes from measuring Theo Browne’s real speech: 11 full video transcripts (85,000 words) and 30 minutes of his audio. Use it as a model, not a costume; a clear Indian accent is fine.</p>
    <div class="card hl"><h2>You vs Theo</h2>${compareTable(you)}
      <p class="muted" style="margin-top:12px">${LOCAL.ok ? 'Pause placement, pitch and intonation come from local deep analysis after each speech.' : 'Pause placement, pitch and R strength need the local engine (start SpeakForge with start.sh on your Mac).'}</p></div>
    <h2 style="margin-top:40px">Accent lab</h2>
    <p class="muted" style="max-width:62ch">The four accent features that make Theo sound American, measured from his audio. Listen to the model, record yourself, compare.${LOCAL.ok ? ' Then read the measurement passage so your Mac can measure your vowels and R the same way we measured his.' : ''}</p>
    <div class="grid g2" id="accent">${ACCENT.map(a => `
      <div class="card" data-id="${a.id}"><h3>${esc(a.name)}</h3>
        <p><b>What Theo does:</b> ${esc(a.theo)}</p><p><b>How:</b> ${esc(a.how)}</p>
        <p class="muted">${a.words.map(w => `<span class="pill">${esc(w)}</span>`).join(' ')}</p>
        <p class="passage" style="font-size:18px">${esc(a.sentence)}</p>
        <div class="row"><button class="ghost small" data-act="model">Hear the model</button><button class="small" data-act="rec">Record me</button><button class="ghost small hidden" data-act="me">Play me</button></div>
      </div>`).join('')}</div>
    <div class="card hl" style="margin-top:18px"><h2>Measure my accent</h2>
      <p class="passage" style="font-size:19px">${esc(ACCENT_PASSAGE)}</p>
      ${LOCAL.ok ? '<div class="row"><button id="measure">Record and measure</button><span class="muted" id="mstat">Read it at a natural pace, then press Done.</span></div><div id="mres"></div>'
        : '<p class="muted">Measurement runs locally with Whisper and Praat. Start SpeakForge on your Mac with <code>./start.sh</code> to unlock it.</p>'}
    </div>
    <h2 style="margin-top:40px">How he opens: seven hook patterns</h2>
    <div class="grid g2">${HOOKS.map(h => `<div class="card"><h3>${esc(h.type)}</h3><p class="muted">${esc(h.pattern)}</p><p>${esc(h.template)}</p>
      <a class="btn" href="#/speak?mode=creator&hook=${encodeURIComponent(h.template)}">Practise this hook</a></div>`).join('')}</div>
    <h2 style="margin-top:40px">How he talks</h2>
    <div class="grid g2"><div class="card"><table>${THEO_STYLE.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('')}</table></div>
      <div class="card"><h3>His most useful phrases</h3><p>${THEO_PHRASES.map(p => `<span class="pill" title="${esc(p.cue)}">${esc(p.phrase)}</span>`).join(' ')}</p>
        <button id="addph">Add all to my phrases</button></div></div>`;

  $('#addph').onclick = () => { THEO_PHRASES.forEach(p => addToDeck(p.phrase, p.cue, 'Theo')); toast(`${THEO_PHRASES.length} Theo phrases added`); };
  const recs = {};
  main.querySelectorAll('#accent .card').forEach(card => {
    const a = ACCENT.find(x => x.id === card.dataset.id);
    let rec = null;
    card.querySelector('[data-act=model]').onclick = () => say(`${a.words.slice(0, 6).join('. ')}. ${a.sentence}`, { rate: 0.85 });
    card.querySelector('[data-act=rec]').onclick = async e => {
      const btn = e.currentTarget;
      if (rec) {
        const blob = await rec.stop(); rec = null; btn.textContent = 'Record me again';
        if (blob) { recs[a.id] = new Audio(URL.createObjectURL(blob)); card.querySelector('[data-act=me]').classList.remove('hidden'); logActivity('accent', 5); }
        return;
      }
      if (!(await ensureMic())) return;
      rec = new Recorder(mic.stream); rec.start(); btn.textContent = 'Stop recording';
    };
    card.querySelector('[data-act=me]').onclick = () => { const au = recs[a.id]; if (au) { au.currentTime = 0; au.play(); } };
  });
  if (LOCAL.ok) {
    let rec = null;
    $('#measure').onclick = async e => {
      const btn = e.currentTarget;
      if (!rec) { if (!(await ensureMic())) return; rec = new Recorder(mic.stream); rec.start(); btn.textContent = 'Done'; $('#mstat').textContent = 'Recording… read the passage.'; return; }
      const blob = await rec.stop(); rec = null; btn.textContent = 'Record and measure again'; $('#mstat').textContent = 'Measuring on your computer…';
      try {
        const m = await postAudio('accent', blob);
        S.accent = S.accent || []; S.accent.push({ ts: Date.now(), ...m }); save(); logActivity('accent', 15);
        $('#mstat').textContent = 'Measured.';
        $('#mres').innerHTML = accentReport(m);
      } catch (err) { $('#mstat').innerHTML = `<span class="bad">Measurement failed: ${esc(err.message)}</span>`; }
    };
  }
}

export function accentReport(m) {
  const row = (label, you, theo, note) => `<tr><td>${label}<br><span class="muted">${note}</span></td><td><b>${you ?? '<span class="muted">too few words</span>'}</b></td><td>${theo}</td></tr>`;
  const f = v => v ? `F1 ${v.F1}, F2 ${v.F2} (${v.n} words)` : null;
  const split = m.trap_nasal && m.trap_oral ? m.trap_oral.F1 - m.trap_nasal.F1 : null;
  const gap = m.lot && m.thought ? Math.round(Math.hypot(m.lot.F1 - m.thought.F1, m.lot.F2 - m.thought.F2)) : null;
  return `<br><table><tr><th>Feature</th><th>You</th><th>Theo</th></tr>
    ${row('American R (F3 ratio, lower is stronger)', m.nurse_f3_ratio, THEO.nurseF3Ratio, 'Below 0.75 sounds clearly American; above 0.9 sounds like no R.')}
    ${row('“a” before m/n is raised (F1 difference, Hz)', split, THEO.trapOral.F1 - THEO.trapNasal.F1, 'Bigger means can’t/man sound different from back/bad, like Theo.')}
    ${row('got vs thought distance (Hz)', gap, Math.round(Math.hypot(THEO.lot.F1 - THEO.thought.F1, THEO.lot.F2 - THEO.thought.F2)), 'Smaller means the open, merged “ah”.')}
    ${row('a in back/bad', f(m.trap_oral), `F1 ${THEO.trapOral.F1}, F2 ${THEO.trapOral.F2}`, 'Higher F1 means a more open jaw.')}
    ${row('a in can’t/man', f(m.trap_nasal), `F1 ${THEO.trapNasal.F1}, F2 ${THEO.trapNasal.F2}`, '')}
  </table><p class="muted">Formants are measured with Praat at the middle of each target word, exactly as in the Theo analysis. Values vary with voice type; compare your trend over weeks.</p>`;
}
