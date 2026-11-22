// What we measured from Theo Browne (t3.gg): 11 transcripts (84,829 words) + 30 minutes of his audio.
// Numbers come from the Whisper + Praat analysis in this project (see tools/analyze_me.py).
export const THEO = {
  wpm: 192, wpmArticulation: 218, syllPerSec: 5.0, pausesPerMin: 12.4, pauseMedianMs: 460,
  pctPausesAtSentenceEnd: 61, pctPausesMidPhrase: 3, freezesPerMin: 0.5, restartsPerMin: 0.3,
  f0RangeSt: 9.7, f0SdSt: 3.9, pctStatementsFalling: 60,
  nurseF3Ratio: 0.63, trapNasal: { F1: 503, F2: 1869 }, trapOral: { F1: 765, F2: 1505 }, lot: { F1: 704, F2: 1269 }, thought: { F1: 742, F2: 1097 },
  avgSentenceWords: 15.1, pctShortSentences: 42, pctQuestions: 3.9, uniqueWords: 5420,
};

// Each comparison: label, your-value getter key, Theo value, direction ('up' = higher is better toward Theo, 'down' = lower, 'near' = closer is better).
export const COMPARE = [
  ['Words per minute', 'wpm', THEO.wpm, 'near', 'He talks fast. Get to 150-170 first; clarity before speed.'],
  ['Freezes per minute', 'freezesPerMin', THEO.freezesPerMin, 'down', 'He almost never goes silent mid-thought.'],
  ['Restarts per minute', 'restartsPerMin', THEO.restartsPerMin, 'down', 'He patches forward instead of rewinding.'],
  ['Fillers per minute', 'fillersPerMin', 0.3, 'down', 'He replaces fillers with short silent pauses.'],
  ['Pauses at sentence ends', 'pctPausesAtSentenceEnd', THEO.pctPausesAtSentenceEnd, 'up', 'He pauses between ideas, not inside them.'],
  ['Pauses mid-phrase', 'pctPausesMidPhrase', THEO.pctPausesMidPhrase, 'down', 'Mid-phrase pauses are what make speech sound broken.'],
  ['Pitch range (semitones)', 'f0RangeSt', THEO.f0RangeSt, 'up', 'Expressive voice; under about 6 sounds flat.'],
  ['Statements ending with a fall', 'pctStatementsFalling', THEO.pctStatementsFalling, 'up', 'Falling endings sound confident and decided.'],
  ['American R strength (lower is stronger)', 'nurseF3Ratio', THEO.nurseF3Ratio, 'down', 'Measured on words like work, first, learn.'],
];

export const ACCENT = [
  {
    id: 'r', name: 'The American R', theo: 'His R is fully pronounced everywhere: the third formant drops from about 2,600 Hz to 1,630 Hz in words like work and first.',
    how: 'Pull the tongue back and bunch it up without touching the roof of your mouth. Round the lips a little. Hold “errrr”. Never tap or roll it.',
    words: ['work', 'first', 'learn', 'turn', 'word', 'her', 'person', 'world', 'server', 'nerd', 'third', 'worth'],
    sentence: 'Her first word at work was learn, and the third person turned it into a better world.',
  },
  {
    id: 'flap', name: 'The soft T (flap)', theo: 'Between vowels his T becomes a quick, light D: better sounds like “bedder”, a lot of like “a lodda”.',
    how: 'Tap the ridge behind your top teeth once, very lightly, like a fast D. No puff of air. Indian English often uses a hard or retroflex T here.',
    words: ['better', 'water', 'getting', 'city', 'data', 'a lot of', 'whatever', 'computer', 'pretty', 'meeting', 'writing', 'get it'],
    sentence: 'Getting better at writing code is pretty much a lot of practice, whatever the data says.',
  },
  {
    id: 'trap', name: 'Two kinds of “a”', theo: 'Before m or n his “a” rises and glides (can’t, man: F1 503, F2 1869). Elsewhere it is low and open (back, app: F1 765, F2 1505).',
    how: 'In back, bad, app, fact: drop your jaw wide open. In can’t, man, plan, stand: start higher, almost “eh”, and glide into the nasal.',
    words: ['can’t', 'man', 'plan', 'stand', 'hand', 'chance', 'back', 'bad', 'app', 'fact', 'stack', 'that'],
    sentence: 'I can’t stand bad apps, so the man made a plan and took the stack back.',
  },
  {
    id: 'ah', name: 'The open “ah”', theo: 'Got, talk and thought all use an open, unrounded “ah”. His two vowels are close together (cot and caught nearly merged).',
    how: 'Open your mouth and keep the lips relaxed, not rounded. Talk is “tahk”, thought is “thaht”, got is “gaht”.',
    words: ['got', 'not', 'job', 'lot', 'stop', 'top', 'thought', 'talk', 'caught', 'off', 'long', 'wrong'],
    sentence: 'I thought a lot about the job, but I got the talk wrong, so I stopped and started off again.',
  },
];

// A passage that contains enough target words for /api/accent to measure all four features in one take.
export const ACCENT_PASSAGE = 'I can’t stand bad apps. Back then, my first job was to plan the stack and learn the work. I thought a lot about it, but I got the answer wrong, so I talked to the man who had the data. It was better to stop, step back, and turn the plan around. Her words were worth a lot: get it working, then make it better.';

export const HOOKS = [
  { type: 'Confession', pattern: 'This is a video I never wanted to make, but…', template: 'This is a video I never wanted to make, but [topic]…' },
  { type: 'Reversal', pattern: 'If you had told me a few months ago that…, I would have…', template: 'If you had told me a year ago that I’d [surprising thing], I would have laughed.' },
  { type: 'Bold claim', pattern: 'Saying X is good would be a criminal understatement.', template: 'Calling [tool] useful would be a massive understatement.' },
  { type: 'Escalation', pattern: 'They didn’t just do X. They did Y. And not just Y either…', template: '[Company] didn’t just release a new [thing]. They released three.' },
  { type: 'Pain point', pattern: 'One of the most frustrating things about X is…', template: 'One of the most frustrating things about [topic] is [pain].' },
  { type: 'Hot take', pattern: 'It’s time to stop/start X. At least according to…', template: 'It’s time to stop [common habit]. Here’s why.' },
  { type: 'Personal context', pattern: 'As of recent, I’ve been pretty harsh on X, and I think it’s for good reason.', template: 'Lately I’ve been pretty harsh on [thing], and I think it’s for good reason.' },
];

// Most frequent chunks in 84,829 words of Theo transcripts (count per 10,000 words where measured).
export const THEO_PHRASES = [
  { phrase: 'a lot of', cue: 'Quantity, his most frequent chunk (131 times)' },
  { phrase: 'which means', cue: 'Show the consequence of what you just said' },
  { phrase: 'to be clear', cue: 'Prevent a misunderstanding before stating your view' },
  { phrase: 'to be fair', cue: 'Acknowledge the other side' },
  { phrase: 'kind of', cue: 'Soften a claim (7 per 10k words)' },
  { phrase: 'genuinely', cue: 'Mark a sincere, strong opinion' },
  { phrase: 'especially', cue: 'Point to the most important case' },
  { phrase: 'a bunch of', cue: 'Casual quantity' },
  { phrase: 'to make sure', cue: 'Explain purpose' },
  { phrase: 'you get the idea', cue: 'Wrap up a list without finishing it' },
  { phrase: 'at the same time', cue: 'Introduce a contrast' },
  { phrase: 'to the point where', cue: 'Show how extreme something became' },
  { phrase: 'it is what it is', cue: 'Accept a situation and move on' },
  { phrase: 'if you’re not familiar with', cue: 'Introduce background for new viewers' },
  { phrase: 'I never thought I would', cue: 'Open with surprise about yourself' },
  { phrase: 'the problem is', cue: 'Name what is wrong' },
  { phrase: 'more and more', cue: 'Describe a growing trend' },
  { phrase: 'here’s the thing', cue: 'Introduce the key insight' },
];

export const THEO_STYLE = [
  ['Short sentences', '42% of his sentences have 10 words or fewer. Average 15, median 12.'],
  ['Statements, not questions', 'Only 3.9% of sentences are questions. He tells you what he thinks.'],
  ['Simple words', '5,420 different words across 85,000. Clarity comes from structure, not vocabulary.'],
  ['He talks in chains', 'Top sentence starts: “This is”, “And I”, “I have”, “If you”, “So, I”. Ideas link like a live story.'],
  ['Same ending every time', 'Question to the audience, “hope this was helpful”, then his sign-off. A signature sign-off builds a brand.'],
];
