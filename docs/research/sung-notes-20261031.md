# Sung notes: which vocal onsets a listener hears (2026-10-31)

`tools/music/sung.py` lists the onsets of sung notes or syllables, each with a
salience, in `productions/<song>/sung.json`. It measures only;
`events.json` is unchanged. This note gives the method, the evaluation on the
owner's labels, and what is still unverified.

## Why events.json is not enough

`events.json` takes vocal onsets from librosa's spectral-flux detector
(`tools/music/stems.py`) and gives each one a peak and a 100 ms rise. On
Valhalla this goes wrong in two ways:

- **A word re-sung on the same pitch has little spectral change.** At
  11.92 s the "ho" (C♯4, after a breath) is plainly in the vocal stem, whose
  loudness goes from 0.12 to 0.30. But the vocal flux barely moves, so the only
  event there is in the "other" stem (0.10 peak, leakage). Demucs did not
  misplace the voice; the onset detector missed it.
- **Peak and rise cannot tell a word from a noise.** 13.53 s (not heard) and
  18.08 s (heard) have the same numbers (0.15 / 0.09 and 0.14 / 0.09). What
  differs is what follows the rise. After 18.08 comes a held D♯4 (spectral
  flatness 0.007, pyin voicing 0.95). After 13.53 comes a noise burst with no
  pitch (flatness 0.13, voicing 0.03), as the held C♯4 before it fades. That
  is probably a breath. The owner hears neither a voice nor a beat there.

## Method

On the vocal stem, using the stems.json loudness grid (11.6 ms frames):

1. **Attack.** Each loudness peak that is at least 3 dB above the dip in the
   300 ms before it (at least double the power). This catches same-pitch
   re-articulations.
2. **Time.** The vocal spectral-flux peak between the steepest point of the
   rise and the loudness peak. This matches the events.json convention: the
   median offset from the nearest vocal event is +11 to +12 ms on all three
   songs, and 96–98% are within 30 ms. The previous draft's "steepest dB
   rise" ran 34 ms early. Searching from the dip itself picked consonants
   before slow swells (4.16 s moved to 3.96 s).
3. **Pitched or not.** The median spectral flatness (80 Hz–5 kHz) over 50–250
   ms after the attack. Above 0.05 (the log midpoint between a sung tone,
   about 0.005, and noise, about 0.5), it is listed under `unpitched`, not
   `notes`. The flatness distribution has no clean gap, so anything within a
   factor of two of 0.05 is marked `borderline`.
4. **Reported, not deciding.** pyin pitch and voicing, the interval in
   semitones from the previous note, the length (until −6 dB or the next
   attack), and the matching events.json event within 50 ms. music.ts
   references a note by that event's time.
5. **Salience** = `min(1, rise_dB / 12) × share`. Share is the vocal stem's
   power over all stems' power at the peak. So salience is how big the jump
   is, times how much of what you hear at that moment is the voice.

What was tried and left out:

- **The "other" stem as a second source.** On Valhalla 0–30 s, every pitched
  attack in "other" is leakage of a note already in the vocal stem (11.85 s:
  share 0.10 in "other", 0.91 in vocals). Pitch alone cannot tell a voice from
  a synth in "other".
- **Legato pitch changes** (a new pitch without a loudness rise). Valhalla has
  none. Trouble has 9 and Circus 1, nearly all ±1 semitone, which looks like
  drift rather than new notes.

## Which labels informed the design

- **Valhalla (design set).** All seven labels informed the design. The
  previous draft of the rise and flatness rules was written with them in view. I
  changed only the timing rule, and checked that against events.json on all
  three songs, not against labels.
- **The outcome is not knife-edge.** Any flatness threshold from 0.008 to 0.13
  and any minimum rise up to 7 dB gives the same result on these labels.
- **Trouble (check set).** Run only after the detector was fixed. It changed
  nothing in detection or salience. Its 0.86 s case did prompt reporting the
  `interval` field.

## Evaluation on the labelled cases

| song | t (label) | owner | current vocal event (peak / rise) | detector |
|---|---|---|---|---|
| Valhalla | 11.92 | heard "ho" | none (only "other" 0.10 / 0.09) | **note 11.96, C♯4, salience 0.54** |
| Valhalla | 12.56 | heard | 0.24 / 0.17 | note 12.57, 0.88 |
| Valhalla | 12.89 | heard | 0.17 / 0.12 | note 12.89, 0.77 |
| Valhalla | 13.20 | heard | 0.18 / 0.13 | note 13.22, 0.91 |
| Valhalla | 13.53 | **not heard** | 0.15 / 0.09 | **unpitched** (flatness 0.13), not a note |
| Valhalla | 17.75 | heard | 0.24 / 0.17 | note 17.77, 0.73 |
| Valhalla | 18.08 | heard "oh" | 0.14 / 0.09 | note 18.09, D♯4, 0.52 |
| Trouble | 0.1 | voice beat | 0.13: 0.19 / 0.19 | note 0.14, 0.35 |
| Trouble | 0.8 | voice beat | 0.85: 0.25 / 0.08 | note 0.86, G♯4 (+7 semitones), **0.11** |
| Trouble | 1.3 | voice beat | 1.30: 0.18 / 0.12 | note 1.30, 0.39 |
| Trouble | 1.7 | voice beat | 1.73: 0.26 / 0.12 | note 1.74, G4, 0.36 |

- **Valhalla.** All 7 are right: 6 heard notes found, the unheard one
  excluded. The current vocal events get 5 of 7: they miss 11.92 and include
  13.53.
- **Trouble.** All 4 are found. But 0.86 s gets a low salience (0.11): it is a
  7-semitone step with only a 3 dB rise, and salience does not count a change
  of pitch. That is the clearest known weakness.
- **These labels say nothing about precision elsewhere.** Only one unheard
  case is labelled.

## Valhalla 0–30 s: every detection

Unpitched attacks are listed too, because the owner should confirm them. The
"borderline" rows are the ones to check first by ear.

| t (s) | kind | salience | rise dB | share | flatness | voicing | pitch | events.json | |
|---|---|---|---|---|---|---|---|---|---|
| 0.07 | note | 0.76 | 22.4 | 0.76 | 0.000 | 0.89 | C♯3 | 0.058 bass+other+vocals |  |
| 0.65 | note | 0.48 | 8.4 | 0.69 | 0.003 | 0.93 | C♯4 | none |  |
| 1.08 | note | 0.33 | 4.5 | 0.89 | 0.004 | 0.85 | C♯4 | none |  |
| 1.65 | note | 0.47 | 6.1 | 0.94 | 0.003 | 0.85 | G♯4 | none |  |
| 4.17 | note | 0.97 | 22.5 | 0.97 | 0.012 | 0.48 | — | 4.156 other+vocals |  |
| 6.11 | note | 0.26 | 3.3 | 0.96 | 0.014 | 0.36 | — | 6.118 vocals |  |
| 6.76 | note | 0.95 | 12.2 | 0.95 | 0.017 | 0.37 | — | 6.745 vocals |  |
| 8.67 | note | 0.35 | 4.3 | 0.98 | 0.022 | 0.08 | — | none |  |
| 9.37 | note | 0.07 | 4.8 | 0.17 | 0.004 | 0.62 | C♯4 | 9.323 bass+drums+other |  |
| 10.00 | note | 0.24 | 6.6 | 0.44 | 0.004 | 0.82 | C♯4 | 9.973 vocals |  |
| 10.31 | note | 0.46 | 7.1 | 0.78 | 0.005 | 0.95 | C♯4 | 10.298 vocals |  |
| 10.63 | note | 0.77 | 10.2 | 0.90 | 0.003 | 0.94 | C♯4 | 10.612 vocals |  |
| 10.93 | note | 0.71 | 8.9 | 0.96 | 0.014 | 0.82 | C♯4 | 10.913 vocals |  |
| 11.27 | note | 1.00 | 14.6 | 1.00 | 0.014 | 0.87 | D♯4 | 11.262 vocals |  |
| 11.96 | note | 0.54 | 7.1 | 0.91 | 0.007 | 0.71 | C♯4 | 11.923 other |  |
| 12.57 | note | 0.88 | 10.9 | 0.98 | 0.005 | 0.98 | C♯4 | 12.562 vocals |  |
| 12.89 | note | 0.77 | 9.7 | 0.96 | 0.002 | 0.98 | C♯4 | 12.887 vocals |  |
| 13.22 | note | 0.91 | 11.2 | 0.98 | 0.002 | 0.96 | C♯4 | 13.201 vocals |  |
| 13.53 | unpitched | 0.73 | 8.8 | 0.99 | 0.132 | 0.28 | — | 13.526 vocals |  |
| 13.86 | unpitched | 1.00 | 12.8 | 1.00 | 0.084 | 0.08 | — | 13.851 vocals | borderline |
| 14.04 | note | 0.62 | 7.4 | 1.00 | 0.045 | 0.43 | — | 14.036 vocals | borderline |
| 14.20 | note | 0.26 | 3.1 | 1.00 | 0.031 | 0.87 | E4 | 14.211 other | borderline |
| 14.51 | note | 0.37 | 4.7 | 0.95 | 0.002 | 0.98 | E4 | 14.501 other+vocals |  |
| 15.17 | note | 0.48 | 6.8 | 0.85 | 0.004 | 0.53 | E2 | 15.174 vocals |  |
| 15.49 | note | 0.21 | 3.2 | 0.77 | 0.004 | 0.55 | E2 | 15.488 vocals |  |
| 15.84 | unpitched | 0.77 | 10.0 | 0.92 | 0.080 | 0.02 | — | none | borderline |
| 16.14 | note | 0.89 | 10.9 | 0.98 | 0.008 | 0.87 | B3 | 16.138 vocals |  |
| 16.42 | note | 0.99 | 11.9 | 1.00 | 0.004 | 0.80 | E4 | 16.393 vocals |  |
| 17.10 | note | 0.64 | 8.8 | 0.87 | 0.003 | 0.98 | D♯4 | 17.09 other+vocals |  |
| 17.77 | note | 0.73 | 9.7 | 0.90 | 0.004 | 0.98 | D♯4 | 17.752 vocals |  |
| 18.09 | note | 0.52 | 7.5 | 0.83 | 0.007 | 0.95 | D♯4 | 18.077 vocals |  |
| 18.41 | note | 0.99 | 18.6 | 0.99 | 0.002 | 0.95 | D♯4 | 18.402 vocals |  |
| 19.05 | note | 0.37 | 4.5 | 1.00 | 0.027 | 0.24 | — | 19.029 bass+other+vocals | borderline |
| 19.70 | note | 0.15 | 3.7 | 0.48 | 0.013 | 0.49 | — | 19.691 vocals |  |
| 20.38 | note | 0.62 | 13.1 | 0.62 | 0.010 | 0.66 | C♯4 | 20.364 vocals |  |
| 20.69 | note | 0.74 | 12.5 | 0.74 | 0.015 | 0.85 | C♯4 | 20.677 vocals |  |
| 21.03 | unpitched | 0.80 | 13.0 | 0.80 | 0.102 | 0.11 | — | 21.002 vocals |  |
| 21.32 | unpitched | 0.95 | 13.5 | 0.95 | 0.170 | 0.01 | — | 21.304 bass+vocals |  |
| 21.44 | unpitched | 0.43 | 5.9 | 0.89 | 0.150 | 0.01 | — | 21.432 vocals |  |
| 21.64 | note | 0.89 | 11.2 | 0.96 | 0.046 | 0.57 | E3 | 21.629 vocals | borderline |
| 21.98 | note | 0.83 | 10.4 | 0.95 | 0.009 | 0.62 | D♯3 | 21.966 vocals |  |
| 22.29 | note | 0.26 | 3.6 | 0.87 | 0.010 | 0.76 | E3 | 22.28 vocals |  |
| 23.28 | note | 0.15 | 7.1 | 0.26 | 0.010 | 0.62 | C♯4 | 23.266 vocals |  |
| 23.61 | unpitched | 0.71 | 13.1 | 0.71 | 0.180 | 0.01 | — | 23.591 vocals |  |
| 23.92 | unpitched | 0.61 | 7.7 | 0.94 | 0.064 | 0.01 | — | 23.905 vocals | borderline |
| 24.07 | unpitched | 0.52 | 6.7 | 0.94 | 0.172 | 0.01 | — | 24.056 vocals |  |
| 24.25 | note | 0.98 | 17.1 | 0.98 | 0.011 | 0.76 | E3 | 24.242 vocals |  |
| 24.90 | note | 0.27 | 3.6 | 0.91 | 0.024 | 0.62 | E3 | 24.892 bass+other+vocals |  |
| 25.88 | note | 0.17 | 5.0 | 0.41 | 0.027 | 0.21 | — | none | borderline |
| 26.21 | unpitched | 0.53 | 15.6 | 0.53 | 0.266 | 0.01 | — | 26.192 vocals |  |
| 26.49 | unpitched | 0.96 | 12.6 | 0.96 | 0.076 | 0.05 | — | 26.482 vocals | borderline |
| 26.66 | note | 0.99 | 13.1 | 0.99 | 0.017 | 0.28 | — | 26.645 vocals |  |
| 29.09 | note | 0.31 | 3.9 | 0.95 | 0.005 | 0.83 | D♯3 | none |  |
| 29.39 | note | 0.34 | 4.2 | 0.97 | 0.045 | 0.41 | — | 29.373 vocals | borderline |
| 29.77 | note | 0.30 | 3.7 | 0.95 | 0.034 | 0.62 | C♯4 | none | borderline |

**Against the current vocal events (0–30 s): 44 notes vs 61 vocal events.**

- **Added** (a note with no vocal event within 50 ms):
  - 11.96, the heard "ho";
  - 14.20 (E4, borderline), whose event exists only in "other";
  - 9.37 (salience 0.07, under the 9.3 s drum hit);
  - seven with no event at all: 0.65, 1.08, 1.65, 8.67, 25.88, 29.09 and
    29.77. These cannot be referenced from music.ts until an event exists.
    0.65–1.65 and 8.67 are slow swells. 1.65 and 8.67 are probably the same
    sounds as the events at 1.463 and 8.58, timed differently.
- **Dropped as unpitched:** 13.53 (the unheard one), 13.85, 21.00, 21.30,
  21.43, 23.59, 23.91, 24.06, 26.19 and 26.48.
  - Several of these are loud: rises of 0.17–0.29, and 13.85, 21.30 and 26.48
    have salience above 0.9 if they were notes.
  - In 21–27 s they come 150–350 ms before a pitched note, and the mix shows
    broadband bursts. They look like consonants or vocal percussion. No drum
    is measured there.
  - **This is the biggest open question for the owner's ear.**
- **Dropped with no attack:** 17 events with a rise under about 3 dB (0.26,
  2.25, 11.11, 11.44, 11.74, 14.35, 15.70, 15.89, 16.29, 18.88, 19.53, 24.56,
  27.16, 27.48 and others). All have an events.json rise ≤ 0.09,
  i.e. fluctuations inside held notes.

## Circus Minimus (77 s, unconfirmed whether the voice is a singer)

153 notes and 39 unpitched attacks. Odd things:

- **The vocal stem is a small part of the mix.** The median share is 0.38,
  against 0.94 on Valhalla and 0.68 on Trouble. So only 10% of its notes reach
  salience 0.5, and none do in 0–20 s.
- **0–12 s is one high figure,** repeated on D5, D♯5 and F5 with shares of
  0.05–0.4. Nothing in it would be landed on, by salience.
- **70 of 192 attacks are borderline** on flatness (vs 20 of 77 on Valhalla),
  so the pitched/unpitched split is least reliable here.
- **More notes match only an "other" event** (11 vs 4 on Valhalla). That fits
  a sound Demucs splits between stems.
- **Singer or synth is not decided.** Held-note pitch spread (median 7.5
  cents) and frame jitter are no different from Valhalla's steady chant, so
  these measures cannot tell a singer from a synth lead. Only listening can.

## Not verified

- Whether the 10 unpitched Valhalla attacks (above) are heard as words.
- Whether the 0–2 s swells (0.65, 1.08, 1.65) are separate words, and whether
  the onset of a slow swell is placed where it is heard.
- Salience as a ranking. It is only checked to put the heard notes above the
  noise; it was never compared with the owner's sense of "how clearly".
- A voice that Demucs puts entirely in "other". It would be missed, and no
  labelled case exists.
- Trouble beyond its first 2 s.

## Run

    ~/.venvs/line-stems/bin/python tools/music/sung.py --song=<song> [--contacts=FILE.json] [--no-sheets]

Needs `generated/stems/<song>/` from `stems.py` (and `drums.json` for the
sheets). It takes about 10 s. It redraws the 5-second sheets with the notes
on the vocals lane: triangles, higher and darker when more salient; crosses
for unpitched attacks.

## November 1: external-reference experiments

### Optional word hypotheses and external references

An exploratory November 1 run compared faster-whisper 1.2.1 with cached
`medium` and `large-v3` weights on five existing songs, both original mix and
Demucs vocal stem (20 runs). Fixed settings: beam size 5, temperature 0, word
timestamps enabled, VAD disabled, previous-text conditioning disabled, automatic
language detection, no lyric prompt. Crops: Circus 35–52 s, Trouble 0–20 s,
Valhalla/Luna Bala/Tiki Tiki 10–25 s. Results retain model revision, input hash,
settings and original-audio timestamps. These songs are exploratory material,
not a representative accuracy benchmark.

Circus, Trouble and Valhalla produced broadly similar phrase hypotheses across
runs. Circus matching normalized text tokens differed between models by a
median 220 ms in word-start time, for both mix and vocals. Token matching was
order-preserving; repeated words can be paired ambiguously. This is model
**disagreement**, not measured error. Luna Bala and Tiki Tiki produced conflicting
language hypotheses and suspicious generic subtitle/closing phrases. Even two
models agreeing on a phrase does not verify it. Word probabilities are not
calibrated timing confidence, and zero-duration words must remain visible as
limitations rather than silently repaired.

WhisperX 3.8.6 with the English `WAV2VEC2_ASR_BASE_960H` aligner was then tried on
Circus, freezing the unverified large-v3 mix transcript for both audio inputs,
without reading listener marks. Interpolation was disabled; word and character
outputs were retained. Aligning the whole 17-second crop produced a median
mix/stem word-start disagreement of 360 ms (maximum 761 ms). Using the same five
ASR phrase windows for both inputs reduced this to 181 ms (maximum 664 ms).
Both conditions timestamped all 55 words: output completeness does not imply
correctness. Shared transcripts/windows constrain agreement and cannot validate
the words themselves. Character timings are model alignment estimates, not
verified phoneme or syllable boundaries.

Use recognition to propose **what may have been sung**; review the wording by
listening before using forced alignment to investigate **where it may occur**.
Keep each run separately identifiable, expose disagreements and missing evidence,
and retain the original audio and listener notes. Word boundaries need not be
the articulations we choose to follow: one word can contain several syllables.
Do not average these sources into a confidence score or create impacts from them.
The current experiment does not add ASR hypotheses to the dashboard or spec.

Artifacts and reproducible scripts are local under
`generated/circus-voice-review/asr-experiment/`: `manifest.json`, individual runs,
`comparison.json`, `circus-marks.tsv`, `run.py`, `compare.py`, and `alignment/`.
The TSV uses nearest timestamps only; it is not a verified word-to-mark mapping.
Scripts use isolated temporary Python environments and do not alter runtime
project dependencies. Model capabilities and limitations:
[faster-whisper](https://github.com/SYSTRAN/faster-whisper),
[WhisperX](https://github.com/m-bain/whisperX).

The accompanying osu investigation found no matching map in official logged-in
searches by exact title or artist. This does not establish that none exists.
The [publisher listing](https://music.apple.com/us/song/1558985237) identifies
JVZEL & Neon Haze's Circus Minimus; its official preview matched our audio with
0.9884 normalized waveform correlation after mono 8 kHz decoding, without time
stretching. This identifies shared recording material, not the clip's offset
within the full song. Search and waveform-check artifacts live under
`generated/circus-voice-review/osu-reference/`.

If a matching map becomes available, verify the audio edit, rate and offset
before comparing its hit times. Preserve mapper and difficulty separately: maps
express gameplay and artistic interpretations, not verified vocal events. See
[osu file format](https://osu.ppy.sh/wiki/en/Client/File_formats/osu_(file_format)).
