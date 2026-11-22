// AI coach. Runs on this computer through Ollama (default: Gemma 4) or on OpenAI / Azure OpenAI / any OpenAI-compatible server.
// Every coaching call asks for JSON that matches a schema, so the UI never has to guess what came back.
import { extractJson } from './metrics.js';
import { LOCAL } from './local.js';

export const PROVIDERS = {
  none: 'Off',
  local: 'This computer (Ollama through SpeakForge, fully private)',
  openai: 'OpenAI (api.openai.com)',
  azure: 'Azure OpenAI',
  ollama: 'Ollama / OpenAI-compatible (custom URL)',
};

export function aiReady(cfg) {
  if (!cfg || !cfg.provider || cfg.provider === 'none') return false;
  if (cfg.provider === 'local') return LOCAL.ok && LOCAL.ollama;
  if (cfg.provider === 'openai') return !!cfg.key;
  if (cfg.provider === 'azure') return !!(cfg.key && cfg.endpoint && cfg.deployment);
  return true;
}

export function requestFor(cfg, messages, schema) {
  const body = { messages, temperature: 0.4 };
  const rf = schema ? { response_format: { type: 'json_schema', json_schema: { name: 'reply', schema, strict: false } } } : {};
  if (cfg.provider === 'local') return { url: 'api/chat', headers: { 'Content-Type': 'application/json' }, body: { ...body, model: cfg.model || '', ...(schema ? { schema } : {}) } };
  if (cfg.provider === 'openai') {
    return { url: 'https://api.openai.com/v1/chat/completions', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` }, body: { ...body, model: cfg.model || 'gpt-4o-mini', ...rf } };
  }
  if (cfg.provider === 'azure') {
    const base = cfg.endpoint.replace(/\/+$/, '');
    return { url: `${base}/openai/deployments/${encodeURIComponent(cfg.deployment)}/chat/completions?api-version=${cfg.apiVersion || '2024-10-21'}`, headers: { 'Content-Type': 'application/json', 'api-key': cfg.key }, body: { ...body, ...rf } };
  }
  const base = (cfg.endpoint || 'http://localhost:11434').replace(/\/+$/, '').replace(/\/v1$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
  return { url: `${base}/v1/chat/completions`, headers, body: { ...body, model: cfg.model || 'gemma4:26b', ...rf } };
}

export async function chat(cfg, messages, { timeoutMs = cfg && cfg.provider === 'local' ? 300000 : 90000, schema } = {}) {
  const req = requestFor(cfg, messages, schema);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body), signal: ctrl.signal });
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    return j.choices?.[0]?.message?.content || '';
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('AI request timed out');
    if (e instanceof TypeError) throw new Error('Could not reach the AI server (network/CORS). For Ollama, start it with OLLAMA_ORIGINS=* set.');
    throw e;
  } finally { clearTimeout(t); }
}

// Chat that must return an object; falls back to pulling JSON out of free text for servers without schema support.
export async function chatJson(cfg, messages, schema, opts = {}) {
  const text = await chat(cfg, messages, { ...opts, schema });
  const j = extractJson(text);
  if (!j) throw new Error('The AI did not return valid JSON. Try again or switch model in Settings.');
  return j;
}

const str = { type: 'string' };
const arr = items => ({ type: 'array', items });
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required });

export function learnerProfile(settings = {}) {
  const accent = settings.accent === 'neutral' ? 'clear, neutral international English' : 'confident American English (like the YouTuber Theo Browne)';
  return `The learner is an Indian software engineer (first language: ${settings.l1 || 'an Indian language'}). Goal: ${accent} and strong command of spoken English within 6 months. Their five problems:
1) they forget a word mid-sentence, freeze and restart the sentence;
2) they use basic, vague words (very good, thing, stuff, big);
3) they use many fillers (um, uh, basically, like);
4) their explanations get confusing: they don't lead with the point, add tangents, then add more words that confuse further;
5) they get nervous speaking in front of groups.`;
}

const SPOKEN = 'The text is a speech-recognition transcript of SPOKEN English: ignore punctuation and capitalisation, never correct spelling, and treat [Q1: ...] markers as the questions they answered.';

// ---------- feedback after a speech ----------
export const FEEDBACK_SCHEMA = obj({
  heard_point: str,
  strength: str,
  corrections: arr(obj({ original: str, better: str, why: str })),
  upgrades: arr(obj({ said: str, better: str })),
  lost_words: arr(obj({ word: str, meaning: str, example: str })),
  confusing: obj({ quote: str, why: str }, ['quote', 'why']),
  rewrite: str,
  phrases: arr(str),
  clarity: { type: 'integer' },
  focus: str,
});

export function feedbackMessages(topic, transcript, m, settings) {
  return [
    { role: 'system', content: `You are a warm, precise English speaking coach in the style of the best explainers (Feynman, Patrick Winston). ${learnerProfile(settings)} ${SPOKEN} Reply ONLY with JSON.` },
    { role: 'user', content: `Topic: "${topic}". Measured: ${m.wpm} wpm, ${m.freezes} freezes (>${(settings?.bridgeMs || 1800) / 1000}s silence), ${Math.max(m.repetitions || 0, m.selfRestarts || 0)} restarts, ${m.fillers} fillers, ${m.vaguePer100 ?? '?'} vague words per 100.
Transcript: """${transcript}"""

Return JSON with:
- heard_point: in one sentence, the main point a listener would take away. If it is unclear, say "Unclear: ..." and what they probably meant.
- strength: one specific thing they did well.
- corrections: real grammar/word-choice mistakes only (max 5): original, better, why (short).
- upgrades: up to 5 vague/basic phrases they actually said, each with a precise, natural replacement (not fancy for the sake of it).
- lost_words: words they seemed to search for, circled around, or would have made a sentence clearer (max 4) with meaning + example.
- confusing: the single most confusing moment (quote their words) and why a listener would get lost. Empty strings if none.
- rewrite: how a clear, fluent speaker would SAY the same ideas: point first, short sentences, one example, no fillers. Keep their ideas and roughly their length.
- phrases: 3 reusable chunks from the rewrite.
- clarity: 0-10, how easy it was to follow (structure, point first, no tangents).
- focus: ONE concrete thing to do in the very next attempt (an instruction, max 15 words).` },
  ];
}

export function parseFeedback(j) {
  if (typeof j === 'string') j = extractJson(j) || { rewrite: j };
  const a = (k, n) => Array.isArray(j[k]) ? j[k].slice(0, n) : [];
  return {
    heard_point: j.heard_point || '', strength: j.strength || '', focus: j.focus || '', rewrite: j.rewrite || '',
    corrections: a('corrections', 6).filter(c => c && c.original), upgrades: a('upgrades', 6).filter(u => u && u.said && u.better),
    lost_words: a('lost_words', 5).filter(w => w && w.word), phrases: a('phrases', 5).filter(Boolean),
    confusing: j.confusing && j.confusing.quote ? j.confusing : null, clarity: Number.isFinite(+j.clarity) ? +j.clarity : null,
  };
}

// ---------- explanation rubric ----------
export const EXPLAIN_SCHEMA = obj({
  heard_point: str,
  scores: obj({ point_first: { type: 'integer' }, structure: { type: 'integer' }, concrete: { type: 'integer' }, plain_words: { type: 'integer' }, focus: { type: 'integer' } }),
  confusing: obj({ quote: str, why: str }, ['quote', 'why']),
  listener_question: str,
  better_outline: arr(str),
  model_answer: str,
  one_fix: str,
});

export function explainMessages(prompt, frame, transcript, settings) {
  return [
    { role: 'system', content: `You are an expert communication coach who trains people to explain clearly, using the Pyramid Principle (answer first), Patrick Winston's "How to Speak", Feynman-style plain explanation and the curse-of-knowledge idea from "Made to Stick". ${learnerProfile(settings)} ${SPOKEN} Be honest and specific; don't inflate scores. Reply ONLY with JSON.` },
    { role: 'user', content: `Task: "${prompt}". Requested structure: ${frame.name}: ${frame.parts.join(' -> ')}.
Their spoken answer: """${transcript}"""

Return JSON:
- heard_point: the main point a listener actually took away, in one sentence (if none, "Unclear: ...").
- scores (each 0-2): point_first (answered/defined within the first 1-2 sentences), structure (clear parts, signposts, no backtracking), concrete (a specific example or analogy), plain_words (no unexplained jargon, precise rather than vague words), focus (no tangents or rambling, ended cleanly).
- confusing: the moment a listener would get lost (quote) and why. Empty strings if none.
- listener_question: the one question a genuinely confused 12-year-old/new colleague would ask next.
- better_outline: 3-5 short bullet lines for a better answer in the requested structure (keywords, not full sentences).
- model_answer: a spoken model answer, 60-110 words, point first, short sentences.
- one_fix: one concrete instruction for their next attempt (max 15 words).` },
  ];
}

export function parseExplain(j) {
  const s = j.scores || {};
  const k = ['point_first', 'structure', 'concrete', 'plain_words', 'focus'];
  const scores = Object.fromEntries(k.map(x => [x, Math.max(0, Math.min(2, Math.round(+s[x] || 0)))]));
  return {
    heard_point: j.heard_point || '', scores, total: k.reduce((a, x) => a + scores[x], 0),
    confusing: j.confusing && j.confusing.quote ? j.confusing : null, listener_question: j.listener_question || '',
    better_outline: Array.isArray(j.better_outline) ? j.better_outline.slice(0, 6) : [], model_answer: j.model_answer || '', one_fix: j.one_fix || '',
  };
}

// ---------- "say it better": precision rephrasing ----------
export const BETTER_SCHEMA = obj({ score: { type: 'integer' }, verdict: str, best: str });
export function betterMessages(vague, said) {
  return [
    { role: 'system', content: `You judge whether a learner replaced vague English with precise, natural wording. ${SPOKEN} Reply ONLY with JSON.` },
    { role: 'user', content: `Vague original: "${vague}"\nLearner said: "${said}"\nReturn JSON: score 0-100 (precision and naturalness, not fanciness; 100 = specific and natural), verdict (one short sentence of feedback), best (one excellent natural version, max 20 words).` },
  ];
}

// ---------- real-life recording review ----------
export const REAL_SCHEMA = obj({
  summary: str,
  wins: arr(str),
  upgrades: arr(obj({ said: str, better: str })),
  unclear_moments: arr(obj({ quote: str, better: str })),
  lost_words: arr(obj({ word: str, meaning: str, example: str })),
  patterns: arr(str),
  focus_this_week: str,
});
export function realMessages(turns, settings) {
  return [
    { role: 'system', content: `You are a speaking coach reviewing a real recording from the learner's day (meetings, calls, conversations). ${learnerProfile(settings)} ${SPOKEN} Only the learner's turns are given, with what others said shortened for context. Reply ONLY with JSON.` },
    { role: 'user', content: `${turns}

Return JSON:
- summary: two sentences on how they came across (clarity, confidence) in this real conversation.
- wins: 2-3 specific things that went well (quote when possible).
- upgrades: up to 6 vague/basic phrases they said, with precise natural replacements.
- unclear_moments: up to 3 moments where their explanation got confusing (quote) and a clearer way to say it (point first, short).
- lost_words: up to 4 words they seemed to search for or should have used.
- patterns: up to 3 recurring habits (e.g. "starts answers with 'so basically'", "explains context before the point").
- focus_this_week: one concrete habit to practise this week.` },
  ];
}

// ---------- conversation partner ----------
export const PARTNER_SCHEMA = obj({ reply: str, correction: str, better: str });
export function partnerSystem(settings, scenario) {
  const confused = /confused listener/i.test(scenario);
  return `You are a friendly conversation partner and English coach. ${learnerProfile(settings)}
Scenario: ${scenario}. ${confused ? 'Act as a smart listener who knows nothing about the topic. When something is unclear, jargon is unexplained, or the point is buried, say so honestly ("Wait, I lost you at...", "What does X mean?", "So what\'s the main point?"). When it is clear, say what you understood and ask a deeper follow-up.' : 'Speak naturally like a native speaker.'} Short turns (max 35 words). Ask ONE question at a time and follow up on what they say.
The learner's turns come from speech recognition; ignore punctuation. Reply ONLY with JSON:
{"reply":"your spoken reply ending with a question","correction":"the most important mistake or vague word in their last turn, or empty","better":"a clearer, more natural way to say their last turn, or empty"}`;
}

export function parsePartner(j) {
  if (typeof j === 'string') j = extractJson(j) || { reply: j.trim() };
  return { reply: j.reply || '', correction: j.correction || '', better: j.better || '' };
}

export const SCENARIOS = [
  'Confused listener: explain your current project to a smart outsider',
  'Job interview for a senior software engineer role',
  'Explaining a production incident to your manager',
  'Casual chat with a new colleague at a tech meetup',
  'Podcast interview about your journey as a developer',
  'Disagreeing politely in a design review',
  'Small talk at a wedding with someone you just met',
  'Debating whether AI will replace programmers',
];
