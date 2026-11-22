# 🎙️ SpeakForge

A personal speaking gym for **fluent, clear, confident English**, built around three problems: losing words mid-sentence and restarting, unclear articulation, and nervousness about speaking loudly.

➡️ **Read [PLAN.md](PLAN.md) first**: your 6-month plan, the science behind it, and what we learned from Theo and Mona (@babystepstothemic).

## Start

**On your phone or any PC (no install):** https://aman1117.github.io/SpeakForge/ (use Chrome or Edge, allow the microphone, and "Add to Home screen" to install it like an app).

**On this PC:**
```powershell
cd SpeakForge
.\start.ps1                   # serves http://localhost:8765 and opens Edge
.\start.ps1 -Reminder 20:00   # optional: open SpeakForge automatically every day at 20:00
.\start.ps1 -RemoveReminder   # remove the daily reminder
```
Progress is stored per device/browser. Use **Journal → Export / Import** to move it.

## What's inside

| Screen | Solves | Highlights |
|---|---|---|
| **Today** | Habit | Adaptive daily mission sized to your daily minutes (10/20/35/60), Saturday benchmark, Sunday real-world task, focus of the day, weekly report, progress charts |
| **Speaking Arena** | Word-freeze restarts, fluency, volume, camera nerves | Modes: 1-min topics, **No-Restart**, **Question chain** (5 spoken questions), 4/3/2, 10-word, PREP, Creator, **Benchmark**. Live **BRIDGE cards + beep** on freezes, **SPACE / tap to count restarts**, **live "speak up" volume coaching**, **camera mode** (records video), calm-down ritual. Results: wpm, freezes, recovered, restarts (self + detected), fillers, **clarity %**, volume-zone %, highlighted transcript, **"which words did you lose?" → your deck**, **automatic AI feedback** |
| **Word Lab** | Word retrieval | Rapid naming (incl. **My lost words**), Taboo, category sprint, synonym sprint |
| **Mouth Gym** | Articulation | Warm-up, pa-ta-ka speed test, scored tongue twisters with **model vs you** playback, minimal pairs **prioritised for your first language** (auto-plays the model when misheard), pen-in-mouth reading |
| **Confidence Lab** | Volume, anxiety | Calibrated volume zone, projection ladder, box breathing, exposure ladder, **real-world moment log** (before → after nerves), nervousness trend |
| **Shadowing** | Prosody, accent | Speak-along with word highlighting, echo-and-score, your own Theo/Mona clips with A-B loop + speed, shadow your **AI rewrite** |
| **Phrase Bank** | Chunks + lost words | Spaced repetition, auto-checked by voice; lost words show a first-letter hint |
| **Skills** | "Which skills do I need?" | Live 0-100 score on 11 skills from your data, lessons, targets, "train now" |
| **AI Coach** | Feedback + real conversation | Profile (first language, accent goal, daily time). Connect **OpenAI**, **Azure OpenAI**, or **free local Ollama** for automatic feedback (corrections, the words you were looking for, native-style rewrite, chunks) and a **voice conversation partner** with BRIDGE cards |
| **Plan / Journal** | Direction + proof | 26-week plan; recordings (audio + video), first vs latest benchmark, export without your AI key |

### Privacy
Recordings and progress stay in your browser (IndexedDB/localStorage). Edge/Chrome speech recognition sends audio to the browser vendor's speech service to produce transcripts. If you connect an AI, only the transcript and metrics go to the provider you chose. Your API key stays in this browser and is never included in exports.

## Deep analysis of a recording (optional, offline)
```powershell
pip install faster-whisper praat-parselmouth av numpy
python tools\analyze_me.py path\to\recording.webm
```
Compares you with Theo Browne's measured values on rate, pause placement, freezes, fillers, restarts, pitch range/variation, falling intonation and American-R strength. Validated on Theo's own audio.

## Tests
```powershell
node --test tests/             # unit tests: metrics, voice tracking, skill scores, focus, weekly report, SRS, AI JSON parsing
python tests\smoke.py          # E2E: headless Edge + fake mic & camera + mock AI server, every screen and feature
python tests\e2e_speech.py     # E2E: fake speech recogniser → restart/filler detection, clarity, AI feedback, lost words, conversation partner
```
