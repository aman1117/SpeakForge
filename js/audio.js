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
  constructor(stream) { this.stream = stream; this.chunks = []; this.rec = null; }
  start() {
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
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
      this.rec.onstop = () => res(new Blob(this.chunks, { type: this.rec.mimeType || 'audio/webm' }));
      this.rec.stop();
    });
  }
}

export function speechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Continuous recognition that auto-restarts (Chrome/Edge end sessions after silence).
export class Listener {
  constructor({ onText, lang = 'en-US' } = {}) {
    this.onText = onText || (() => {});
    this.lang = lang;
    this.finalText = '';
    this.interim = '';
    this.active = false;
    this.rec = null;
  }
  start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    this.active = true;
    this.finalText = '';
    this.interim = '';
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
          if (res.isFinal) this.finalText += res[0].transcript.trim() + '. ';
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

let cachedVoice = null;
export function pickVoice() {
  if (cachedVoice) return cachedVoice;
  const vs = speechSynthesis.getVoices();
  cachedVoice = vs.find(v => /en-US/i.test(v.lang) && /natural|aria|jenny|guy|google us/i.test(v.name))
    || vs.find(v => /en-US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
  return cachedVoice;
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
