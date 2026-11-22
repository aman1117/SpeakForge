// Talks to the optional local SpeakForge server (server.py): local Whisper, deep analysis, local AI via Ollama.
export const LOCAL = { ok: false, whisper: null, ollama: false, models: [], platform: '' };

export async function detectLocal() {
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return LOCAL;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch('api/status', { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok) Object.assign(LOCAL, await r.json(), { ok: true });
  } catch { /* no local server (e.g. GitHub Pages) */ }
  return LOCAL;
}

// Keeps looking for the local server for a little while if the first check failed (e.g. it was still starting).
export function retryDetect(onFound, tries = 6) {
  if (LOCAL.ok || tries <= 0 || !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
  setTimeout(async () => { await detectLocal(); if (LOCAL.ok) onFound(); else retryDetect(onFound, tries - 1); }, 4000);
}

// Polls until the local speech engine has loaded its model, calling onChange after each check.
export function waitUntilReady(onChange) {
  if (!LOCAL.ok || LOCAL.ready) return;
  const tick = async () => {
    try { const r = await fetch('api/status', { cache: 'no-store' }); if (r.ok) Object.assign(LOCAL, await r.json()); } catch { /* keep polling */ }
    onChange();
    if (!LOCAL.ready) setTimeout(tick, 3000);
  };
  setTimeout(tick, 3000);
}

export async function postAudio(path, blob, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`api/${path}${qs ? '?' + qs : ''}`, { method: 'POST', body: blob, headers: { 'Content-Type': blob.type || 'application/octet-stream' } });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// Float32 mono samples -> 16-bit PCM WAV blob.
export function wavBlob(samples, rate) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) { const s = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Blob([buf], { type: 'audio/wav' });
}

// Linear-interpolation resample to 16 kHz (Whisper's native rate).
export function resampleTo16k(input, fromRate) {
  if (fromRate === 16000) return input;
  const ratio = fromRate / 16000, out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio, i0 = Math.floor(x), f = x - i0;
    out[i] = (input[i0] || 0) * (1 - f) + (input[i0 + 1] || 0) * f;
  }
  return out;
}
