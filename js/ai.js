// Optional AI coach. Works with OpenAI, Azure OpenAI, or any OpenAI-compatible server (e.g. free local Ollama).
import { extractJson } from './metrics.js';

export const PROVIDERS = {
  none: 'Off',
  openai: 'OpenAI (api.openai.com)',
  azure: 'Azure OpenAI',
  ollama: 'Ollama / OpenAI-compatible (local or custom URL)',
};

export function aiReady(cfg) {
  if (!cfg || !cfg.provider || cfg.provider === 'none') return false;
  if (cfg.provider === 'openai') return !!cfg.key;
  if (cfg.provider === 'azure') return !!(cfg.key && cfg.endpoint && cfg.deployment);
  return true;
}

export function requestFor(cfg, messages) {
  const body = { messages, temperature: 0.4 };
  if (cfg.provider === 'openai') {
    return { url: 'https://api.openai.com/v1/chat/completions', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` }, body: { ...body, model: cfg.model || 'gpt-4o-mini' } };
  }
  if (cfg.provider === 'azure') {
    const base = cfg.endpoint.replace(/\/+$/, '');
    return { url: `${base}/openai/deployments/${encodeURIComponent(cfg.deployment)}/chat/completions?api-version=${cfg.apiVersion || '2024-10-21'}`, headers: { 'Content-Type': 'application/json', 'api-key': cfg.key }, body };
  }
  const base = (cfg.endpoint || 'http://localhost:11434').replace(/\/+$/, '').replace(/\/v1$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
  return { url: `${base}/v1/chat/completions`, headers, body: { ...body, model: cfg.model || 'llama3.1' } };
}

export async function chat(cfg, messages, { timeoutMs = 60000 } = {}) {
  const req = requestFor(cfg, messages);
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

function learnerProfile(settings = {}) {
  const accent = settings.accent === 'neutral' ? 'clear, neutral international English' : 'confident American English (like the YouTuber Theo Browne)';
  return `The learner is an Indian software engineer whose first language is ${settings.l1 || 'an Indian language'}. Goal: ${accent}, fluent impromptu speaking, Instagram content creation. Their main problem: they forget a word mid-sentence and restart the sentence.`;
}

export function feedbackMessages(topic, transcript, m, settings) {
  return [
    { role: 'system', content: `You are a warm, precise English speaking coach. ${learnerProfile(settings)} The text you receive is a speech-recognition transcript of SPOKEN English, so ignore punctuation and capitalisation. Reply ONLY with JSON.` },
    { role: 'user', content: `Topic: "${topic}". Metrics: ${m.wpm} wpm, ${m.freezes} freezes (>${(settings?.bridgeMs || 1800) / 1000}s silence), ${Math.max(m.repetitions, m.selfRestarts || 0)} restarts, ${m.fillers} fillers.
Transcript: """${transcript}"""

Return JSON exactly like:
{"corrections":[{"original":"...","better":"...","why":"..."}],
 "lost_words":[{"word":"...","meaning":"short meaning","example":"a sentence using it"}],
 "rewrite":"how a fluent native speaker would SAY this (spoken style, short sentences, same ideas)",
 "phrases":["3 useful chunks from the rewrite"],
 "strength":"one specific thing they did well",
 "focus":"one specific thing to do next time"}
Rules: max 6 corrections (only real mistakes). lost_words = words/phrases they seemed to search for, used vaguely, or would have made the sentence better (max 5). Keep it encouraging.` },
  ];
}

export function parseFeedback(text) {
  const j = extractJson(text);
  if (!j) return { rewrite: text, corrections: [], lost_words: [], phrases: [] };
  return {
    corrections: Array.isArray(j.corrections) ? j.corrections.slice(0, 8) : [],
    lost_words: Array.isArray(j.lost_words) ? j.lost_words.slice(0, 6).filter(w => w && w.word) : [],
    rewrite: j.rewrite || '', phrases: Array.isArray(j.phrases) ? j.phrases.slice(0, 5) : [],
    strength: j.strength || '', focus: j.focus || '',
  };
}

export function partnerSystem(settings, scenario) {
  return `You are a friendly conversation partner and English coach. ${learnerProfile(settings)}
Scenario: ${scenario}. Speak naturally like a native speaker, in short turns (max 35 words). Ask ONE question at a time and follow up on what they say.
The learner's turns come from speech recognition; ignore punctuation. Reply ONLY with JSON:
{"reply":"your spoken reply ending with a question","correction":"the most important mistake in their last turn, or empty","better":"a more natural way to say their last turn, or empty"}`;
}

export function parsePartner(text) {
  const j = extractJson(text);
  if (!j) return { reply: text.trim(), correction: '', better: '' };
  return { reply: j.reply || '', correction: j.correction || '', better: j.better || '' };
}

export const SCENARIOS = [
  'Casual chat with a new colleague at a tech meetup',
  'Job interview for a senior software engineer role',
  'Explaining your current project to your manager',
  'Podcast interview about your journey as a developer',
  'Talking to a viewer who commented on your Instagram reel',
  'Ordering at a café and making small talk',
  'Debating whether AI will replace programmers',
];
