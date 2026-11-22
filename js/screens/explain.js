import { S, save, logActivity, ensureArr, rememberText, $, esc, pick, toast, sleep } from '../core.js';
import { saveRecording, say } from '../audio.js';
import { speechReport } from '../metrics.js';
import { FRAMES, EXPLAIN_PROMPTS } from '../library.js';
import { aiReady, chatJson, explainMessages, parseExplain, EXPLAIN_SCHEMA } from '../ai.js';
import { capture } from '../capture.js';
import { transcriptHtml, LEGEND, scoreBlock, rubricBars, media } from '../ui.js';
import { icon } from '../icons.js';

let frame = 'answer', one = false, prompt = '';
const ONE = { name: 'One-sentence headline', who: 'Lincoln, Steve Jobs, the Heath brothers’ "commander’s intent"', parts: ['The whole idea in one sentence (max 20 words)'] };

export function render(main, params = {}) {
  if (params.f && FRAMES[params.f]) frame = params.f;
  one = params.one === '1' ? true : params.f ? false : one;
  const listenerMode = params.listener === '1';
  const F = one ? ONE : FRAMES[frame];
  if (!prompt || params.f) prompt = pick(EXPLAIN_PROMPTS[frame]);
  if (params.q) prompt = `Say this again, clearly: “${params.q}”`;
  const hist = (S.explains || []).slice(-8);
  const avg = hist.length ? (hist.reduce((a, e) => a + e.score, 0) / hist.length).toFixed(1) : null;
  main.innerHTML = `
    <p class="eyebrow"><a href="#/practice">Practice</a> · Confusing explanations</p>
    <h1>Explain gym</h1>
    <p class="sub">Plan for a few seconds, lead with the point, give one example, stop. Then see what the listener actually understood. The gap between what you meant and what they heard is the thing to fix.</p>
    <div class="tabs">${Object.entries(FRAMES).map(([k, f]) => `<button data-f="${k}" class="${!one && k === frame ? 'on' : ''}">${esc(f.name.split(' (')[0])}</button>`).join('')}<button data-one="1" class="${one ? 'on' : ''}">One sentence</button></div>
    <div class="grid g2" style="align-items:start">
      <div class="card hl">
        <p class="eyebrow">${esc(F.name)}</p>
        <div class="prompt" id="prompt" style="text-align:left;margin:0;padding:4px 0 12px">${esc(prompt)}</div>
        <div class="row"><button class="ghost small" id="spin">Another</button><input id="custom" placeholder="Or type your own question or concept" style="flex:1;min-width:180px"></div>
        <p style="margin:16px 0 6px" class="muted">Structure</p>
        <p>${F.parts.map((p, i) => `<span class="pill">${i + 1}. ${esc(p)}</span>`).join(' ')}</p>
        <p class="faint">From: ${esc(F.who)}</p>
        <div class="row" style="margin-top:14px"><label class="muted">Plan for</label><div class="choice" id="plan">${[0, 10, 20, 30, 60].map(s => `<label><input type="radio" name="plan" value="${s}" ${s === (one ? 10 : S.settings.planSec ?? 20) ? 'checked' : ''}>${s ? s + ' s' : 'No plan'}</label>`).join('')}</div></div>
        <div class="row" style="margin-top:18px"><button class="big" id="go">${icon('play')} Start</button><span class="faint">${one ? '20 seconds to say it' : 'Up to 90 seconds'}${listenerMode ? ' · then answer a confused listener' : ''}</span></div>
      </div>
      <div class="card"><h2>How a rep works</h2>
        <ol class="muted"><li><b>Plan</b>: jot 2-3 keywords per part. Planning time improves fluency and structure (Foster &amp; Skehan 1996).</li>
          <li><b>Explain</b> out loud. Your notes stay on screen like a speaker’s cue card.</li>
          <li><b>See what they heard</b>: Gemma restates your point the way a listener understood it, and scores 5 things.</li>
          <li><b>Redo with one fix</b> right away. Repeating a task with feedback is how it improves (Bygate 2001).</li></ol>
        <p class="faint">${avg ? `Your last ${hist.length}: average <b>${avg}</b>/10` : 'No reps yet.'} ${aiReady(S.ai) ? '' : '· Connect the AI coach in <a href="#/settings">Settings</a> for the full rubric (it works without, using structure checks).'}</p>
      </div>
    </div><div id="play"></div>`;
  main.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
    if (b.dataset.one) { one = true; frame = 'answer'; } else { one = false; frame = b.dataset.f; }
    prompt = pick(EXPLAIN_PROMPTS[frame]);
    render(main);
  });
  $('#spin').onclick = () => { prompt = pick(EXPLAIN_PROMPTS[frame]); $('#prompt').textContent = prompt; };
  $('#go').onclick = () => {
    const p = $('#custom').value.trim() || prompt;
    const planSec = +(main.querySelector('input[name=plan]:checked')?.value || 0);
    if (!one) { S.settings.planSec = planSec; save(); }
    rep(main, { prompt: p, F, planSec, round: 1, listenerMode });
  };
}

async function planPhase(el, F, prompt, planSec) {
  if (!planSec) return [];
  return new Promise(resolve => {
    el.innerHTML = `<div class="card hl"><p class="eyebrow">Plan · keywords only, not sentences</p><div class="prompt" style="text-align:left;margin:0 0 6px;padding:0">${esc(prompt)}</div>
      <div class="plan">${F.parts.map((p, i) => `<div><div class="lab">${esc(p)}</div><input data-i="${i}" placeholder="2-3 keywords" autocomplete="off"></div>`).join('')}</div>
      <div class="row"><div class="big" id="pt" style="font-size:52px;margin:0">${planSec}</div><span class="spacer"></span><button id="ready">I’m ready ${icon('arrow')}</button></div></div>`;
    el.querySelector('input')?.focus();
    let left = planSec, done = false;
    const finish = () => { if (done) return; done = true; clearInterval(iv); resolve([...el.querySelectorAll('.plan input')].map(i => i.value.trim())); };
    const iv = setInterval(() => { left--; const t = $('#pt', el); t.textContent = left; if (left <= 0 || !el.isConnected) finish(); }, 1000);
    $('#ready', el).onclick = finish;
    el.querySelectorAll('.plan input').forEach(inp => inp.onkeydown = e => { if (e.key === 'Enter') { const n = inp.parentElement.nextElementSibling?.querySelector('input'); if (n) n.focus(); else finish(); } });
  });
}

function offlineRubric(rep) {
  const e = rep.explain;
  return [['Point first', e.firstSentence && e.firstSentence <= 22 ? 2 : e.firstSentence <= 32 ? 1 : 0, 2], ['Signposts', Math.min(2, e.signposts.length >= 3 ? 2 : e.signposts.length ? 1 : 0), 2],
    ['Example or analogy', (e.example ? 1 : 0) + (e.analogy ? 1 : 0), 2], ['No restarts', rep.mazes.total === 0 ? 2 : rep.mazes.total <= 2 ? 1 : 0, 2], ['Clean ending', e.recap ? 2 : e.longSentences ? 0 : 1, 2]];
}

function oneScore(rep) {
  const s = rep.explain.sentences, w = rep.words;
  let v = s <= 1 && w <= 20 ? 10 : s <= 2 && w <= 30 ? 7 : w <= 45 ? 5 : 3;
  return Math.max(0, v - Math.min(3, rep.mazes.total + Math.floor(rep.fillers / 2)));
}

async function rep(main, { prompt, F, planSec, round, prev = null, fix = '', listenerMode = false }) {
  const el = $('#play') && $('#play').isConnected ? $('#play') : main;
  main.querySelectorAll('.card').forEach(c => { if (!el.contains(c)) c.style.display = 'none'; });
  main.querySelector('.tabs')?.classList.add('hidden');
  window.scrollTo(0, 0);
  const notes = await planPhase(el, F, prompt, planSec);
  if (!el.isConnected) return;
  const noteHtml = notes.some(Boolean) || fix ? `<div class="card flat" style="max-width:520px;margin:6px auto 10px;text-align:left">${fix ? `<p class="warnc" style="margin:0 0 6px"><b>This time:</b> ${esc(fix)}</p>` : ''}${F.parts.map((p, i) => notes[i] ? `<div class="row" style="gap:8px"><span class="faint" style="min-width:110px">${esc(p.split(' (')[0])}</span><b>${esc(notes[i])}</b></div>` : '').join('')}</div>` : '';
  const r = await capture(el, { secs: F === ONE ? 20 : 90, prompt, notes: noteHtml, label: round > 1 ? `Round ${round}` : 'Explain' });
  if (!r || !el.isConnected) return;
  const report = speechReport(r.text, r.speakSec);
  const offline = F === ONE ? oneScore(report) : report.explainScore;
  el.innerHTML = `<div class="card"><p class="muted">Analysing what a listener would have understood…</p></div>`;
  let ai = null, aiErr = '';
  if (aiReady(S.ai) && report.words >= 6) {
    try { ai = parseExplain(await chatJson(S.ai, explainMessages(prompt, F, r.text, S.settings), EXPLAIN_SCHEMA)); } catch (e) { aiErr = e.message; }
  }
  const score = ai ? ai.total : offline;
  rememberText(r.text, 'Explain: ' + prompt);
  ensureArr('explains').push({ ts: Date.now(), prompt, frame: F === ONE ? 'one' : frame, score, heard: ai?.heard_point || '', round, fillersPerMin: report.fillersPerMin, mazes: report.mazes.total, words: report.words, ai: !!ai });
  save();
  logActivity('explain');
  if (r.blob?.size) saveRecording({ id: `${Date.now()}-x`, ts: Date.now(), kind: 'explain', title: `Explain: ${prompt}${round > 1 ? ` (round ${round})` : ''}`, blob: r.blob, metrics: { wpm: report.wpm, fillers: report.fillers, freezes: r.freezes, repetitions: report.mazes.repetitions } }).catch(() => {});
  const cur = { score, fillers: report.fillers, mazes: report.mazes.total, words: report.words, wpm: report.wpm, freezes: r.freezes };
  const fallbackQ = !report.explain.example ? 'Can you give me one concrete example?' : !report.explain.analogy ? 'What is it similar to in everyday life?' : 'So what is the one thing I should remember?';
  const listenerQ = ai?.listener_question || fallbackQ;
  const nextFix = ai?.one_fix || (report.explain.firstSentence > 22 ? 'Say your answer in the first sentence, under 20 words.' : !report.explain.example ? 'Add one concrete example.' : report.mazes.total > 2 ? 'Never restart: bridge and keep the sentence.' : report.fillers > 2 ? 'Replace each filler with a silent pause.' : 'Cut it to half the words.');
  el.innerHTML = `
    <div class="grid g2" style="align-items:start">
      <div class="card hl">${scoreBlock(score, 10, 'Explanation score', ai ? 'Scored by your AI coach on 5 criteria' : aiErr ? `AI unavailable (${esc(aiErr)}); structure checks used` : 'Structure checks (connect AI for the full rubric)')}
        <br>${ai ? `<p class="muted" style="margin:0 0 6px">What a listener heard:</p><div class="heard">${esc(ai.heard_point)}</div><br>` : ''}
        ${rubricBars(ai ? [['Point first', ai.scores.point_first, 2], ['Structure', ai.scores.structure, 2], ['Concrete example', ai.scores.concrete, 2], ['Plain, precise words', ai.scores.plain_words, 2], ['Focused, clean end', ai.scores.focus, 2]] : F === ONE ? [['Short and single', Math.round(score / 5), 2]] : offlineRubric(report))}
        ${prev ? `<br><table><tr><th></th><th>Round ${round - 1}</th><th>Round ${round}</th></tr>${[['Score', 'score', 1], ['Fillers', 'fillers', -1], ['Restarts', 'mazes', -1], ['Words', 'words', 0], ['Freezes', 'freezes', -1]].map(([l, k, dir]) => `<tr><td>${l}</td><td>${prev[k]}</td><td><b class="${dir === 0 ? '' : (dir > 0 ? cur[k] > prev[k] : cur[k] < prev[k]) ? 'ok' : cur[k] === prev[k] ? '' : 'warnc'}">${cur[k]}</b></td></tr>`).join('')}</table>` : ''}
      </div>
      <div class="card"><h2>Next rep</h2>
        <p class="warnc" style="font-size:18px"><b>${esc(nextFix)}</b></p>
        <div class="row"><button id="redo">${icon('play')} Redo with this fix</button><button class="ghost" id="listen">Answer the listener</button></div>
        <p class="faint" style="margin-top:10px">Confused listener asks: “${esc(listenerQ)}”</p>
        ${ai?.confusing ? `<h3 style="margin-top:18px">Where they got lost</h3><p>“${esc(ai.confusing.quote)}”</p><p class="muted">${esc(ai.confusing.why)}</p>` : ''}
        <div class="row" style="margin-top:14px"><button class="ghost small" id="new">New prompt</button></div>
      </div>
    </div><br>
    ${ai && (ai.model_answer || ai.better_outline.length) ? `<div class="grid g2" style="align-items:start">
      <div class="card"><h2>A clearer version</h2><p class="passage" style="font-size:17px">${esc(ai.model_answer)}</p><div class="row"><button class="ghost small" id="hear">Hear it</button><button class="ghost small" id="shadowit">Shadow it</button></div></div>
      <div class="card"><h2>Better outline</h2><ol>${ai.better_outline.map(b => `<li>${esc(b)}</li>`).join('')}</ol></div></div><br>` : ''}
    <div class="card"><h2>What you said</h2>${LEGEND}<div class="transcript">${transcriptHtml(r.text)}</div><br>${media(r.blob)}
      <p class="faint" style="margin-top:8px">${report.words} words · ${report.wpm} wpm · ${report.fillers} fillers · ${report.mazes.total} restarts · ${report.explain.sentences} sentences (avg ${report.explain.avgSentence} words)${report.explain.signposts.length ? ` · signposts: ${report.explain.signposts.map(esc).join(', ')}` : ''}</p></div>`;
  $('#redo').onclick = () => rep(main, { prompt, F, planSec: Math.max(0, Math.round(planSec / 2)), round: round + 1, prev: cur, fix: nextFix });
  $('#listen').onclick = () => rep(main, { prompt: listenerQ, F: FRAMES.feynman, planSec: 0, round: 1, fix: 'Answer the question in your first sentence.' });
  $('#new').onclick = () => { prompt = pick(EXPLAIN_PROMPTS[frame]); render(main); };
  if (ai?.model_answer) {
    $('#hear').onclick = () => say(ai.model_answer, { rate: 0.95 });
    $('#shadowit').onclick = () => { sessionStorage.setItem('sf.shadow', ai.model_answer); location.hash = '#/shadow?t=along'; };
  }
  if (listenerMode && round === 1 && !fix) { await sleep(400); toast('Now answer the confused listener'); }
}
