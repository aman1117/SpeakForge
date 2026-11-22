# SpeakForge

A rehearsal room for speaking English fluently, clearly and without fear. Built around three problems: losing a word mid-sentence and restarting, unclear articulation, and nerves about speaking up. It uses what we measured from Theo Browne's real speech as the model.

Read [PLAN.md](PLAN.md) for the six-month plan and the research behind it.

## Mac (Apple Silicon): fully private, nothing leaves your Mac

```bash
git clone https://github.com/aman1117/SpeakForge.git
cd SpeakForge
./setup_mac.sh        # one time: Python env, MLX Whisper, Praat, Ollama + an AI model (~10 GB of downloads)
./start.sh            # every day: starts SpeakForge at http://localhost:8765 and opens it
```

On an M5 Max you can afford a bigger coach model: `SPEAKFORGE_LLM=gemma3:27b ./setup_mac.sh`.

What runs where in private mode:

| Part | Runs on | Notes |
|---|---|---|
| Speech recognition (live transcripts, restarts, fillers) | **Your Mac**: Whisper large-v3-turbo on the GPU via Apple MLX | Keeps the "um"s and false starts that browser recognition hides |
| Deep analysis (pause placement, pitch, intonation, R strength) | **Your Mac**: Praat (parselmouth) | Same method used to measure Theo |
| Accent measurement (R, the "a" split, open "ah") | **Your Mac**: Praat formants | Learn from Theo → Measure my accent |
| AI coach and conversation partner | **Your Mac**: Ollama (default gemma3:12b) | No API keys, no cloud |
| Voices that read prompts aloud | **Your Mac**: macOS system voices | Novelty voices are skipped automatically |
| Recordings and progress | **Your browser** (IndexedDB/localStorage) | Export a backup from Recordings |
| Fonts | Bundled with the app | No third-party requests |

Use Safari, Chrome or Edge. The sidebar shows "Private mode" when the local engine is running. If Whisper is still loading after `start.sh`, the sidebar says so.

## Other ways to run

- **Anywhere, no install:** https://aman1117.github.io/SpeakForge/ (browser mode: the browser's own speech recognition, which sends audio to Apple/Google/Microsoft).
- **Windows:** `pip install faster-whisper praat-parselmouth av numpy`, optionally install Ollama, then `.\start.ps1` (add `-Reminder 20:00` for a daily reminder).

## What's inside

| Screen | Helps with | Highlights |
|---|---|---|
| **Today** | Habit | Adaptive run sheet sized to your daily minutes, Saturday benchmark, Sunday real-world task, focus of the day, weekly report, progress charts |
| **Speak** | Restarts, fluency, volume, camera nerves | A stage spotlight that follows your voice; cues with rescue phrases when you freeze; space to count restarts; "speak up" cues; film-me mode; 1-minute topics, No-Restart, Question chain, 4/3/2, PREP, reels, benchmark. Results: restarts, freezes, fillers, clarity, lost words, AI feedback, **You vs Theo** |
| **Find words fast** | Word retrieval | Rapid naming (including your lost words), Taboo, category and synonym sprints |
| **Clear speech** | Articulation | Warm-up, pa-ta-ka test, tongue twisters and sound pairs with model-vs-you playback, pen-in-mouth reading |
| **Volume and nerves** | Projection, anxiety | Volume zone, projection ladder, box breathing, exposure ladder, real-world log |
| **Shadowing** | Rhythm and melody | Speak-along, echo-and-score, your own clips with A-B loop |
| **Phrases** | Ready-made chunks | Spaced repetition, checked by voice |
| **Learn from Theo** | Accent and style | His measured profile, an accent lab for R / soft T / two kinds of "a" / open "ah" with real measurement, his seven hook patterns, his top phrases |
| **Skills** | Knowing what to train | Live 0-100 score per skill with lessons |
| **Coach and profile** | Setup | First language, accent goal, daily time, speech engine, AI provider (this computer, OpenAI, Azure OpenAI) |

## Command-line deep analysis

```bash
python3 tools/analyze_me.py path/to/recording.webm      # writes recording.report.md, compared with Theo
```

## Tests

```bash
node --test tests/              # unit tests
python3 tests/smoke.py          # every screen with a fake mic, camera and AI server
python3 tests/e2e_speech.py     # transcript paths with a fake recogniser
python3 tests/e2e_local.py      # private mode: real server.py + Whisper + Ollama + real audio (Windows speech for input)
python3 tests/webkit_check.py   # Safari engine: every screen, fonts, storage
```
