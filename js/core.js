import { dayKey, levelFromXp, computeStreak } from './metrics.js';
import { Mic } from './audio.js';

const KEY = 'speakforge.v1';

export function defaultState() {
  return {
    startDate: dayKey(), xp: 0, days: {}, sessions: [], naming: [], ddk: [], twisters: [], pairs: [], taboo: [],
    category: [], pen: [], zone: [], shadow: [], anxiety: [], volume: { baseline: null }, srs: {}, exposure: {},
  };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') return { ...defaultState(), ...s };
  } catch { /* fall through */ }
  return defaultState();
}

export const S = load();
export function save() { localStorage.setItem(KEY, JSON.stringify(S)); renderXp(); }
export function replaceState(obj) {
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, defaultState(), obj);
  save();
}

export function logActivity(kind, xp, data = {}) {
  const k = dayKey();
  S.days[k] = S.days[k] || { acts: [] };
  S.days[k].acts.push({ kind, t: Date.now(), ...data });
  S.xp += xp;
  save();
  toast(`+${xp} XP · ${kind}`);
}

export function todayCount(kind) {
  return (S.days[dayKey()]?.acts || []).filter(a => a.kind === kind).length;
}

export function streak() {
  return computeStreak(Object.keys(S.days).filter(k => S.days[k].acts?.length), dayKey());
}

export function renderXp() {
  const el = document.getElementById('xpbar');
  if (!el) return;
  const l = levelFromXp(S.xp);
  el.innerHTML = `Level <b>${l.level}</b> · ${S.xp} XP · 🔥 ${streak()} day streak
    <div class="bar"><i style="width:${Math.round(100 * l.into / l.need)}%"></i></div>`;
}

// Returns a detached dummy element when not found so timers from a screen the user already left fail silently.
export const $ = (s, r = document) => r.querySelector(s) || document.createElement('div');
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

export const mic = new Mic();
export async function ensureMic() {
  try { await mic.start(); return true; } catch (e) {
    warn('Microphone blocked or unavailable. Allow mic access in the browser address bar and reload. (' + e.message + ')');
    return false;
  }
}

export function warn(msg) {
  const w = document.getElementById('warn');
  if (!w) return;
  w.textContent = msg;
  w.classList.toggle('hidden', !msg);
}

// Maps dBFS to 0-100% for meter display.
export const dbToPct = db => Math.max(0, Math.min(100, ((db + 70) / 60) * 100));

export function meterHtml(id, zone) {
  const z = zone ? `<div class="zone" style="left:${dbToPct(zone[0])}%;width:${dbToPct(zone[1]) - dbToPct(zone[0])}%"></div>` : '';
  return `<div class="meter" id="${id}">${z}<i style="width:0%"></i></div>`;
}
export function setMeter(id, db) {
  const i = document.querySelector(`#${id} i`);
  if (i) i.style.width = dbToPct(db) + '%';
}

export function lineChart(canvas, series, { yLabel = '' } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 300, h = canvas.clientHeight || 160;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);
  c.clearRect(0, 0, w, h);
  const all = series.flatMap(s => s.values).filter(v => Number.isFinite(v));
  c.fillStyle = '#9aa3b5'; c.font = '11px system-ui';
  if (!all.length) { c.fillText('No data yet. Do a session!', 10, h / 2); return; }
  let min = Math.min(...all), max = Math.max(...all);
  if (min === max) { min -= 1; max += 1; }
  const pad = { l: 34, r: 8, t: 14, b: 16 };
  const X = (i, n) => pad.l + (n <= 1 ? 0.5 : i / (n - 1)) * (w - pad.l - pad.r);
  const Y = v => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);
  c.strokeStyle = '#2a2f3d';
  for (const v of [min, (min + max) / 2, max]) { c.beginPath(); c.moveTo(pad.l, Y(v)); c.lineTo(w - pad.r, Y(v)); c.stroke(); c.fillText(+v.toFixed(1), 2, Y(v) + 4); }
  if (yLabel) c.fillText(yLabel, pad.l, 10);
  series.forEach((s, si) => {
    const vals = s.values;
    c.strokeStyle = s.color; c.fillStyle = s.color; c.lineWidth = 2;
    c.beginPath();
    vals.forEach((v, i) => { const x = X(i, vals.length), y = Y(v); i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.stroke();
    vals.forEach((v, i) => { c.beginPath(); c.arc(X(i, vals.length), Y(v), 2.5, 0, 7); c.fill(); });
    c.fillText(s.label, w - pad.r - 120, 12 + si * 12);
  });
}

// Countdown that doubles as a noise-floor measurement window.
export async function countdown(el, secs = 3) {
  for (let i = secs; i > 0; i--) { el.innerHTML = `<div class="big">${i}</div><p class="muted" style="text-align:center">Stay quiet. Measuring room noise…</p>`; await sleep(1000); }
}
