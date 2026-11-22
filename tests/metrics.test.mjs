import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countWords, wordsPerMinute, countFillers, findRepetitions, pauseStats, similarity, missedWords, containsPhrase,
  VoiceTracker, speechThreshold, countBursts, reviewCard, dueCards, levelFromXp, computeStreak, weekNumber, coachNotes,
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
  const notes = coachNotes({ wpm: 95, longPausesPerMin: 4, repetitions: 5, fillers: 6, loudnessDelta: 1 }).join(' ');
  assert.match(notes, /slow/);
  assert.match(notes, /BRIDGE/);
  assert.match(notes, /restart/);
  assert.match(notes, /fillers/);
  assert.match(notes, /Project/);
});
