import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countWords, wordsPerMinute, countFillers, findRepetitions, pauseStats, similarity, missedWords, containsPhrase,
  VoiceTracker, speechThreshold, countBursts, reviewCard, dueCards, levelFromXp, computeStreak, weekNumber, coachNotes,
  lexicalProfile, mattr, mazes, explainProfile, explainScore, speechReport, pauseFit, parseGroups,
} from '../js/metrics.js';

test('word counting and wpm', () => {
  assert.equal(countWords("So, I think it's really cool!"), 6);
  assert.equal(wordsPerMinute(150, 60), 150);
  assert.equal(wordsPerMinute(75, 30), 150);
  assert.equal(wordsPerMinute(10, 0), 0);
});

test('fillers: words and phrases, "like" flagged separately', () => {
  const f = countFillers('Um so I mean it was uh basically like good, you know');
  assert.equal(f.items.um, 1);
  assert.equal(f.items.uh, 1);
  assert.equal(f.items['i mean'], 1);
  assert.equal(f.items.basically, 1);
  assert.equal(f.items['you know'], 1);
  assert.equal(f.items['like (check)'], 1);
  assert.equal(f.total, 5);
});

test('repetitions catch restarts but not legit doubles', () => {
  assert.deepEqual(findRepetitions('I want I want to go to the the market'), ['i want', 'the']);
  assert.deepEqual(findRepetitions('it was very very good and so so nice'), []);
  assert.deepEqual(findRepetitions('we should we should we should'), ['we should', 'we should']);
});

test('pause stats separate long freezes', () => {
  const s = pauseStats([100, 300, 500, 2100, 2500], 60);
  assert.equal(s.count, 4);
  assert.equal(s.longCount, 2);
  assert.equal(s.longPerMin, 2);
  assert.equal(s.longestMs, 2500);
  assert.equal(s.medianMs, 1300);
});

test('similarity and missed words', () => {
  assert.equal(similarity('red lorry yellow lorry', 'red lorry yellow lorry'), 100);
  assert.ok(similarity('red lorry yellow lorry', 'red lolly yellow lolly') < 60);
  assert.equal(similarity('', 'x'), 0);
  assert.deepEqual(missedWords('very well Victor', 'Berry well Victor'), ['very']);
  assert.ok(containsPhrase('Well, to be clear, I like it', 'to be clear'));
  assert.ok(!containsPhrase('to be clearly', 'to be clear'));
});

test('VoiceTracker measures pauses, speech time and freezes', () => {
  const tr = new VoiceTracker({ thresholdDb: -40, minPauseMs: 250, hangMs: 100 });
  let t = 0;
  const feed = (db, ms) => { let s = 0; for (let e = 0; e < ms; e += 30) { s = tr.update(db, t); t += 30; } return s; };
  feed(-70, 600);
  assert.equal(tr.started, false);
  feed(-20, 1500);
  assert.equal(tr.started, true);
  const silence = feed(-70, 2400);
  assert.ok(silence > 1800, 'long silence should be reported for freeze detection');
  assert.equal(feed(-20, 300), 0);
  feed(-70, 150);
  feed(-20, 300);
  assert.equal(tr.pauses.length, 1, 'only the >=250ms gap counts as a pause');
  assert.ok(tr.pauses[0] >= 2300 && tr.pauses[0] <= 2500);
  assert.ok(tr.speechMs > 1900 && tr.speechMs < 2600);
  assert.equal(Math.round(tr.avgVoicedDb()), -20);
});

test('VoiceTracker zone percentage', () => {
  const tr = new VoiceTracker({ thresholdDb: -50 });
  [-30, -30, -10, -10].forEach((d, i) => tr.update(d, i * 30, [-35, -20]));
  assert.equal(tr.zonePct(), 50);
});

test('countBursts counts syllable onsets with hysteresis', () => {
  const env = [];
  for (let i = 0; i < 10; i++) env.push(-60, -60, -20, -18, -20, -60);
  assert.equal(countBursts(env, -30, 3), 10);
  assert.equal(countBursts([-60, -29, -31, -29, -60], -30, 1), 1);
});

test('Leitner review moves boxes and schedules', () => {
  const now = 1_000_000;
  let c = { phrase: 'to be clear', box: 0, due: 0 };
  c = reviewCard(c, true, now);
  assert.equal(c.box, 1);
  assert.equal(c.due, now + 86400000);
  c = reviewCard(c, false, now);
  assert.equal(c.box, 0);
  assert.equal(dueCards([c, { box: 3, due: now + 5 }], now).length, 1);
});

test('levels, streaks and plan weeks', () => {
  assert.deepEqual(levelFromXp(0), { level: 1, into: 0, need: 100 });
  assert.equal(levelFromXp(100).level, 2);
  assert.equal(computeStreak(['2026-11-20', '2026-11-21', '2026-11-22'], '2026-11-22'), 3);
  assert.equal(computeStreak(['2026-11-20', '2026-11-21'], '2026-11-22'), 2);
  assert.equal(computeStreak(['2026-11-19'], '2026-11-22'), 0);
  assert.equal(weekNumber('2026-11-22', '2026-11-22'), 1);
  assert.equal(weekNumber('2026-11-22', '2026-12-06'), 3);
});

test('speech threshold is capped for noisy calibration', () => {
  assert.equal(speechThreshold(-65), -53);
  assert.equal(speechThreshold(-80), -58);
  assert.equal(speechThreshold(-25), -38);
});

test('coach notes react to freezes, restarts and volume', () => {
  const notes = coachNotes({ wpm: 95, speakSec: 60, longPausesPerMin: 4, repetitions: 5, fillers: 6, loudnessDelta: 1, vaguePer100: 8, vagueItems: { thing: 2 } }).join(' ');
  assert.match(notes, /slow/);
  assert.match(notes, /BRIDGE/);
  assert.match(notes, /restart/);
  assert.match(notes, /fillers/);
  assert.match(notes, /Project/);
  assert.match(notes, /vague/);
});

import { skillScores, focusOfDay, weeklyReport, extractJson, avgConfidence, roundRates } from '../js/metrics.js';

const round = (o) => ({ speakSec: 60, wpm: 150, freezes: 0, repetitions: 0, fillers: 0, ...o });
const sess = (ts, o, mode = 'oneMin') => ({ ts, mode, rounds: [round(o)] });

test('roundRates uses the larger of self-reported and detected restarts', () => {
  const r = roundRates(round({ speakSec: 30, repetitions: 1, selfRestarts: 3, freezes: 2 }));
  assert.equal(r.restartsPerMin, 6);
  assert.equal(r.freezesPerMin, 4);
});

test('skillScores: null when untested, lower for more freezes', () => {
  const empty = { sessions: [], naming: [], srs: {}, ddk: [], twisters: [], pen: [], pairs: [], zone: [], anxiety: [], exposure: {}, shadow: [] };
  assert.equal(skillScores(empty)['Repair fluency'], null);
  assert.equal(skillScores(empty)['Clear explanations'], null);
  const good = skillScores({ ...empty, sessions: [sess(1, { freezes: 0 })] })['Repair fluency'];
  const bad = skillScores({ ...empty, sessions: [sess(1, { freezes: 5, selfRestarts: 3 })] })['Repair fluency'];
  assert.equal(good, 100);
  assert.ok(bad < 10, `bad=${bad}`);
  const nm = skillScores({ ...empty, naming: [{ avgMs: 1000, acc: 100 }] })['Word retrieval'];
  assert.equal(nm, 100);
});

test('focusOfDay picks untested core skill first, then the weakest', () => {
  assert.equal(focusOfDay({ 'Clear explanations': null, 'Repair fluency': 50 }).skill, 'Clear explanations');
  const all = { 'Clear explanations': 70, 'Filler control': 60, 'Repair fluency': 80, 'Precise vocabulary': 65, 'Calm on stage': 30, 'Word retrieval': 70, 'Pace': null };
  const f = focusOfDay(all);
  assert.equal(f.skill, 'Calm on stage');
  assert.match(f.link[0], /calm/);
});

test('weeklyReport splits this week and last week', () => {
  const now = 100 * 86400000;
  const s = [sess(now - 1000, { freezes: 2 }), sess(now - 8 * 86400000, { freezes: 4 }), sess(now - 30 * 86400000, {})];
  const r = weeklyReport(s, now);
  assert.equal(r.thisWeek.speeches, 1);
  assert.equal(r.lastWeek.speeches, 1);
  assert.equal(r.thisWeek.freezesPerMin, 2);
  assert.equal(r.lastWeek.freezesPerMin, 4);
});

test('extractJson handles fences and chatter; avgConfidence ignores zeros', () => {
  assert.deepEqual(extractJson('Sure!\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('here {"b":[1,2]} done'), { b: [1, 2] });
  assert.equal(extractJson('no json'), null);
  assert.equal(avgConfidence([0.9, 0, 0.7]), 80);
  assert.equal(avgConfidence([]), null);
});

test('vocabulary: vague words, diversity that does not punish long talks', () => {
  const p = lexicalProfile('The thing is the app is very good and the stuff works, um, really nice');
  assert.equal(p.vagueItems.thing, 1);
  assert.equal(p.vagueItems.very, 1);
  assert.ok(!('um' in p.vagueItems));
  assert.ok(p.vaguePer100 > 20);
  assert.equal(lexicalProfile('The bottleneck was the payment service, so we refactored it.').vagueCount, 0);
  const rep = Array(200).fill('we ship the feature').join(' ').split(' ');
  assert.ok(mattr(rep) < 0.2, 'repetitive speech has low diversity');
  assert.ok(mattr('alpha beta gamma delta epsilon zeta eta theta'.split(' ')) === 1);
});

test('mazes count false starts, repeats and self-corrections', () => {
  const m = mazes('I- I want to, I mean, we we should ship it');
  assert.equal(m.fragments, 1);
  assert.equal(m.repetitions, 1);
  assert.equal(m.revisions, 1);
  assert.equal(mazes('We should ship it on Friday.').total, 0);
});

test('explanation structure: point first, signposts, example, recap', () => {
  const good = 'Caching keeps a copy close so you get it faster. For example, your browser keeps images. It is like a fridge next to your desk. In short, it saves trips.';
  const bad = 'So basically there is this thing and the server and then the browser and it goes and comes back and the database is also there and sometimes it is slow and we have to wait and then we do the other thing';
  const g = explainProfile(good), b = explainProfile(bad);
  assert.ok(g.example && g.analogy && g.recap);
  assert.ok(g.firstSentence <= 12);
  assert.ok(b.andChains >= 1 && b.longSentences >= 1);
  assert.ok(explainScore(g, mazes(good), 30) >= 8);
  assert.ok(explainScore(b, mazes(bad), 45) <= 3);
});

test('speechReport combines pace, fillers and vocabulary', () => {
  const r = speechReport('Um, the thing is, uh, I think it is very good.', 30);
  assert.equal(r.fillers, 2);
  assert.equal(r.fillersPerMin, 4);
  assert.ok(r.vaguePer100 > 0);
});

test('thought groups: pauses at boundaries score high, mid-group pauses lower it', () => {
  const text = 'An API / is basically a MENU for software.';
  assert.deepEqual(parseGroups(text).filter(w => w.boundary).map(w => w.key), ['api']);
  assert.ok(parseGroups(text).find(w => w.key === 'menu').stress);
  const words = (gapAfter) => 'an api is basically a menu for software'.split(' ').map((w, i, a) => ({ w, s: i * 0.4 + (i > gapAfter ? 0.5 : 0), e: i * 0.4 + 0.3 + (i > gapAfter ? 0.5 : 0) }));
  assert.equal(pauseFit(text, words(1)).score, 100);
  assert.ok(pauseFit(text, words(4)).score < 50);
});
