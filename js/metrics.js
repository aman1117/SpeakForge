// Pure, DOM-free logic so it can be unit-tested with Node.

export const FILLER_WORDS = ['um', 'umm', 'uh', 'uhh', 'erm', 'er', 'ah', 'hmm', 'mm'];
export const FILLER_PHRASES = ['you know', 'i mean', 'basically', 'actually', 'literally', 'sort of', 'kind of', 'so yeah'];

export function tokenize(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ').split(/\s+/).filter(Boolean);
}

export function countWords(text) {
  return tokenize(text).length;
}

export function wordsPerMinute(words, seconds) {
  if (!seconds || seconds <= 0) return 0;
  return Math.round(words / (seconds / 60));
}

export function countFillers(text) {
  const toks = tokenize(text);
  const joined = ' ' + toks.join(' ') + ' ';
  const result = { total: 0, items: {} };
  for (const w of FILLER_WORDS) {
    const n = toks.filter(t => t === w).length;
    if (n) { result.items[w] = n; result.total += n; }
  }
  for (const p of FILLER_PHRASES) {
    const n = joined.split(' ' + p + ' ').length - 1;
    if (n) { result.items[p] = n; result.total += n; }
  }
  const like = toks.filter(t => t === 'like').length;
  if (like) result.items['like (check)'] = like;
  return result;
}

const LEGIT_DOUBLES = new Set(['very', 'that', 'had', 'so', 'really', 'no', 'bye', 'is', 'ha']);

// Immediate repetitions like "i i want" or "i want i want to" signal restarts / false starts.
export function findRepetitions(text) {
  const toks = tokenize(text);
  const found = [];
  let i = 0;
  while (i < toks.length) {
    let matched = 0;
    for (let n = 3; n >= 1; n--) {
      if (i + 2 * n > toks.length) continue;
      const a = toks.slice(i, i + n).join(' ');
      const b = toks.slice(i + n, i + 2 * n).join(' ');
      if (a === b && !(n === 1 && LEGIT_DOUBLES.has(a))) { matched = n; break; }
    }
    if (matched) { found.push(toks.slice(i, i + matched).join(' ')); i += matched; } else i++;
  }
  return found;
}

export function pauseStats(pausesMs, totalSeconds) {
  const p = pausesMs.filter(x => x >= 250);
  const long = p.filter(x => x >= 2000);
  const mins = totalSeconds > 0 ? totalSeconds / 60 : 1;
  return {
    count: p.length,
    perMin: +(p.length / mins).toFixed(1),
    longCount: long.length,
    longPerMin: +(long.length / mins).toFixed(1),
    longestMs: p.length ? Math.max(...p) : 0,
    medianMs: p.length ? median(p) : 0,
  };
}

// Speech threshold from the room-noise floor, capped so a noisy room or early talking can't make normal speech look like silence.
export function speechThreshold(noiseDb) {
  return Math.min(Math.max(noiseDb + 12, -58), -38);
}

export function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// Word-level similarity (LCS) between target and what speech recognition heard, 0-100.
export function similarity(target, said) {
  const a = tokenize(target), b = tokenize(said);
  if (!a.length) return 0;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const lcs = dp[a.length][b.length];
  return Math.round(100 * (2 * lcs) / (a.length + b.length || 1));
}

export function missedWords(target, said) {
  const s = new Set(tokenize(said));
  return tokenize(target).filter(w => !s.has(w));
}

export function containsPhrase(text, phrase) {
  return (' ' + tokenize(text).join(' ') + ' ').includes(' ' + tokenize(phrase).join(' ') + ' ');
}

export function sentenceLengths(text) {
  return (text || '').split(/[.!?]+/).map(s => countWords(s)).filter(n => n > 0);
}

// Voice activity tracker fed with (dB, timeMs) samples from the mic analyser.
export class VoiceTracker {
  constructor({ thresholdDb = -45, minPauseMs = 250, hangMs = 120 } = {}) {
    this.thresholdDb = thresholdDb;
    this.minPauseMs = minPauseMs;
    this.hangMs = hangMs;
    this.reset();
  }
  reset() {
    this.started = false;
    this.speaking = false;
    this.lastVoiceT = null;
    this.firstVoiceT = null;
    this.silenceStartT = null;
    this.speechMs = 0;
    this.pauses = [];
    this.lastT = null;
    this.voicedDbSum = 0;
    this.voicedFrames = 0;
    this.inZoneFrames = 0;
  }
  update(db, t, zone = null) {
    const voiced = db >= this.thresholdDb;
    const dt = this.lastT == null ? 0 : t - this.lastT;
    this.lastT = t;
    if (voiced) {
      if (!this.started) { this.started = true; this.firstVoiceT = t; }
      if (!this.speaking && this.silenceStartT != null) {
        const gap = t - this.silenceStartT;
        if (gap >= this.minPauseMs) this.pauses.push(Math.round(gap));
      }
      this.speaking = true;
      this.silenceStartT = null;
      this.lastVoiceT = t;
      this.speechMs += dt;
      this.voicedDbSum += db;
      this.voicedFrames++;
      if (zone && db >= zone[0] && db <= zone[1]) this.inZoneFrames++;
    } else if (this.started) {
      if (this.speaking && t - this.lastVoiceT > this.hangMs) {
        this.speaking = false;
        this.silenceStartT = this.lastVoiceT;
      } else if (this.speaking) {
        this.speechMs += dt;
      }
    }
    return this.currentSilenceMs(t);
  }
  currentSilenceMs(t) {
    if (!this.started || this.speaking || this.silenceStartT == null) return 0;
    return t - this.silenceStartT;
  }
  avgVoicedDb() {
    return this.voicedFrames ? this.voicedDbSum / this.voicedFrames : null;
  }
  zonePct() {
    return this.voicedFrames ? Math.round(100 * this.inZoneFrames / this.voicedFrames) : 0;
  }
}

// Counts syllable-like bursts in a dB envelope (for pa-ta-ka diadochokinesis).
export function countBursts(envelope, thresholdDb, minGapFrames = 3) {
  let count = 0, above = false, lastIdx = -Infinity;
  for (let i = 0; i < envelope.length; i++) {
    const v = envelope[i];
    if (!above && v >= thresholdDb && i - lastIdx >= minGapFrames) { count++; above = true; lastIdx = i; }
    else if (above && v < thresholdDb - 3) above = false;
  }
  return count;
}

// Leitner spaced repetition: boxes 0..5, intervals in days.
export const LEITNER_DAYS = [0, 1, 2, 4, 8, 16];
const DAY = 86400000;
export function reviewCard(card, correct, now = Date.now()) {
  const box = correct ? Math.min((card.box || 0) + 1, LEITNER_DAYS.length - 1) : 0;
  return { ...card, box, due: now + LEITNER_DAYS[box] * DAY, reviews: (card.reviews || 0) + 1 };
}
export function dueCards(cards, now = Date.now()) {
  return cards.filter(c => (c.due || 0) <= now);
}

export function levelFromXp(xp) {
  let level = 1, need = 100, rest = xp;
  while (rest >= need) { rest -= need; level++; need = Math.round(need * 1.25); }
  return { level, into: rest, need };
}

export function computeStreak(dayKeys, todayKey) {
  const set = new Set(dayKeys);
  let streak = 0;
  const d = new Date(todayKey + 'T00:00:00');
  if (!set.has(todayKey)) d.setDate(d.getDate() - 1);
  while (set.has(dayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

export function dayKey(date = new Date()) {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function weekNumber(startKey, todayKey) {
  const a = new Date(startKey + 'T00:00:00'), b = new Date(todayKey + 'T00:00:00');
  return Math.max(1, Math.floor((b - a) / (7 * DAY)) + 1);
}

// Turns raw session metrics into short, specific coaching notes.
export function coachNotes(m) {
  const notes = [];
  if (m.wpm && m.wpm < 110) notes.push('Pace is slow (' + m.wpm + ' wpm). Aim for 130-150: use bigger chunks, fewer stops.');
  else if (m.wpm > 185) notes.push('Very fast (' + m.wpm + ' wpm). Slow down to ~150 so every word lands clearly.');
  else if (m.wpm) notes.push('Good pace (' + m.wpm + ' wpm).');
  if (m.longPausesPerMin > 2) notes.push(`${m.longPausesPerMin} long freezes/min. When a word escapes you, BRIDGE: "the thing that..." / "what I mean is..." and keep the sentence alive.`);
  else if (m.longPausesPerMin !== undefined) notes.push('Few long freezes. Nice recovery.');
  if (m.repetitions > 2) notes.push(`${m.repetitions} restarts/repeats detected. Commit to your first sentence frame. Don't rewind; patch forward.`);
  if (m.fillers > 4) notes.push(`${m.fillers} fillers. Replace them with a silent half-second pause.`);
  if (m.loudnessDelta !== undefined && m.loudnessDelta < 3) notes.push('Volume close to your quiet baseline. Project: imagine talking to someone 3 metres away.');
  if (m.maxSentence && m.maxSentence > 30) notes.push('Very long sentences. Try the 10-word-sentence rule to stay clear.');
  return notes;
}

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const lastN = (arr, n) => (arr || []).slice(-n);

export function avgConfidence(confs) {
  const c = (confs || []).filter(x => x > 0);
  return c.length ? Math.round(100 * avg(c)) : null;
}

// Per-minute rates for an arena round (restarts = max of self-reported and detected).
export function roundRates(r) {
  const mins = Math.max((r.speakSec || 0) / 60, 0.25);
  const restarts = Math.max(r.repetitions || 0, r.selfRestarts || 0);
  return { freezesPerMin: (r.freezes || 0) / mins, restartsPerMin: restarts / mins, fillersPerMin: (r.fillers || 0) / mins };
}

// 0-100 score per skill from recent practice data; null = not measured yet.
export function skillScores(S) {
  const rounds = lastN(S.sessions, 6).map(s => s.rounds[s.rounds.length - 1]).filter(r => r && r.speakSec >= 15);
  const rates = rounds.map(roundRates);
  const res = {};
  res['Repair fluency'] = rounds.length ? clamp(100 - 14 * avg(rates.map(r => r.freezesPerMin)) - 10 * avg(rates.map(r => r.restartsPerMin))) : null;
  const nm = lastN(S.naming, 3);
  res['Lexical retrieval'] = nm.length ? clamp((100 - (avg(nm.map(n => n.avgMs || 7000)) - 1000) / 25) * avg(nm.map(n => n.acc)) / 100) : null;
  const reviewed = Object.values(S.srs || {}).filter(c => c.reviews);
  res['Formulaic chunks'] = reviewed.length >= 5 ? clamp(100 * avg(reviewed.map(c => c.box)) / 4) : null;
  const wpms = rounds.map(r => r.wpm).filter(w => w > 0);
  res['Pace'] = wpms.length ? clamp(100 - Math.abs(avg(wpms) - 155) * 1.3) : null;
  res['Pausing (no fillers)'] = rounds.length ? clamp(100 - 12 * avg(rates.map(r => r.fillersPerMin))) : null;
  const art = [];
  const dd = lastN(S.ddk, 3);
  if (dd.length) art.push(clamp(100 * avg(dd.map(d => d.rate)) / 6.5));
  const tw = lastN(S.twisters, 5);
  if (tw.length) art.push(avg(tw.map(t => t.score)));
  const pen = lastN(S.pen, 3);
  if (pen.length) art.push(avg(pen.map(p => p.score)));
  const clar = rounds.map(r => r.clarity).filter(c => c != null);
  if (clar.length) art.push(avg(clar));
  res['Articulation'] = art.length ? clamp(avg(art)) : null;
  const pairs = {};
  (S.pairs || []).forEach(p => { pairs[p.group] = p.score; });
  res['Pronunciation (sounds)'] = Object.keys(pairs).length ? clamp(avg(Object.values(pairs))) : null;
  const zn = lastN(S.zone, 3).map(z => z.pct);
  const arenaZone = rounds.map(r => r.zonePct).filter(z => z != null);
  res['Volume & projection'] = zn.length || arenaZone.length ? clamp(avg([...zn, ...arenaZone])) : null;
  const anx = lastN(S.anxiety, 5).filter(a => a.after != null);
  const rungs = Object.keys(S.exposure || {}).length;
  res['Confidence'] = anx.length || rungs ? clamp((anx.length ? (10 - avg(anx.map(a => a.after))) * 7 : 35) + rungs * 2) : null;
  const sh = lastN(S.shadow, 5).filter(x => x.score != null);
  res['Prosody (shadowing)'] = sh.length ? clamp(avg(sh.map(x => x.score))) : null;
  const structured = (S.sessions || []).filter(s => ['prep', 'creator', 'questions', 'tenWord'].includes(s.mode)).length;
  res['Structure'] = structured ? clamp(structured * 8) : null;
  for (const k of Object.keys(res)) if (res[k] != null) res[k] = Math.round(res[k]);
  return res;
}

export const SKILL_LINKS = {
  'Repair fluency': ['#/speak?mode=noRestart', 'No-Restart challenge'],
  'Lexical retrieval': ['#/words?t=naming', 'Rapid naming'],
  'Formulaic chunks': ['#/phrases', 'Phrase review'],
  'Pace': ['#/speak?mode=quick432', 'Quick 4/3/2'],
  'Pausing (no fillers)': ['#/speak?mode=tenWord', '10-word sentences'],
  'Articulation': ['#/mouth?t=pen', 'Pen-in-mouth reading'],
  'Pronunciation (sounds)': ['#/mouth?t=pairs', 'Minimal pairs'],
  'Volume & projection': ['#/voice?t=zone', 'Volume zone'],
  'Confidence': ['#/voice?t=exposure', 'Exposure ladder'],
  'Prosody (shadowing)': ['#/shadow?t=echo', 'Echo & score shadowing'],
  'Structure': ['#/speak?mode=prep', 'PREP speech'],
};

// Picks today's focus: an untested core skill first (to get a baseline), otherwise the weakest one.
export function focusOfDay(scores) {
  const core = ['Repair fluency', 'Lexical retrieval', 'Volume & projection', 'Articulation', 'Pronunciation (sounds)', 'Formulaic chunks'];
  const untested = core.find(k => scores[k] == null);
  if (untested) return { skill: untested, reason: 'not measured yet. Get your baseline', link: SKILL_LINKS[untested] };
  const [skill, score] = Object.entries(scores).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1])[0];
  return { skill, reason: `your weakest skill right now (${score}/100)`, link: SKILL_LINKS[skill] };
}

export function weeklyReport(sessions, now = Date.now()) {
  const W = 7 * 86400000;
  const pick = (from, to) => (sessions || []).filter(s => s.ts >= from && s.ts < to);
  const sum = list => {
    const rs = list.map(s => s.rounds[s.rounds.length - 1]).filter(r => r && r.speakSec >= 15);
    const rates = rs.map(roundRates);
    const r1 = v => v == null ? null : Math.round(v * 10) / 10;
    return {
      speeches: list.length,
      minutes: Math.round(list.reduce((a, s) => a + s.rounds.reduce((b, r) => b + (r.speakSec || 0), 0), 0) / 60),
      wpm: rs.length ? Math.round(avg(rs.map(r => r.wpm))) : null,
      freezesPerMin: r1(avg(rates.map(r => r.freezesPerMin))),
      restartsPerMin: r1(avg(rates.map(r => r.restartsPerMin))),
    };
  };
  return { thisWeek: sum(pick(now - W, now + 1)), lastWeek: sum(pick(now - 2 * W, now - W)) };
}

// Pulls the first JSON object out of an LLM reply (handles ```json fences and chatter).
export function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{'), end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(body.slice(start, end + 1)); } catch { return null; }
}

// Which minimal-pair groups to drill first, by first language (common L1-transfer difficulties).
export const L1_PRIORITY = {
  Hindi: ['V vs W', 'TH vs T', 'TH vs D', 'Z vs J', 'Short i vs long ee', 'a (cat) vs e (bed)'],
  Punjabi: ['V vs W', 'TH vs T', 'Z vs J', 'S vs SH', 'Short i vs long ee'],
  Gujarati: ['V vs W', 'Z vs J', 'TH vs T', 'S vs SH', 'a (cat) vs e (bed)'],
  Marathi: ['V vs W', 'TH vs T', 'Z vs J', 'a (cat) vs e (bed)', 'Short i vs long ee'],
  Bengali: ['V vs W', 'S vs SH', 'Z vs J', 'TH vs T', 'P vs F'],
  Tamil: ['V vs W', 'TH vs T', 'P vs F', 'S vs SH', 'Z vs J', 'oo (pull) vs ooo (pool)'],
  Telugu: ['V vs W', 'TH vs T', 'Z vs J', 'P vs F', 'a (cat) vs e (bed)'],
  Kannada: ['V vs W', 'TH vs T', 'Z vs J', 'P vs F', 'a (cat) vs e (bed)'],
  Malayalam: ['V vs W', 'TH vs T', 'Z vs J', 'S vs SH', 'P vs F'],
  Other: ['V vs W', 'TH vs T', 'Short i vs long ee'],
};
