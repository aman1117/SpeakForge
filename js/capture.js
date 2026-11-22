// Reusable live speaking component: calibrate, count down, record, transcribe live, cue freezes and fillers,
// optionally in front of the virtual audience. Resolves with everything the analysers need.
import { S, $, esc, pick, mic, ensureMic, meterHtml, setMeter, fmtTime, sleep } from './core.js';
import { loop, calibrate, Recorder, Listener, cue, openCamera, listenMode } from './audio.js';
import { VoiceTracker, speechThreshold, countWords, countFillers, avgConfidence } from './metrics.js';
import { RESCUE_PHRASES } from './content.js';
import { LOCAL } from './local.js';

export async function capture(el, { secs = 60, prompt = '', notes = '', label = 'On stage', bridge = true, fillerCue = S.settings.liveFillers !== false, audience = 0, video = false, quietMs = 1200, onAudience } = {}) {
  if (!(await ensureMic())) return null;
  let cam = null;
  if (video) { try { cam = await openCamera(); } catch { cam = null; } }
  el.innerHTML = `<div class="card" style="text-align:center"><p class="eyebrow" style="justify-content:center">Get ready</p><div class="big" id="cd">…</div><p class="muted">Stay quiet a moment while SpeakForge measures the room.</p></div>`;
  const noiseP = calibrate(mic, quietMs);
  for (let i = 3; i > 0; i--) { $('#cd', el).textContent = i; await sleep(Math.max(300, quietMs / 3)); }
  const noise = await noiseP;
  const threshold = speechThreshold(noise);
  if (!el.isConnected) { cam?.close(); return null; }
  let crowd = null;
  return new Promise(resolve => {
    const base = S.volume.baseline;
    const zone = base != null ? [base + 4, base + 14] : null;
    el.innerHTML = `<div class="card onair ${audience ? 'with-crowd' : ''}">
      ${audience ? '<canvas class="crowd" id="crowd" aria-hidden="true"></canvas>' : ''}
      <div class="stage-ui">
        <div class="row"><span class="pill on">${esc(label)}</span><span class="spacer"></span><span class="faint" id="fz">0 freezes · 0 fillers</span><button class="red small" id="stop">Finish</button></div>
        <div class="grid ${cam ? 'g2' : ''}" style="align-items:center;margin-top:10px">
          ${cam ? '<video id="camv" autoplay muted playsinline style="width:100%;max-height:360px;border-radius:18px;transform:scaleX(-1);background:#000;object-fit:cover"></video>' : ''}
          <div>${prompt ? `<div class="prompt">${esc(prompt)}</div>` : ''}${notes}
            <div class="big" id="timer" style="font-size:64px">${fmtTime(secs)}</div>
            <div style="max-width:380px;margin:0 auto">${meterHtml('lvl', zone)}</div>
            <p class="faint" id="status" style="text-align:center;margin-top:10px">${listenMode() === 'local' && !LOCAL.ready ? 'The speech engine is still loading; your words will appear in a moment.' : 'Begin whenever you’re ready.'}</p>
            <div id="bridge" style="min-height:92px;max-width:560px;margin:0 auto"></div></div></div>
      </div>
      ${audience ? '' : '<div class="transcript" id="tr"><span class="faint">Your words appear here as you speak.</span></div>'}
    </div>`;
    if (cam) $('#camv', el).srcObject = cam.stream;
    const begin = async () => {
      if (audience) {
        try {
          const mod = await import('./audience.js');
          crowd = new mod.Audience($('#crowd', el), { level: audience, sound: true });
          crowd.start();
          onAudience?.(crowd);
        } catch (e) { console.warn('audience unavailable', e); }
      }
    };
    begin();
    const tracker = new VoiceTracker({ thresholdDb: threshold });
    let lastFillers = 0, fillersLive = 0, flashT = 0;
    let freezes = 0, recovered = 0, inFreeze = false, freezeStart = 0, ended = false, lastT = 0;
    const listener = new Listener({ onText: t => {
      const tr = $('#tr', el); if (tr.isConnected) tr.textContent = t;
      const f = countFillers(t).total;
      if (f > lastFillers) {
        fillersLive += f - lastFillers;
        if (fillerCue && !inFreeze) {
          flashT = performance.now();
          $('#bridge', el).innerHTML = '<div class="bridge fillerflash"><span class="muted">Filler</span><b>Pause instead. Close your lips, breathe, continue.</b></div>';
          cue(330, 90);
        }
      }
      lastFillers = f;
      status();
    } });
    listener.start();
    const recStream = cam ? new MediaStream([...cam.stream.getVideoTracks(), ...mic.stream.getAudioTracks()]) : mic.stream;
    const recorder = new Recorder(recStream, !!cam);
    recorder.start();
    const status = () => { $('#fz', el).textContent = `${freezes} freeze${freezes === 1 ? '' : 's'} · ${fillersLive} filler${fillersLive === 1 ? '' : 's'}`; };
    const stopLoop = loop(mic, (db, t) => {
      if (ended) return;
      if (!el.isConnected) { finish(); return; }
      lastT = t;
      setMeter('lvl', db);
      const silence = tracker.update(db, t, zone);
      const left = secs - t / 1000;
      $('#timer', el).textContent = fmtTime(Math.max(0, left));
      if (bridge && silence > S.settings.bridgeMs && !inFreeze) {
        inFreeze = true; freezes++; freezeStart = t;
        const p = pick(RESCUE_PHRASES);
        $('#bridge', el).innerHTML = `<div class="bridge"><span class="muted">Lost the word? Keep the sentence going:</span><b>“${esc(p.phrase)}”</b><span class="faint">${esc(p.use)}</span></div>`;
        if (S.settings.cue) cue(660, 140);
        status();
      }
      if (inFreeze && silence === 0) { inFreeze = false; if (t - freezeStart < 6000) recovered++; $('#bridge', el).innerHTML = ''; }
      else if (!inFreeze && flashT && performance.now() - flashT > 2200) { flashT = 0; $('#bridge', el).innerHTML = ''; }
      crowd?.feed(db, threshold, inFreeze ? 'freeze' : db >= threshold ? 'speaking' : 'idle');
      if (left <= 0) finish();
    });
    $('#stop', el).onclick = () => finish();
    async function finish() {
      if (ended) return;
      ended = true;
      stopLoop();
      $('#status', el).textContent = 'Processing…';
      if (crowd) { try { crowd.applause(); } catch { /* ignore */ } }
      const [text, blob] = await Promise.all([listener.stop(), recorder.stop()]);
      cam?.close();
      setTimeout(() => crowd?.stop(), 4000);
      const speakSec = tracker.firstVoiceT == null ? 0 : (lastT - tracker.firstVoiceT) / 1000;
      resolve({ text, blob, secs, speakSec, pauses: tracker.pauses, freezes, recovered, fillersLive, words: countWords(text), avgDb: tracker.avgVoicedDb(), zonePct: zone ? tracker.zonePct() : null, clarity: avgConfidence(listener.confs), video: !!cam });
    }
  });
}
