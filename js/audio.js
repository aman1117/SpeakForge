// Browser I/O: microphone level, recording, speech recognition, text-to-speech, recording storage.

// Everything that keeps running in the background registers here so navigation can stop it.
const ACTIVE = new Set();
export function stopAllAudio() {
  for (const fn of [...ACTIVE]) { try { fn(); } catch { /* ignore */ } }
  ACTIVE.clear();
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

export class Mic {
  constructor() { this.stream = null; this.ctx = null; this.analyser = null; this.buf = null; }
  async start() {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch { /* Safari needs a user gesture */ } }
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.buf = new Float32Array(this.analyser.fftSize);
    src.connect(this.analyser);
  }
  db() {
    if (!this.analyser) return -100;
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    const rms = Math.sqrt(sum / this.buf.length);
    return rms > 0 ? Math.max(-100, 20 * Math.log10(rms)) : -100;
  }
  stop() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.ctx?.close();
    this.stream = this.ctx = this.analyser = null;
  }
}

// Calls onFrame(db, tMs) every ~30 ms until stopped.
export function loop(mic, onFrame) {
  let alive = true;
  const t0 = performance.now();
  const id = setInterval(() => { if (alive) onFrame(mic.db(), performance.now() - t0); }, 30);
  const stop = () => { alive = false; clearInterval(id); ACTIVE.delete(stop); };
  ACTIVE.add(stop);
  return stop;
}

export async function calibrate(mic, ms = 1500) {
  const vals = [];
  await new Promise(res => { const stop = loop(mic, d => vals.push(d)); setTimeout(() => { stop(); res(); }, ms); });
  vals.sort((a, b) => a - b);
  return vals.length ? vals[Math.floor(vals.length * 0.2)] : -60;
}

export class Recorder {
  constructor(stream, video = false) { this.stream = stream; this.video = video; this.chunks = []; this.rec = null; }
  start() {
    const types = this.video ? ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'] : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    const type = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    this.rec = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = e => e.data.size && this.chunks.push(e.data);
    this.rec.start(250);
    this._kill = () => { try { if (this.rec.state !== 'inactive') this.rec.stop(); } catch { /* ignore */ } };
    ACTIVE.add(this._kill);
  }
  stop() {
    ACTIVE.delete(this._kill);
    return new Promise(res => {
      if (!this.rec || this.rec.state === 'inactive') return res(null);
      this.rec.onstop = () => res(new Blob(this.chunks, { type: this.rec.mimeType || (this.video ? 'video/webm' : 'audio/webm') }));
      this.rec.stop();
    });
  }
}

// 'browser' = Web Speech API (Edge/Chrome/Safari); 'local' = Whisper on this computer via server.py.
let LISTEN_MODE = 'browser';
let MIC = null;
export function setListenMode(m) { LISTEN_MODE = m; }
export function listenMode() { return LISTEN_MODE; }
export function bindMic(m) { MIC = m; }

export function speechSupported() {
  return LISTEN_MODE === 'local' || !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Continuous recognition that auto-restarts (Chrome/Edge/Safari end sessions after silence).
class BrowserListener {
  constructor({ onText, lang = 'en-US' } = {}) {
    this.onText = onText || (() => {});
    this.lang = lang;
    this.finalText = '';
    this.interim = '';
    this.confs = [];
    this.active = false;
    this.rec = null;
  }
  start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    this.active = true;
    this.finalText = '';
    this.interim = '';
    this.confs = [];
    const make = () => {
      const r = new SR();
      r.lang = this.lang;
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 1;
      r.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) { this.finalText += res[0].transcript.trim() + '. '; this.confs.push(res[0].confidence || 0); }
          else interim += res[0].transcript;
        }
        this.interim = interim;
        this.onText(this.text());
      };
      r.onerror = () => {};
      r.onend = () => { if (this.active) { try { this.rec = make(); this.rec.start(); } catch { /* ignore */ } } };
      return r;
    };
    this.rec = make();
    this._kill = () => { this.active = false; try { this.rec?.abort(); } catch { /* ignore */ } };
    ACTIVE.add(this._kill);
    try { this.rec.start(); } catch { return false; }
    return true;
  }
  text() { return (this.finalText + ' ' + this.interim).trim(); }
  stop() {
    ACTIVE.delete(this._kill);
    this.active = false;
    try { this.rec?.stop(); } catch { /* ignore */ }
    return new Promise(res => setTimeout(() => res(this.text()), 600));
  }
}

// Local Whisper listener: splits speech into phrases at pauses, transcribes each phrase on this computer.
// Same interface as BrowserListener: finalText grows phrase by phrase, interim shows the phrase in progress.
class LocalListener {
  constructor({ onText } = {}) {
    this.onText = onText || (() => {});
    this.finalText = '';
    this.interim = '';
    this.confs = [];
    this.active = false;
  }
  start() {
    if (!MIC || !MIC.ctx || !MIC.stream) return false;
    this.active = true;
    this.finalText = ''; this.interim = ''; this.confs = [];
    const ctx = MIC.ctx;
    this.rate = ctx.sampleRate;
    this.seg = []; this.segLen = 0; this.pre = []; this.voicedMs = 0; this.silentMs = 0;
    this.noise = -60; this.chain = Promise.resolve(); this.interimBusy = false; this.lastInterim = 0;
    this.src = ctx.createMediaStreamSource(MIC.stream);
    this.proc = ctx.createScriptProcessor(4096, 1, 1);
    this.proc.onaudioprocess = e => this._onAudio(e.inputBuffer.getChannelData(0));
    this.src.connect(this.proc);
    this.proc.connect(ctx.destination);
    this._kill = () => this._teardown();
    ACTIVE.add(this._kill);
    return true;
  }
  _onAudio(data) {
    if (!this.active) return;
    const chunk = new Float32Array(data);
    let sum = 0;
    for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i];
    const db = 20 * Math.log10(Math.sqrt(sum / chunk.length) || 1e-6);
    this.noise = db < this.noise ? db : this.noise + 0.02;
    const thr = Math.min(Math.max(this.noise + 12, -58), -38);
    const ms = 1000 * chunk.length / this.rate;
    const voiced = db >= thr;
    if (this.segLen === 0 && !voiced) {
      this.pre.push(chunk);
      while (this.pre.length > 2) this.pre.shift();
      return;
    }
    if (this.segLen === 0) { for (const p of this.pre) { this.seg.push(p); this.segLen += p.length; } this.pre = []; }
    this.seg.push(chunk); this.segLen += chunk.length;
    if (voiced) { this.voicedMs += ms; this.silentMs = 0; } else this.silentMs += ms;
    const segSec = this.segLen / this.rate;
    if ((this.silentMs >= 650 && this.voicedMs >= 250) || segSec > 12) this._finalize();
    else if (this.silentMs >= 1500 && this.voicedMs < 250) this._reset();
    else if (this.voicedMs >= 600 && !this.interimBusy && performance.now() - this.lastInterim > 1200) this._interim();
  }
  _samples() {
    const out = new Float32Array(this.segLen);
    let o = 0;
    for (const c of this.seg) { out.set(c, o); o += c.length; }
    return resample16k(out, this.rate);
  }
  _reset() { this.seg = []; this.segLen = 0; this.voicedMs = 0; this.silentMs = 0; }
  _interim() {
    this.interimBusy = true;
    this.lastInterim = performance.now();
    const wav = toWav(this._samples(), 16000);
    transcribeLocal(wav, true).then(r => { if (this.active && r.text) { this.interim = r.text; this.onText(this.text()); } }).catch(() => {}).finally(() => { this.interimBusy = false; });
  }
  _finalize() {
    const wav = toWav(this._samples(), 16000);
    this._reset();
    this.chain = this.chain.then(() => transcribeLocal(wav).then(r => {
      if (r.text) { this.finalText += r.text.trim().replace(/[.?!]?$/, '.') + ' '; if (r.confidence != null) this.confs.push(r.confidence); }
      this.interim = '';
      this.onText(this.text());
    }).catch(() => {}));
  }
  text() { return (this.finalText + ' ' + this.interim).trim(); }
  _teardown() {
    this.active = false;
    try { this.proc.disconnect(); this.src.disconnect(); } catch { /* ignore */ }
  }
  async stop() {
    ACTIVE.delete(this._kill);
    if (this.active && this.voicedMs >= 200) this._finalize();
    this._teardown();
    await Promise.race([this.chain, new Promise(r => setTimeout(r, 15000))]);
    this.interim = '';
    return this.text();
  }
}

export class Listener {
  constructor(opts) { this.impl = LISTEN_MODE === 'local' ? new LocalListener(opts) : new BrowserListener(opts); }
  get finalText() { return this.impl.finalText; }
  get interim() { return this.impl.interim; }
  get confs() { return this.impl.confs; }
  start() { return this.impl.start(); }
  text() { return this.impl.text(); }
  stop() { return this.impl.stop(); }
}

async function transcribeLocal(wav, partial = false) {
  const r = await fetch(`api/transcribe?fast=1${partial ? '&partial=1' : ''}`, { method: 'POST', body: wav, headers: { 'Content-Type': 'audio/wav' } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function resample16k(input, fromRate) {
  if (fromRate === 16000) return input;
  const ratio = fromRate / 16000, out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) { const x = i * ratio, i0 = Math.floor(x), f = x - i0; out[i] = (input[i0] || 0) * (1 - f) + (input[i0 + 1] || 0) * f; }
  return out;
}

function toWav(samples, rate) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) { const s = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Blob([buf], { type: 'audio/wav' });
}

// Prefer natural, on-device voices. macOS ships novelty voices (Albert, Bells, Zarvox…) that must never be picked.
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|pipe organ|fred|junior|ralph|kathy|princess/i;
const PREFERRED = [/ava \(premium\)|ava \(enhanced\)/i, /zoe \(premium\)|zoe \(enhanced\)/i, /evan \(enhanced\)|nathan \(enhanced\)/i, /samantha/i, /^alex$/i, /aria|jenny|guy/i, /natural/i, /google us english/i];
let cachedVoice = null;
export function pickVoice() {
  if (cachedVoice) return cachedVoice;
  const vs = speechSynthesis.getVoices().filter(v => /^en[-_]US/i.test(v.lang) && !NOVELTY.test(v.name));
  for (const re of PREFERRED) { const v = vs.find(x => re.test(x.name)); if (v) return (cachedVoice = v); }
  cachedVoice = vs.find(v => v.localService) || vs[0] || speechSynthesis.getVoices().find(v => /^en/i.test(v.lang)) || null;
  return cachedVoice;
}
export function hasNaturalVoice() {
  const v = pickVoice();
  return !!v && /premium|enhanced|natural|neural|google/i.test(v.name);
}
export function say(text, { rate = 1, onBoundary, onEnd } = {}) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) u.voice = v;
  u.lang = 'en-US';
  u.rate = rate;
  if (onBoundary) u.onboundary = onBoundary;
  if (onEnd) u.onend = onEnd;
  speechSynthesis.speak(u);
}

// IndexedDB store for audio recordings.
const DB_NAME = 'speakforge', STORE = 'recordings';
function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function saveRecording(rec) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => res(rec.id);
    tx.onerror = () => rej(tx.error);
  });
}
export async function listRecordings() {
  const db = await openDb();
  return new Promise((res, rej) => {
    const q = db.transaction(STORE).objectStore(STORE).getAll();
    q.onsuccess = () => res(q.result.sort((a, b) => b.ts - a.ts));
    q.onerror = () => rej(q.error);
  });
}
export async function deleteRecording(id) {
  const db = await openDb();
  return new Promise(res => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
  });
}

export async function openCamera() {
  const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 720 }, height: { ideal: 1280 }, facingMode: 'user' }, audio: false });
  const kill = () => s.getTracks().forEach(t => t.stop());
  ACTIVE.add(kill);
  return { stream: s, close: () => { ACTIVE.delete(kill); kill(); } };
}

// Short soft tone used as an audio nudge (bridge cue / speak-up) so you don't have to watch the screen.
let cueCtx = null;
export function cue(freq = 660, ms = 140) {
  try {
    cueCtx = cueCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = cueCtx.createOscillator(), g = cueCtx.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, cueCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, cueCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, cueCtx.currentTime + ms / 1000);
    o.connect(g).connect(cueCtx.destination);
    o.start();
    o.stop(cueCtx.currentTime + ms / 1000 + 0.02);
  } catch { /* audio unavailable */ }
}