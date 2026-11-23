# Your 6-Month Speaking Plan

*For: strong, fluent command of spoken English in 4–6 months. Models: Theo Browne (t3.gg) for delivery, Mona (@babystepstothemic) for the daily routine, and the great orators and explainers for structure.*
*Companion app: **SpeakForge**. Run `./setup_mac.sh` once, then `./start.sh` every day. Speech recognition, speaker recognition and the AI coach (Gemma 4) all run privately on your Mac.*

---

## 1. The five problems, and what actually fixes each one

| Your problem | What is going on | What fixes it (evidence) | Where in SpeakForge |
|---|---|---|---|
| **1. I forget a word, freeze, and restart the sentence** | Slow *lexical retrieval* (Levelt's model) plus poor *repair*: when one word fails, you treat the whole sentence as failed. | Retrieval practice makes words faster to access. Communication strategies (talking around a word) can be trained (Dörnyei 1995). Fluent speakers lose words too; they never rewind. | Rapid retrieval (with *your* lost words), Taboo, No-Restart challenge, live rescue-phrase cue after a silence |
| **2. I use basic words** | Your active vocabulary is much smaller than your passive one. Words you *recognise* aren't the words you *reach for*. | Words you need, search for and choose yourself stick far better (Laufer & Hulstijn 2001, involvement load). Productive use in your own sentences beats word lists. | **Word upgrade** finds the vague words in *your own transcripts* and makes you re-say the sentence with a precise word. **Say it better**. Upgrades go into spaced repetition. |
| **3. I use too many fillers** | A habit. Most people hear only half of their own fillers. | **Habit reversal**: awareness training plus a competing response (a silent pause) cut filled pauses in public speakers (Mancuso & Miltenberger 2016; Spieler & Miltenberger 2017). Toastmasters' Ah-Counter is the same idea. | **Filler lab**: 1) catch your own fillers on playback (scored against Whisper), 2) filler-free minute with a live cue, 3) fresh starts. Live filler cue in every speech. |
| **4. My explanations get confusing, then I add more words and make it worse** | No plan, the point comes last, and the *curse of knowledge* (Heath & Heath) makes you skip steps, so you then backtrack. | Answer first (Pyramid Principle / BLUF). Planning time improves fluency and structure (Foster & Skehan 1996; Ellis 2009). Repeating the task straight after feedback improves it (Bygate 2001). Checking what the listener actually understood exposes the gap. | **Explain gym**: plan → explain → "what a listener heard" → 5-point rubric → redo with one fix. Confused-listener conversation. One-sentence headlines. |
| **5. I get nervous in front of many people** | Public-speaking anxiety: you predict disaster, avoid, and never learn that it doesn't happen. You also believe your nerves are visible. | Graded exposure and virtual-audience exposure (Anderson et al. 2005; Wallach et al. 2009). Testing the feared outcome (Craske et al. 2014). Video feedback with cognitive preparation (Harvey, Clark et al. 2000). Illusion of transparency (Savitsky & Gilovich 2003). Cyclic sighing (Balban et al. 2023). Calling it excitement (Brooks 2014). | **Calm on stage**: 60-second calm reset, a **virtual audience** growing from 1 friend to a tough auditorium with your feared outcome tested each time, video self-review, real-world ladder |

**The in-the-moment protocol for losing a word: Pause → Bridge → Continue.**
Pause half a second. Bridge with "the thing that…", "what I mean is…" or "it's like…". Continue the *same* sentence. A word you describe sounds fluent; a restarted sentence sounds broken.

**For explaining: Point → Why → Example → Point.**
Say the answer in your first sentence (under 20 words). Give one or two reasons. Give one concrete example. Say the answer again, then stop.

---

## 2. What was removed, and why

| Removed | Why |
|---|---|
| XP and levels | Points for showing up don't measure skill. Progress is now measured from what you say: fillers per minute, explanation score, vague words, nerves. |
| Pa-ta-ka speed test | It's a clinical tool for diagnosing speech disorders, not a training method. Its loudness-burst count was also unreliable. |
| Category sprint, synonym sprint, emoji naming | Listing words in isolation trains the wrong skill. They're replaced by retrieval of mid-frequency words, word upgrades from your own speech, and "Say it better". |
| Box breathing | Cyclic sighing lowered anxiety more than box breathing in a head-to-head trial (Balban et al. 2023). |
| "Start with 'So,'" advice | That trains a filler at the start of a sentence. Now: open with your point. |
| Affirmation ritual | Replaced by things with evidence: cyclic sighing, saying "I am excited" (reappraisal), and a reminder about the illusion of transparency. |

Kept because they have evidence or come from great speakers: 4/3/2 (Nation 1989), shadowing (Hamada 2016–18), spaced repetition of ready-made phrases (Wood 2010), sound pairs, tongue twisters, the volume zone, Mona's 1-minute topics, the pebble/pen drill (Demosthenes), Theo's measured profile.

**Accent vs rhythm.** Practising rhythm, stress and pausing improved how easy learners were to understand more than drilling individual sounds (Derwing, Munro & Wiebe 1998). So SpeakForge now leads with **thought groups** (Churchill typed his speeches in short lines, one thought per breath). The American-accent lab stays inside *Learn from Theo* as an optional extra.

---

## 3. The AI: why Gemma 4, and what it does

On your M5 Max (64 GB), the coach is **Gemma 4 26B** (`gemma4:26b`): a mixture-of-experts model with only about 4B active parameters, so it is fast. In a side-by-side test on a messy explanation:

- **Gemma 4 26B** scored it honestly (point-first 0/2), restated the point the way a listener heard it, and wrote an excellent model answer, in about 14–21 s.
- **Gemma 3 12B** was slower on feedback (33 s) and suggested a "correction" that changed nothing.

Every AI call uses a **JSON schema enforced by Ollama**, so the output can't break the UI. The model stays loaded for 30 minutes.

| Job | Model | Why |
|---|---|---|
| Live transcription, filler/restart detection, word timings | Whisper large-v3-turbo (MLX) | More accurate than any LLM at speech-to-text, and it keeps the "um"s |
| Who is speaking in a meeting, which voice is yours | SpeechBrain ECAPA voiceprints | 98–99% of words attributed to the right speaker on real 4-person meetings |
| Pitch, pauses, formants | Praat | The same method used to measure Theo |
| Model voice for shadowing | Kokoro-82M | Natural rhythm and melody to copy; system voices sound robotic and you'd copy that |
| Feedback, explanation rubric, word upgrades, real-life review, conversation partner | Gemma 4 26B via Ollama | Best quality for its speed on Apple Silicon |

Options: `SPEAKFORGE_LLM=gemma4:31b` gives a little more quality and is slower. `gemma4:12b` is for 16 GB Macs. OpenAI or Azure can also be used from Settings.

---

## 4. The daily workout (one button on Today)

The workout adapts to your phase, your daily minutes (10/20/35/60) and your weakest skill. A bar at the top guides you from step to step. A typical Foundation day (35 min):

| Step | Minutes |
|---|---|
| Calm reset (cyclic sighing) | 1 |
| Mouth warm-up | 3 |
| *Focus of the day* (your weakest skill) | 3–6 |
| Rapid word retrieval | 3 |
| **Explain gym** (answer first) | 6 |
| 1-minute topic (Mona's daily drill) | 4 |
| Filler-free minute | 3 |
| Phrase review | 4 |
| Volume zone | 3 |

**Saturday:** benchmark speech (the same self-introduction every week; compare day 1 with day 180).
**Sunday:** upload one real conversation from the week in **Real life**, plus one real-world rung.

---

## 5. The 26 weeks

| Weeks | Phase | Goal |
|---|---|---|
| 1–4 | Foundation | Habit and baselines: answer first, filler awareness, rescue phrases, calm breathing, volume. Week 1: record your benchmark and upload your first real meeting. |
| 5–10 | Fluency engine | Kill restarts and basic words: 4/3/2, Taboo, word upgrades from your own speech, explain like Feynman, fast retrieval, chunks. Join Toastmasters (or book a weekly tutor call) by week 10. |
| 11–18 | Expression | Clear and engaging: thought groups, stress, stories, PREP, confused-listener drills, virtual audience up to level 4, real meetings reviewed weekly. Week 18: mid-point re-test. |
| 19–26 | Creator mode | Perform: one-line headlines, reels on camera, video self-review, tough crowds (level 6), public posts. Week 26: day 1 vs day 180. |

## 6. Targets (all measured by SpeakForge)

| Measure | Month 1 | Month 3 | Month 6 |
|---|---|---|---|
| Fillers per minute (Whisper) | < 6 | < 3 | < 1.5 |
| Restarts per minute | < 4 | < 2 | < 1 |
| Explanation score | 5/10 | 7/10 | 8.5/10 |
| Vague words per 100 | < 7 | < 4 | < 2.5 |
| Word retrieval | < 2.5 s | < 1.8 s | < 1.4 s |
| Virtual-audience level with nerves after ≤ 30 | 2 | 4 | 6 |
| Real meetings: fillers per minute | track | −40% | −70% |

---

## 7. Learn from the best (each linked to a drill in the app)

- **Demosthenes:** pebbles in the mouth, speaking over the sea → pebble drill, volume.
- **Lincoln:** 272 words beat a two-hour speech → one-sentence headline.
- **Churchill:** speech notes in short lines like a poem → thought groups.
- **Martin Luther King Jr.:** repetition as structure you can hear.
- **Feynman:** plain words plus one concrete example → explain to a 12-year-old.
- **Patrick Winston:** promise what they'll gain, repeat the core idea three times, signpost, show a near miss (what it is NOT).
- **Barbara Minto:** answer first.
- **Chip and Dan Heath:** the curse of knowledge → confused listener.
- **Toastmasters:** the Ah-Counter, Table Topics.
- **Steve Jobs:** headline first, rule of three.
- **Theo Browne:** short sentences, pauses at sentence boundaries, never rewinds.
- **Mona:** daily 1-minute topics, 100 days of shadowing, recorded and reviewed.

## 8. Outside the app

- **Toastmasters** from week 10: real audience and Table Topics. Record it and upload it to Real life.
- **Record your real meetings** (with permission) once a week. This is the most honest measure of progress.
- A tutor call once a week from month 2 (Cambly or Preply).
- Shadow Theo and Mona clips (Shadowing → *Your own clips*).
- Post a "day 1 vs day 180" reel in week 26.
