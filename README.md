# SpeakForge

A daily speaking workout for strong command of spoken English: **find the word, use precise words, drop the fillers, explain clearly, and stay calm in front of people.** Built from speech research and from what great speakers actually did (Theo Browne, Mona of @babystepstothemic, Feynman, Churchill, Lincoln, Patrick Winston, Toastmasters).

Read [PLAN.md](PLAN.md) for the six-month plan, the research behind every feature, and why some features were removed.

## Mac (Apple Silicon): fully private

```bash
./setup_mac.sh        # once: Python env, MLX Whisper, Praat, SpeechBrain, Ollama + Gemma 4 (~20 GB of downloads)
./start.sh            # every day: starts SpeakForge at http://localhost:8765 and opens it
./start.sh --reminder 20:00   # optional: open it every day at 20:00 with a notification
```

| Part | Runs on | Notes |
|---|---|---|
| Speech recognition (live transcripts, fillers, restarts, word timings) | Whisper large-v3-turbo on the GPU (Apple MLX) | Keeps the "um"s and false starts that browser recognition hides |
| Real-life recordings: who spoke when, which voice is yours | SpeechBrain ECAPA voiceprints | About 2.8 s of processing per audio minute; your voiceprint is stored in `~/.speakforge` |
| Pitch, pause placement, formants | Praat (parselmouth) | The same method used to measure Theo |
| AI coach: feedback, explanation rubric, word upgrades, real-life review, conversation partner | Ollama with **Gemma 4 26B** (`gemma4:26b`) | Schema-enforced JSON; `SPEAKFORGE_LLM=gemma4:12b` for 16 GB Macs |
| Recordings and progress | Your browser (IndexedDB/localStorage) | Export a backup in Progress → Your data |

Use Safari, Chrome or Edge. The sidebar shows "Private mode" when the local engine is running.

**Other ways to run:** https://aman1117.github.io/SpeakForge/ (browser mode: the browser's speech recognition, no Real life), or on Windows: `pip install faster-whisper praat-parselmouth av numpy speechbrain`, then `.\start.ps1`.

## What's inside

| Screen | For | Highlights |
|---|---|---|
| **Today** | Habit | One-button guided workout (adapts to phase, daily minutes and your weakest skill), progress rings, focus of the day, scores for your five problems, trend charts, weekly report |
| **Speak** | Everything at once | 1-minute topics, No-Restart, Table Topics question chain, 4/3/2, 10-word sentences, PREP, reels, benchmark. Planning time, virtual audience, live rescue-phrase and filler cues. Results: one thing to fix → **redo with that fix**, what a listener took away, word upgrades, corrections, a clearer version to shadow |
| **Practice → Explain gym** | Confusing explanations | Answer first, explain to a 12-year-old, story, walk-through, compare, one-sentence headline. Plan → explain → *what the listener heard* → 5-point rubric → redo. Confused listener |
| **Practice → Word lab** | Losing words, basic words | Rapid retrieval (precise words, your lost words, your upgrades), Taboo, **Word upgrade** from your own transcripts, Say it better |
| **Practice → Filler lab** | Fillers | Habit reversal: spot your fillers on playback (scored against Whisper), filler-free minute, fresh starts |
| **Practice → Calm on stage** | Nerves | Cyclic-sighing calm reset, **virtual audience** from 1 friend to a 200-seat tough crowd with each feared outcome tested, video self-review, volume zone, real-world ladder |
| **Practice → Clear speech** | Rhythm, articulation | Thought groups with measured pause placement, warm-up, pebble drill, tongue twisters, sound pairs |
| **Real life** | Transfer to real meetings | Upload a meeting or call → transcribed, your voice found by voiceprint, *your* fillers, restarts, vague words and talk share, Gemma's review → drills |
| **Progress** | Proof | Skill map grouped by problem, first vs latest recording, history, the 26-week plan, export |
| **Learn from the best** | Models | What great speakers did, each linked to a drill; Theo's measured profile, hooks, phrases and accent lab |

## Tests

```bash
npm test                                            # unit tests: analysis, scoring, thought-group alignment
python3 tests/e2e.py                                # every flow in Chromium: fake mic/camera, scripted recogniser, mock AI
python3 tests/e2e_real.py                           # Mac: Real life through the UI with real Whisper, voiceprint and Gemma
python3 tests/e2e_local.py                          # private mode: real server + Whisper + Praat + Ollama with spoken audio
.venv/bin/python tests/test_reallife.py [--perf]    # speaker separation + voiceprint accuracy and the HTTP API
python3 tests/webkit_check.py                       # Safari engine: every screen, fonts, storage
```
(The browser tests need `pip install playwright && python -m playwright install chromium webkit`.)

## Command-line analysis

```bash
.venv/bin/python tools/analyze_me.py path/to/recording.webm    # writes recording.report.md, compared with Theo
```
