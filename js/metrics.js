// Pure, DOM-free logic so it can be unit-tested with Node.

export const FILLER_WORDS = ['um', 'umm', 'uh', 'uhh', 'erm', 'er', 'ah', 'hmm', 'mm'];
export const FILLER_PHRASES = ['you know', 'i mean', 'basically', 'actually', 'literally', 'sort of', 'kind of', 'so yeah'];

export function tokenize(text) {
  return (text || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'\s-]/g, ' ').split(/\s+/).filter(Boolean);
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

// Turns raw session metrics into short, specific coaching notes (one per problem, most important first).
export function coachNotes(m) {
  const notes = [];
  const mins = Math.max((m.speakSec || 60) / 60, 0.25);
  if (m.longPausesPerMin > 2) notes.push(`${m.longPausesPerMin} long freezes/min. When a word escapes you, BRIDGE: "the thing that..." / "what I mean is..." and keep the sentence alive.`);
  if (m.repetitions > 2) notes.push(`${m.repetitions} restarts. Commit to your first sentence frame. Don't rewind; patch forward.`);
  if (m.fillers / mins > 3) notes.push(`${m.fillers} fillers (${(m.fillers / mins).toFixed(1)}/min). Swap each one for a silent half-second breath: close your lips, pause, continue.`);
  if (m.vaguePer100 > 4) notes.push(`${m.vaguePer100} vague words per 100 (${Object.keys(m.vagueItems || {}).slice(0, 4).join(', ')}). Pick one precise word instead of "very + basic word".`);
  if (m.maxSentence && m.maxSentence > 35) notes.push(`Your longest sentence ran ${m.maxSentence} words. Long chains are where listeners get lost: say the point, stop, then add one reason.`);
  if (m.wpm && m.wpm < 105) notes.push('Pace is slow (' + m.wpm + ' wpm). Aim for 130-150: use ready-made chunks so you build less on the fly.');
  else if (m.wpm > 185) notes.push('Very fast (' + m.wpm + ' wpm). Slow down to ~150 and pause between ideas so every point lands.');
  if (m.loudnessDelta !== undefined && m.loudnessDelta < 3) notes.push('Volume close to your quiet baseline. Project: talk to someone 3 metres away.');
  if (!notes.length) notes.push(m.wpm ? `Clean round at ${m.wpm} wpm. Raise the difficulty: harder topic, less planning time, or a bigger audience.` : 'No speech measured.');
  return notes;
}

// ---------- vocabulary ----------
// Vague, overused words that make speech sound basic. Multi-word entries are matched as phrases.
export const VAGUE = ['very', 'really', 'thing', 'things', 'stuff', 'good', 'bad', 'nice', 'big', 'small', 'a lot', 'lots of', 'get', 'got', 'make', 'do', 'did', 'like', 'kind of', 'sort of', 'basically', 'okay', 'great', 'awesome', 'cool', 'interesting', 'important', 'something', 'somehow', 'whatever', 'etc'];
const VAGUE_STRICT = new Set(['very', 'really', 'thing', 'things', 'stuff', 'good', 'bad', 'nice', 'big', 'kind of', 'sort of', 'basically', 'cool', 'awesome', 'interesting', 'something', 'whatever']);

// Moving-average type-token ratio: lexical diversity that doesn't fall just because you talked longer.
export function mattr(tokens, win = 50) {
  if (!tokens.length) return 0;
  if (tokens.length <= win) return +(new Set(tokens).size / tokens.length).toFixed(2);
  const counts = new Map();
  let types = 0, sum = 0, n = 0;
  const add = (t, d) => { const c = (counts.get(t) || 0) + d; counts.set(t, c); if (d > 0 && c === 1) types++; if (d < 0 && c === 0) types--; };
  for (let i = 0; i < tokens.length; i++) {
    add(tokens[i], 1);
    if (i >= win) add(tokens[i - win], -1);
    if (i >= win - 1) { sum += types / win; n++; }
  }
  return +(sum / n).toFixed(2);
}

export function lexicalProfile(text) {
  const toks = tokenize(text).filter(t => !FILLER_WORDS.includes(t) && !t.endsWith('-'));
  const joined = ' ' + toks.join(' ') + ' ';
  const vague = {};
  let vagueCount = 0;
  for (const v of VAGUE_STRICT) {
    const n = v.includes(' ') ? joined.split(' ' + v + ' ').length - 1 : toks.filter(t => t === v).length;
    if (n) { vague[v] = n; vagueCount += n; }
  }
  const content = toks.filter(t => t.length > 3);
  return {
    words: toks.length,
    diversity: mattr(toks),
    vagueItems: Object.fromEntries(Object.entries(vague).sort((a, b) => b[1] - a[1])),
    vagueCount,
    vaguePer100: toks.length ? +(100 * vagueCount / toks.length).toFixed(1) : 0,
    longWordPct: toks.length ? Math.round(100 * toks.filter(t => t.length >= 7).length / toks.length) : 0,
    topRepeated: Object.entries(content.reduce((a, t) => (a[t] = (a[t] || 0) + 1, a), {})).filter(([t, n]) => n >= 4 && !STOPWORDS.has(t)).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, n]) => `${t} ×${n}`),
  };
}
const STOPWORDS = new Set('that this they them then there their what when where which with have from about would could should just also because were been into your more some like know think going want really very thing things people'.split(' '));

// ---------- mazes: false starts, repetitions and self-corrections (the "restart" problem) ----------
const REVISION = ['i mean', 'sorry', 'no wait', 'let me rephrase', 'what i want to say', 'what i wanted to say', 'or rather', 'let me start again'];
export function mazes(text) {
  const toks = tokenize(text);
  const joined = ' ' + toks.join(' ') + ' ';
  const fragments = toks.filter(t => /^[a-z']+-$/.test(t)).length;
  const reps = findRepetitions(text).length;
  const revisions = REVISION.reduce((a, r) => a + joined.split(' ' + r + ' ').length - 1, 0);
  return { total: fragments + reps + revisions, fragments, repetitions: reps, revisions };
}

// ---------- explanation structure ----------
export const SIGNPOSTS = ['first', 'firstly', 'second', 'secondly', 'third', 'finally', 'the main point', 'the key point', 'the point is', 'in short', 'to sum up', 'bottom line', 'the reason is', 'because', 'which means', 'so the result', 'for example', 'for instance', 'on the other hand', 'however', 'in other words', 'that means', 'the problem is', 'the answer is', 'there are two', 'there are three'];
const EXAMPLE = ['for example', 'for instance', 'like when', 'say you', 'let s say', "let's say", 'imagine', 'picture this', 'such as', 'last week', 'yesterday', 'one time'];
const ANALOGY = ["it's like", 'its like', 'it is like', 'is like a', 'basically like', 'think of it as', 'think of it like', 'similar to', 'kind of like a', 'just like', 'the same way', 'imagine a', 'is basically a'];
const RECAP = ['so in short', 'in short', 'to sum up', 'bottom line', 'so the point is', 'so basically', 'that s why', "that's why", 'so overall', 'in summary', 'to wrap up', 'so the answer is'];

export function sentencesOf(text) {
  return (text || '').split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => countWords(s) > 0);
}

export function explainProfile(text) {
  const sents = sentencesOf(text);
  const lens = sents.map(countWords);
  const norm = ' ' + tokenize(text).join(' ') + ' ';
  const has = list => list.filter(p => norm.includes(' ' + tokenize(p).join(' ') + ' '));
  const signposts = has(SIGNPOSTS);
  const andChains = sents.filter(s => (' ' + tokenize(s).join(' ') + ' ').split(' and ').length - 1 >= 3).length;
  const last = sents.slice(-2).join(' ');
  const recapEnd = has(RECAP).some(p => (' ' + tokenize(last).join(' ') + ' ').includes(' ' + tokenize(p).join(' ') + ' '));
  return {
    sentences: sents.length,
    avgSentence: lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 0,
    longSentences: lens.filter(n => n > 30).length,
    firstSentence: lens[0] || 0,
    signposts, example: has(EXAMPLE).length > 0, analogy: has(ANALOGY).length > 0, recap: recapEnd, andChains,
  };
}

// Offline 0-10 explanation score from structure signals (the AI rubric replaces it when connected).
export function explainScore(p, mz = { total: 0 }, words = 100) {
  let s = 0;
  if (p.firstSentence && p.firstSentence <= 22) s += 2; else if (p.firstSentence <= 32) s += 1;
  s += Math.min(2, p.signposts.length >= 3 ? 2 : p.signposts.length >= 1 ? 1 : 0);
  if (p.example) s += 2;
  if (p.analogy) s += 1;
  if (p.recap) s += 1;
  const mazeRate = words ? 100 * mz.total / words : 0;
  s += mazeRate < 2 ? 2 : mazeRate < 5 ? 1 : 0;
  s -= Math.min(2, p.longSentences + Math.floor(p.andChains / 2));
  return Math.max(0, Math.min(10, s));
}

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const lastN = (arr, n) => (arr || []).slice(-n);

export function avgConfidence(confs) {
  const c = (confs || []).filter(x => x > 0);
  return c.length ? Math.round(100 * avg(c)) : null;
}

// Per-minute rates for a round (restarts = max of self-reported and detected).
export function roundRates(r) {
  const mins = Math.max((r.speakSec || 0) / 60, 0.25);
  const restarts = Math.max(r.repetitions || 0, r.selfRestarts || 0);
  return { freezesPerMin: (r.freezes || 0) / mins, restartsPerMin: restarts / mins, fillersPerMin: (r.fillers || 0) / mins };
}

// 0-100 score per skill from recent practice data; null = not measured yet.
// Skills are grouped by the five problems SpeakForge is built around.
export function skillScores(S) {
  const rounds = lastN(S.sessions, 8).map(s => s.rounds[s.rounds.length - 1]).filter(r => r && r.speakSec >= 15);
  const real = lastN(S.reallife, 3).map(x => x.metrics).filter(Boolean);
  const rates = rounds.map(roundRates);
  const res = {};
  res['Repair fluency'] = rounds.length ? clamp(100 - 14 * avg(rates.map(r => r.freezesPerMin)) - 10 * avg(rates.map(r => r.restartsPerMin))) : null;
  const nm = lastN(S.naming, 3);
  res['Word retrieval'] = nm.length ? clamp((100 - (avg(nm.map(n => n.avgMs || 7000)) - 1200) / 25) * avg(nm.map(n => n.acc)) / 100) : null;
  const vg = [...rounds.map(r => r.vaguePer100), ...real.map(m => m.vaguePer100)].filter(v => v != null);
  const up = lastN(S.upgrades, 10);
  res['Precise vocabulary'] = vg.length || up.length ? clamp(avg([...vg.map(v => 100 - v * 9), ...up.map(u => u.score)])) : null;
  const fpm = [...rates.map(r => r.fillersPerMin), ...real.map(m => m.fillersPerMin)].filter(v => v != null);
  const aw = lastN(S.awareness, 3).map(a => a.accuracy);
  res['Filler control'] = fpm.length ? clamp(100 - 11 * avg(fpm) + (aw.length ? (avg(aw) - 50) / 10 : 0)) : null;
  const ex = lastN(S.explains, 6).map(e => e.score);
  const exSpeak = rounds.map(r => r.explainScore).filter(v => v != null);
  res['Clear explanations'] = ex.length || exSpeak.length ? clamp(10 * avg([...ex, ...exSpeak])) : null;
  const reviewed = Object.values(S.srs || {}).filter(c => c.reviews);
  res['Ready-made chunks'] = reviewed.length >= 5 ? clamp(100 * avg(reviewed.map(c => c.box)) / 4) : null;
  const wpms = rounds.map(r => r.wpm).filter(w => w > 0);
  res['Pace'] = wpms.length ? clamp(100 - Math.max(0, Math.abs(avg(wpms) - 150) - 10) * 1.4) : null;
  const art = [];
  for (const [k, n] of [['twisters', 5], ['pen', 3]]) { const v = lastN(S[k], n).map(x => x.score).filter(x => x != null); if (v.length) art.push(avg(v)); }
  const pairs = {};
  (S.pairs || []).forEach(p => { pairs[p.group] = p.score; });
  if (Object.keys(pairs).length) art.push(avg(Object.values(pairs)));
  const clar = rounds.map(r => r.clarity).filter(c => c != null);
  if (clar.length) art.push(avg(clar));
  res['Articulation'] = art.length ? clamp(avg(art)) : null;
  const pro = [...lastN(S.shadow, 5).map(x => x.score), ...lastN(S.prosody, 5).map(x => x.score)].filter(x => x != null);
  res['Rhythm and pausing'] = pro.length ? clamp(avg(pro)) : null;
  const zn = lastN(S.zone, 3).map(z => z.pct);
  const arenaZone = rounds.map(r => r.zonePct).filter(z => z != null);
  res['Volume'] = zn.length || arenaZone.length ? clamp(avg([...zn, ...arenaZone])) : null;
  const ex2 = lastN(S.exposures, 5);
  const anx = lastN(S.anxiety, 5).filter(a => a.after != null);
  const maxLevel = Math.max(0, ...(S.exposures || []).filter(e => e.after <= 40).map(e => e.level));
  res['Calm on stage'] = ex2.length || anx.length ? clamp(avg([...ex2.map(e => 100 - e.after), ...anx.map(a => 100 - a.after * 10)]) * 0.7 + maxLevel * 5) : null;
  for (const k of Object.keys(res)) if (res[k] != null) res[k] = Math.round(res[k]);
  return res;
}

export const SKILL_GROUPS = {
  'Losing words': ['Repair fluency', 'Word retrieval', 'Ready-made chunks'],
  'Basic words': ['Precise vocabulary'],
  'Fillers': ['Filler control'],
  'Confusing explanations': ['Clear explanations', 'Pace'],
  'Nerves': ['Calm on stage', 'Volume'],
  'Clear voice': ['Articulation', 'Rhythm and pausing'],
};

export const SKILL_LINKS = {
  'Repair fluency': ['#/speak?mode=noRestart', 'No-Restart challenge'],
  'Word retrieval': ['#/words?t=naming', 'Rapid word retrieval'],
  'Ready-made chunks': ['#/phrases', 'Phrase review'],
  'Precise vocabulary': ['#/words?t=upgrade', 'Word upgrade'],
  'Filler control': ['#/fillers?t=live', 'Filler-free minute'],
  'Clear explanations': ['#/explain', 'Explain gym'],
  'Pace': ['#/speak?mode=quick432', 'Quick 4/3/2'],
  'Articulation': ['#/mouth?t=pen', 'Pebble drill'],
  'Rhythm and pausing': ['#/mouth?t=groups', 'Thought groups'],
  'Volume': ['#/calm?t=zone', 'Volume zone'],
  'Calm on stage': ['#/calm?t=audience', 'Virtual audience'],
};

// Picks today's focus: an untested core skill first (to get a baseline), otherwise the weakest one.
export function focusOfDay(scores) {
  const core = ['Clear explanations', 'Filler control', 'Repair fluency', 'Precise vocabulary', 'Calm on stage', 'Word retrieval'];
  const untested = core.find(k => k in scores && scores[k] == null);
  if (untested) return { skill: untested, reason: 'not measured yet. Get your baseline', link: SKILL_LINKS[untested] };
  const measured = Object.entries(scores).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1]);
  if (!measured.length) return { skill: 'Clear explanations', reason: 'start here', link: SKILL_LINKS['Clear explanations'] };
  const [skill, score] = measured[0];
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
      fillersPerMin: r1(avg(rates.map(r => r.fillersPerMin))),
      vaguePer100: r1(avg(rs.map(r => r.vaguePer100).filter(v => v != null))),
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

// One analysis for any transcript: pace, fillers, mazes, vocabulary and explanation structure.
export function speechReport(text, speakSec) {
  const words = countWords(text);
  const fill = countFillers(text);
  const mz = mazes(text);
  const lex = lexicalProfile(text);
  const ex = explainProfile(text);
  const mins = Math.max((speakSec || 0) / 60, 0.25);
  return {
    words, wpm: wordsPerMinute(words, speakSec), fillers: fill.total, fillerItems: fill.items, fillersPerMin: +(fill.total / mins).toFixed(1),
    mazes: mz, mazesPerMin: +(mz.total / mins).toFixed(1), lex, vaguePer100: lex.vaguePer100, diversity: lex.diversity, explain: ex,
    explainScore: explainScore(ex, mz, words),
  };
}

// Words to highlight in a transcript: fillers, restarts and vague words.
export function markup(text) {
  const words = (text || '').split(/[ \t]+/).filter(Boolean);
  const norm = words.map(w => tokenize(w)[0] || '');
  const mark = new Array(words.length).fill('');
  for (let i = 0; i < norm.length; i++) {
    if (FILLER_WORDS.includes(norm[i])) mark[i] = 'fill';
    else if (/^[a-z']+-$/.test(norm[i])) mark[i] = 'rep';
    else if (VAGUE_STRICT.has(norm[i])) mark[i] = 'vague';
    for (let n = 3; n >= 1; n--) {
      if (i + 2 * n > norm.length) continue;
      const a = norm.slice(i, i + n).join(' '), b = norm.slice(i + n, i + 2 * n).join(' ');
      if (a && a === b && !(n === 1 && LEGIT_DOUBLES.has(a))) { for (let k = i; k < i + n; k++) mark[k] = 'rep'; break; }
    }
  }
  return words.map((w, i) => [w, mark[i]]);
}

// ---------- thought groups: pause at boundaries, stress one word ----------
export function parseGroups(text) {
  const words = [];
  text.split('/').forEach((g, gi, arr) => {
    const toks = g.trim().split(/\s+/).filter(Boolean);
    toks.forEach((w, i) => words.push({ w, key: tokenize(w)[0] || '', stress: /[A-Z]{2,}/.test(w.replace(/[^A-Za-z]/g, '')) && w.replace(/[^A-Za-z]/g, '') === w.replace(/[^A-Za-z]/g, '').toUpperCase(), boundary: i === toks.length - 1 && gi < arr.length - 1 }));
  });
  return words.filter(w => w.key);
}

// Aligns spoken words (with timings) to the passage and checks where the pauses fell.
export function pauseFit(passage, spoken, minGap = 0.18) {
  const P = parseGroups(passage);
  const map = new Array(P.length).fill(-1);
  let j = 0;
  for (let i = 0; i < P.length && j < spoken.length; i++) {
    for (let k = j; k < Math.min(spoken.length, j + 4); k++) if ((tokenize(spoken[k].w)[0] || '') === P[i].key) { map[i] = k; j = k + 1; break; }
  }
  let atBoundary = 0, boundaries = 0, inside = 0, pairs = 0;
  for (let i = 0; i < P.length - 1; i++) {
    if (map[i] < 0 || map[i + 1] < 0) continue;
    pairs++;
    const gap = spoken[map[i + 1]].s - spoken[map[i]].e;
    if (P[i].boundary) { boundaries++; if (gap >= minGap) atBoundary++; } else if (gap >= 0.3) inside++;
  }
  const recall = boundaries ? atBoundary / boundaries : 0;
  const precision = atBoundary + inside ? atBoundary / (atBoundary + inside) : 0;
  return { score: Math.round(100 * (recall + precision) / 2), atBoundary, boundaries, inside, matched: map.filter(x => x >= 0).length, total: P.length };
}

