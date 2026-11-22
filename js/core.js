import { dayKey, levelFromXp, computeStreak } from './metrics.js';
import { Mic, bindMic } from './audio.js';

const KEY = 'speakforge.v1';

export function defaultState() {
  return {
    startDate: dayKey(), xp: 0, days: {}, sessions: [], naming: [], ddk: [], twisters: [], pairs: [], taboo: [],
    category: [], pen: [], zone: [], shadow: [], anxiety: [], volume: { baseline: null }, srs: {}, exposure: {},
    exposureLog: [], partner: [], deep: [], accent: [],
    settings: { l1: 'Hindi', accent: 'american', bridgeMs: 1800, cue: true, camera: false, ritual: true, dailyMinutes: 35, engine: 'auto' },
    ai: { provider: 'none', auto: true, model: '', endpoint: '', key: '', deployment: '', apiVersion: '2024-10-21' },
  };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') {
      const d = defaultState();
      return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) }, ai: { ...d.ai, ...(s.ai || {}) } };
    }
  } catch { /* fall through */ }
  return defaultState();
}

export const S = load();
export function save() { localStorage.setItem(KEY, JSON.stringify(S)); renderXp(); }
export function replaceState(obj) {
  for (const k of Object.keys(S)) delete S[k];
  const d = defaultState();
  Object.assign(S, d, obj, { settings: { ...d.settings, ...(obj.settings || {}) }, ai: { ...d.ai, ...(obj.ai || {}) } });
  save();
}

// Adds a word/phrase to the spaced-repetition deck (used for words you lost mid-speech).
export function addToDeck(phrase, cue, cat = 'Lost word') {
  const p = String(phrase || '').trim();
  if (!p) return false;
  if (!S.srs[p]) S.srs[p] = { cat, phrase: p, cue: cue || 'A word you lost while speaking. Use it in a sentence', box: 0, due: 0 };
  save();
  return true;
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
  const st = streak();
  el.innerHTML = `<b>Level ${l.level}</b><br>${st ? `${st}-day streak` : 'Start your streak today'}
    <div class="bar" title="${l.into} of ${l.need} XP to level ${l.level + 1}"><i style="width:${Math.round(100 * l.into / l.need)}%"></i></div>`;
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
bindMic(mic);
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

const CHART_COLORS = { '#7c5cff': '#f2b544', '#f59e0b': '#ff8a7a', '#ef4444': '#ff8a7a', '#06b6d4': '#7fd1c4', '#22c55e': '#7fd1c4' };

export function lineChart(canvas, series, { yLabel = '' } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 300, h = canvas.clientHeight || 160;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);
  c.clearRect(0, 0, w, h);
  const all = series.flatMap(s => s.values).filter(v => Number.isFinite(v));
  c.fillStyle = '#c4adc7'; c.font = "13px 'Atkinson Hyperlegible Next', sans-serif";
  if (!all.length) { c.fillText('Nothing yet. Your first session draws this line.', 0, h / 2); return; }
  let min = Math.min(...all), max = Math.max(...all);
  if (min === max) { min -= 1; max += 1; }
  const pad = { l: 38, r: 8, t: 30, b: 10 };
  const X = (i, n) => pad.l + (n <= 1 ? 0.5 : i / (n - 1)) * (w - pad.l - pad.r);
  const Y = v => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);
  c.strokeStyle = '#4b2f56'; c.lineWidth = 1;
  for (const v of [min, (min + max) / 2, max]) { c.beginPath(); c.moveTo(pad.l, Y(v)); c.lineTo(w - pad.r, Y(v)); c.stroke(); c.fillStyle = '#8f7896'; c.fillText(+v.toFixed(1), 0, Y(v) + 4); }
  if (yLabel) c.fillText(yLabel, pad.l, 10);
  let lx = pad.l;
  series.forEach(s => {
    const col = CHART_COLORS[s.color] || s.color;
    const vals = s.values;
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.5; c.lineJoin = 'round';
    c.beginPath();
    vals.forEach((v, i) => { const x = X(i, vals.length), y = Y(v); i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.stroke();
    vals.forEach((v, i) => { c.beginPath(); c.arc(X(i, vals.length), Y(v), 3, 0, 7); c.fill(); });
    c.fillRect(lx, 6, 10, 10);
    c.fillStyle = '#f7ede6';
    c.fillText(s.label, lx + 16, 15);
    lx += c.measureText(s.label).width + 40;
  });
}

// Countdown that doubles as a noise-floor measurement window.
export async function countdown(el, secs = 3) {
  for (let i = secs; i > 0; i--) { el.innerHTML = `<div class="big">${i}</div><p class="muted" style="text-align:center">Stay quiet. Measuring room noise…</p>`; await sleep(1000); }
}
