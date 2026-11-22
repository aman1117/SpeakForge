# 🎙️ SpeakForge

A personal speaking gym for **fluent, clear, confident English**. It runs locally in your browser; nothing is uploaded except the audio that Edge/Chrome's built-in speech recognition sends to its own service for transcripts.

➡️ **Read [PLAN.md](PLAN.md) first**: your 6-month plan, the science behind it, and what we learned from Theo and Mona (@babystepstothemic).

## Start
```powershell
cd SpeakForge
.\start.ps1          # serves http://localhost:8765 and opens Edge
```
Use **Microsoft Edge or Google Chrome** (needed for speech recognition) and allow microphone access. Use a headset or a quiet room for accurate pause/volume measurements.

## What's inside

| Screen | Trains | Highlights |
|---|---|---|
| **Today** | Habit | Daily mission for your current phase, XP/levels/streak, progress charts, 12-skill map |
| **Speaking Arena** | Fluency, repair, structure | 1-min random topics, 4/3/2, 10-word sentences, PREP, Creator reels, **No-Restart** mode. Live **freeze detection → BRIDGE card** with rescue phrases. Results: words/min, freezes, recovered freezes, restarts, fillers, volume, highlighted transcript, recording, **AI-coach prompt** |
| **Word Lab** | Word retrieval | Rapid naming (ms per word), Taboo (circumlocution), category sprint, synonym sprint |
| **Mouth Gym** | Articulation | Guided warm-up, pa-ta-ka speed test, scored tongue twisters, minimal pairs (V/W, TH, S/SH, vowels…), pen-in-mouth reading |
| **Confidence Lab** | Volume, nerves | Calibrated volume zone, projection ladder, box breathing, 15-step exposure ladder, nervousness before/after chart |
| **Shadowing** | Prosody, accent | Speak-along with word highlighting, echo-and-score, A-B loop + speed control for your own Theo/Mona clips |
| **Phrase Bank** | Chunks | 40+ rescue/opinion/linking/hook phrases with Leitner spaced repetition, auto-checked by voice |
| **6-Month Plan** | Direction | 4 phases, 26 weekly themes, routine, targets |
| **Journal** | Proof | Every speech recorded locally, first vs latest comparison, download, export/import progress |

## Deep analysis of a recording (optional, offline)
```powershell
pip install faster-whisper praat-parselmouth av numpy
python tools\analyze_me.py path\to\recording.webm
```
Measures speaking rate, syllables/sec, pause placement (mid-phrase vs boundary), freezes, fillers, restarts, pitch range and variation, falling intonation, and American-R strength. It compares each one against Theo Browne's measured values. Validated by running it on Theo's own audio, where it reproduces his numbers.

## Tests
```powershell
node --test tests/          # unit tests for metrics, voice tracking, SRS, streaks
python tests\smoke.py       # end-to-end: headless Edge + fake microphone, every screen + a real session
```

## Data
Progress: browser localStorage (`speakforge.v1`). Recordings: IndexedDB. Export a backup from **Journal** weekly.
