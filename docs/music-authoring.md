# Authoring a spec from music

How a song becomes a spec: which moments the rider lands on, how hard, and what
air and speed do in between. This replaces the June guide
(`docs/creative_workflow.md` at tag `archive/pre-rework-2026-10-03`), whose
reading of the analysis layers still applies but whose single-mix tooling
proved insufficient on `productions/trouble_50s`.

## Principles

- **Tools report; the author concludes.** Analysis tools measure and report
  (onsets, loudness, drum classes, sung notes with pitch and salience). They
  don't decide what to follow: no "this is the lead voice" or "land here". The
  author (Claude, with the owner) reads everything and makes the artistic
  choices.

- **Tools measure; the author decides.** No script chooses landings. A spec is
  a list of deliberate, visible decisions, each traceable to measured evidence.
- **Events first, never a grid first.** Know what each landing follows: a kick,
  a snare, a bass entry, a vocal phrase start. A beat grid is a tempo
  hypothesis; on Trouble it was half-time, out of phase with the kicks, and
  blind to a 3-3-2 kick pattern that no regular grid fits.
- **Read the instruments, not frequency bands of the mix.** A near-zero
  sub-band does not mean no beat (Trouble's intro is led by the voice; its
  outro kicks barely register below 140 Hz). Onset strength is novelty, not
  loudness. A hit over a sustained instrument barely moves the mix but is
  plainly audible in its own stem.
- **The owner's ear is the final check.** Clicks at every landing, played over
  the music, make misses audible.

## Setup (once per machine)

Three environments, because the tools pin incompatible libraries:

```sh
# analyze_audio.py: madmom + librosa (reproduces the committed analyses exactly)
uv venv --python 3.10 ~/.venvs/line-audio
uv pip install --python ~/.venvs/line-audio/bin/python "cython<3.0" "numpy==1.23.5" "scipy<1.11" "setuptools<81" wheel mido
uv pip install --python ~/.venvs/line-audio/bin/python --no-build-isolation madmom
uv pip install --python ~/.venvs/line-audio/bin/python "librosa==0.10.2" matplotlib pillow

# stems.py and events.py: Demucs (CPU is fine, about 1 min per 50 s)
uv venv --python 3.11 ~/.venvs/line-stems
uv pip install --python ~/.venvs/line-stems/bin/python demucs soundfile librosa "numpy<2" matplotlib

# drums.py: ADTOF drum transcription (TensorFlow with Keras 2)
uv venv --python 3.10 ~/.venvs/line-adtof
uv pip install --python ~/.venvs/line-adtof/bin/python "git+https://github.com/MZehren/ADTOF.git" pretty_midi
uv pip install --python ~/.venvs/line-adtof/bin/python "tf_keras~=2.21.0"   # match the installed tensorflow
```

## Steps

1. **Excerpt and describe.** Put the excerpt at `productions/<song>/audio.mp3`.
   Then:
   - `~/.venvs/line-audio/bin/python scripts/analyze_audio.py --audio productions/<song>/audio.mp3 --out productions/<song>/audio.json`
     gives a tempo hypothesis and energy layers;
   - `~/.venvs/line-stems/bin/python tools/music/spectrogram.py --song=<song>`
     gives the dashboard spectrogram.
2. **Separate the instruments.**
   - `~/.venvs/line-stems/bin/python tools/music/stems.py --song=<song>` gives
     drums, bass, vocals and other, each with a loudness envelope and onsets.
   - `~/.venvs/line-adtof/bin/python tools/music/drums.py --song=<song>` labels
     each drum hit kick, snare, hat, tom or cymbal. It gives no velocities.
3. **List the events and draw the sheets.**
   `~/.venvs/line-stems/bin/python tools/music/events.py --song=<song>` writes
   `productions/<song>/events.json`: every onset in any instrument, with each
   instrument's loudness and rise. It also draws 5-second sheets in
   `generated/stems/<song>/sheets/`.
   If a voice leads anywhere, then run
   `~/.venvs/line-stems/bin/python tools/music/sung.py --song=<song>`. It writes
   `productions/<song>/sung.json`: the sung notes with a salience, and the
   unpitched attacks (breaths, consonants) that `events.json` lists as vocal
   onsets. It redraws the sheets with the notes on the vocals lane. A note
   names its `events.json` event, by which music.ts references it. Prefer
   notes to raw vocal onsets; `docs/research/sung-notes-20261031.md` says
   where it is unverified.
4. **Read the whole song before writing anything.** Go through every sheet and
   write the structure down in the spec's header. For each section, record:
   - which instrument leads;
   - the pattern (Trouble: 3-3-2 kicks, stop-and-go phrases);
   - the breaks, drops and re-entries.
5. **Write the song's layers, then the variants.**
   - In `productions/<song>/music.ts`, list the song's layers by hand, section by
     section, as measured event times: for example the kicks, the cycle starts,
     the pickups, the voice syllables. It looks each one up in `events.json` and
     fails on a time that is not an event.
   - Each `variants/<name>.ts` is a whole spec chosen from those layers:
     landings, strengths, air, speed and camera. Make as many as the song
     suggests distinct readings (Trouble: kick, voice, slam, pulse); there is
     no fixed set. `spec.ts` re-exports the one currently preferred.
   - Variants are drafts to compare and merge with the owner, not a version
     history: edit, delete or combine them freely.
   - Derive strength from the leading instrument's measured loudness; pin only
     structural moments (the drop).
   - Write down every event deliberately not landed on, with its reason.
6. **Resolve the coverage report.** Run
   `node tools/music/coverage.ts --song=<song> --contacts-out=generated/stems/<song>/contacts.json`.
   It flags:
   - unlanded events stronger than the weakest landing within 2 s;
   - landings beaten by a neighbour within 0.35 s;
   - landings on no event.

   Add `--variant=<name>` for a variant. Every flag gets a decision: land it,
   or keep its reason in the spec. Then
   rerun `events.py --contacts=…` and check the landings on the sheets.
7. **Listen.** Open the spec dashboard,
   `http://<host>:8767/spec-dashboard/?spec=productions/<song>/spec.ts`
   (`HOST=0.0.0.0 npm run serve`):
   - the **events** lane shows each event in its instrument's colour (drums red,
     bass blue, vocals orange, other green);
   - **Clicks** plays a click at every landing, scheduled on the music's own
     clock, so a click sounds exactly where its landing falls in the music;
   - the cursor sits at the position you hear (output latency included), so a
     note placed when you pause takes the time you heard;
   - the spec menu lists each variant;
   - notes snap to measured events and are saved, per song, to
     `productions/<song>/notes.json`.
8. **Compile and review rides.** Run
   `npm run produce -- --song=<song> [--variant=<name>] --seed=<n> --out=DIR` (add the song to
   `scripts/gallery/repertoire_catalog.ts`). Do not edit tracked files while it
   runs: its compiler identity check rejects the result.

## What read well on Trouble (owner reviews, October 2026)

Observations from one song, not rules. Variants live in
`productions/trouble_50s/variants/`; the preferred one is `contrast-clusters`.

- **Follow the loudest layer at each moment.** The voice where it is alone,
  the drums once they play. Syllables landed under the drums looked off the
  music (the `voice` variant).
- **Follow a voice by its phrases, not its syllables.** Close hits where words
  come fast, long low rides on held notes. A landing on every syllable became a
  grid.
- **Land only on sounds you can hear.** A landing is a visual statement:
  - A soft landing on a faint sound (Trouble's groove pickups, about a seventh
    of a kick) still reads as noise.
  - Density also caps the air, so a dense spec becomes long rails (`pulse`).
- **Short audible pairs are the strongest moments:**
  - The three-kick clusters, plus the snare right after them.
  - "boom-TAK": a heavy kick, then a snare 0.22 s later.
  - "ta-BOOM": a bass entry just before a heavy kick.
  - Seen as an upper hit then a bottom hit, they read as two beats. They are
    also the hardest thing for the compiler: most failed compiles stop at one
    (about half of the seeds finish).
- **Big floats belong in calm moments.** A long air into the drop felt wrong
  because the music before it is busy; three small hits gaining speed worked.
  A float over a quiet drum swell worked.
- **Speed up where the music is intense** (the drop).
- **Score does not predict taste.** The variant with the best impact score was
  the least liked. Clean and on the beat is not enough either: `slam` was both,
  and too empty.
- **There is no single right spec.** Several readings of one song can be very
  good.

## What read well on Valhalla and Circus Minimus (October 2026)

- **Valhalla (40 s): `words3` was "basically production ready".**
  - It follows the voice by its heard words: close hits on fast words and
    "oh-oh-oh"s, with long rides on held notes.
  - Its words come from `sung.py`, with the owner's corrections.
  - Where two voices sing, following the more interesting one, even switching
    between them, read well.
- **When the voice is most of the song, commit to it.** Words should be clear
  hits (0.2–0.35), not touches.
- **After a soft opening, make everything a little bigger,** so the contrast
  shows.
- **"Calm" means quiet, not few instruments.** Circus Minimus' intro is an 808
  alone, and strong: soft floats there missed the music.
- **Don't let a layer's name decide its role.** Circus' voice-led 38–49 s is
  the song's most intense part. Read what the music does there.
- **Short audible pairs are what the compiler cannot yet do reliably.**
  - Circus `pairs3` finished 1 seed in 24.
  - `pairs4`, the intended spec (voice-only 38–49 s, bigger hits), finished 0
    in 24, failing at its 0.2 s pickups and 0.2 s word gaps.
  - Keep such specs as targets rather than simplifying them silently.

## What the rider can do (current compiler, October 2026)

- **Spacing.**
  - Landings 0.33 s apart are feasible, but strength there caps near 0.55–0.75.
  - Landings 0.21 s apart are feasible (Trouble pulse: light pickups at
    0.06–0.21 before kicks at 0.38–0.50), but a groove full of them can run
    out of budget (one of two seeds failed).
  - The first landing must come at about 0.2 s or later. Landings at 0.13 s
    and at 0.17 s (0.19 s once the −15 ms jolt is applied) both failed with
    `no_arc`.
- **Room makes a slam.** A float into a big hit (Trouble's drop after a 1.8 s
  break) reaches 0.97–0.98.
- **Quiet.** Gentle touches read about 0.05–0.15; requests below about 0.05
  sit at the floor of any touchdown.
- **The last landing** can be 0.23 s before the clip ends (Trouble's 50.07
  landed at 0.53–0.76 on every variant).
- **Long floats** can pick up unrequested knocks (slam, 3.85 s: 0.38).

## New music is held out

New songs are the only test of whether the compiler generalizes. Author them
freely, but do not tune the compiler on them. Keep at least one new song
untouched by any compiler decision.

## Descriptive vocal evidence (November 2026)

Use the existing spec dashboard, not a separate authoring workflow. Its source
lanes retain every measured instrument at its own timestamp. A coincident drum
no longer conceals the vocal observation. Event snapping remains optional;
unsnapped listener marks are approximate observations, not exact ground truth.

To add continuous evidence after stem separation and optional `sung.py` analysis:

```sh
python tools/music/vocal_evidence.py --song circus_minimus_77s
```

Requires NumPy, librosa (tested with 0.11.0), ffmpeg, the production audio, and
`generated/stems/<song>/{vocals.wav,stems.json}`. Produces
`productions/<song>/vocal-evidence.json`, readable by an agent and the dashboard.
The dashboard checks recorded source/code hashes and refuses stale evidence.
These checks detect changed files; they cannot prove that stem separation was
correct or that a supplied stem originally came from the supplied recording.

The measurements use identical settings for every song: 22,050 Hz mono,
1,024-sample centered windows, 256-sample steps (46.4 ms windows, 11.6 ms steps).
RMS is linear amplitude, without song normalization. Spectral change is cosine
distance between successive Hann-window magnitude spectra at 200–6,000 Hz;
missing/silent comparisons are null. Plot scales are fixed across zoom levels
and shown beside each trace. Window centers are not vocal onset boundaries.
Zero padding affects the first/last half-window. Gain invariance only applies
above the numerical silence floor. A nearly silent spectrum can have a large
shape change, so read it alongside RMS and listen.

All raw vocal onset estimates and both existing sung classifier outputs remain
available. The UI labels them onset, tonal and noisy estimates. These are not
words, speaker identities, confidence probabilities or impact suggestions.
The separated stem may mix several voices and retain instrumental leakage.
No measurement or candidate selects the artistic focus or changes a spec.
Copied agent context includes the current measurement window, nearby source
observations and the evidence file URL; the file contains all candidates and
measurement definitions for further inspection.

Validation used one fixed implementation on Circus, Trouble, Valhalla, Luna
Bala and Tiki Tiki, without per-song parameter changes. Browser checks verified
that every source observation and candidate within the spec duration survived
into the display. Vocal source observations previously visible versus retained:

| Song | Previously visible | Retained |
| --- | ---: | ---: |
| Circus | 223 | 310 |
| Trouble | 123 | 160 |
| Valhalla | 75 | 87 |
| Luna Bala | 60 | 118 |
| Tiki Tiki | 96 | 122 |

These counts measure information preservation, **not word-detection accuracy**.
Of the owner's 39 approximate Circus marks, 16 have an existing candidate
within 30 ms, 27 within 50 ms and 32 within 80 ms. Seven still lack a candidate
within 80 ms. This is a diagnostic proximity check: marks are uncertain,
unmarked times are not negative labels, and neither precision nor recall can
be inferred from it. Continuous evidence exposes additional changes for
inspection; it does not establish that those seven articulations are resolved.
Circus and previously inspected Trouble/Valhalla passages are development
material. Luna Bala and Tiki Tiki check cross-song operation, not held-out
perceptual accuracy. Broader listening with independently annotated passages
is needed before making a vocal-alignment accuracy claim.

Reproducible checks:

```sh
python -m unittest discover -s tests -p test_vocal_evidence.py
npx vitest run tests/music_evidence.test.ts tests/vocal_evidence_provenance.test.ts
node tests/browser/vocal-evidence.mjs http://127.0.0.1:8771
node tests/browser/spec-listening.mjs http://127.0.0.1:8771
```

Synthetic checks cover silence, uniform gain, constant-amplitude timbre changes,
centered impulse support and invalid inputs. Browser checks are read-only or
intercept note writes in memory; they never edit the owner's annotations.

### Acoustic landmarks and band measurements

The evidence builder now adds two descriptive fields while preserving all
existing candidates, times, RMS values and spectral-shape values:

- Each candidate has `landmarks`: the preceding local RMS minimum (librosa
  backtracking), and the steepest positive linear RMS rise between that minimum
  and the candidate's nearest measurement frame. A flat/falling interval has no
  rise landmark. A clip-start fallback is explicit. These are frame-centered
  measurements, not onset boundaries, a confidence interval or a corrected time.
- `bandFlux` contains three continuous mean-positive log-mel changes, in
  dB/frame. One 64-filter Hann-window mel spectrogram supplies all three groups,
  using filter centers at 80–1000, 1000–3000 and 3000–8000 Hz. Filter supports
  overlap the boundaries. There are no consonant/vowel labels or event picks.

The existing 1024-sample window and 256-sample step remain fixed across songs.
Log power uses reference 1, floor 1e-10 and no relative dB clipping. Differences
are placed at the later of the adjacent centered STFT frames, without an extra
onset-detector compensation shift. The first difference is unavailable. Values
are not normalized per song; gain invariance only holds above the power floor.
Quiet spectral components can still show large relative changes.

The existing dashboard shows band values in the cursor inspector and acoustic
landmarks in candidate tooltips. Copied agent context includes nearby candidates
and their landmarks. No extra permanent timeline lanes or automatic impacts were
added; the original candidates still determine what their existing dots mean.

Checks used fixed settings on all five songs above: all 1,413 candidates and
all existing continuous values were preserved exactly. Of those candidates,
79 have no positive RMS rise in the inspected interval; this is reported as
unavailable rather than filled with a guessed time. These counts are diagnostics,
not detection accuracy. The builder took roughly 0.1–0.3 seconds per song in the
warm local experiment, including decoding; first imports/JIT can take longer.

Synthetic tests cover silence, gain, an impulse, a constant-power harmonic
change, a sustained tone and vibrato. Windows of 512/1024/2048 samples were
examined without selecting a winner on listener annotations. The impulse check
confirmed librosa's additional onset compensation shifts a peak by respectively
11.6/23.2/46.4 ms relative to the centered-frame measurements. This is a timing
convention, not proof of an error in the existing detector: centered windows can
respond before the true attack. No global correction was applied.

Vibrato produces substantial band flux despite having no new syllable. Shorter
windows also trade frequency resolution for timing localization. These findings
are why the new outputs remain measurements rather than new vocal detections.
Fewer missed syllables or better perceptual alignment have **not** been established.
That needs a small reviewed set of real passages including non-attacks, not just
proximity to the owner's approximate, non-exhaustive positive marks.

The bounded study, its frozen settings, before/after preservation checks and
results are in `generated/circus-voice-review/acoustic-experiment/` (`run.py`,
`plan.json`, `results.json`, `before/`). The Python tests above now also exercise
landmarks, band silence/gain behavior and timing at all three window sizes.

Exploratory ASR, alignment and external-reference findings are recorded in
[the sung-notes research log](research/sung-notes-20261031.md#november-1-external-reference-experiments).

## Circus voice + drums specification

`productions/circus_minimus_77s/variants/voice-drums.ts` is the owner-approved voice-and-drums variant,
leaving the preferred spec and previous voice-led draft intact. It changes only
38.4–47.5 s: vocal articulations provide the phrase, percussion-only events fill
rhythmic positions, and close voice/drum pairs share a firmer drum contact. Bass
is not a selector. Each of the 39 contacts records its measured source and role;
one sung-only event at 42.632 s supplements the source-event data. A drum label
does not prove a sung word. No synthetic grid or minimum compiler spacing is used.

The author had already seen the owner's notes: this is **not a blind test**.
The draft was hashed before the note comparison and was not retuned afterward.
Ordered one-to-one matching against 39 approximate marks gave:

| Tolerance | Previous voice-led | New voice + drums |
| --- | ---: | ---: |
| 30 ms | 10 | 28 |
| 50 ms | 16 | 36 |
| 80 ms | 24 | 39 |

The previous draft had 24 contacts in this interval; the new one has 39. At
80 ms every new contact and mark participates in exactly one match. The marks
are non-exhaustive: unmatched contacts at narrower tolerances are not necessarily
false positives. This correspondence does not establish perceptual quality,
statistical significance, generalization, or compiler feasibility. Strengths are
authored (vocal-only roughly 0.48–0.62, drum/shared 0.62–0.78) and were subsequently reviewed through the generated video below. This
annotation comparison alone does not establish compiler feasibility.

The existing spec dashboard loads this variant for click audition at reduced
speed. The frozen hash, source contacts, comparison script and complete pairings
are local under `generated/circus-voice-review/voice-drums/`.

Generation follow-up: four standard-budget seeds (101/202/303/404), then 101 and
404 at twice the allowance, all completed the full 77.09-second song under the
current strike-v3 account and fulfilled their construction plans. All six matched
39/39 hook targets; this is evaluator matching, not proof of perceptually strong
hits. The larger allowance did not improve hook strength error. All outcomes
remain in `generated/circus-voice-review/voice-drums/collection.json` with saved
compiler/input identities; the specification and original playback speed were
unchanged.

The initial six-run review suggested seed 404 at standard budget: hook
mean absolute timing offset 21.2 ms relative to quantized/jolt-adjusted compiler
targets (maximum 50 ms), two extra detected hook impacts, mean achieved strength
0.381 versus 0.615 requested. Eleven of 39 hook hits measure below 0.25. Shared
voice/drum contacts average 0.592 achieved versus 0.715 requested; vocal-only
contacts 0.284 versus 0.544. This is a useful compiler test case, not a claim of
finished musical quality. The older landing ruler does not validate these rides;
its results are preserved alongside the current account in the generation summary.
`generation-summary.json` now retains all twelve outcomes and the exploratory selection
policy; `seed-404-hook.json` records each authored target and realized event.

Vertical-video follow-up: six fresh seeds (505/606/707/808/909/1001) at 7,917,750
frames completed, bringing the exploratory set to 12 runs across allowances of
5,278,500 / 7,917,750 / 10,557,000 frames. Actual work remained 4.79–5.00 million
frames. None of the fresh runs improved hook strength RMS; seed 101 at standard
budget was selected for the video on that criterion (404 retains the better
overall score). Selection and all outcomes are preserved in `video-selection.json`.

The existing production pipeline rendered 1080×1920 at 60 fps with its established
camera, spectrum and effects. The master and 11-second hook excerpt are available
as `vertical.mp4` and `hook.mp4` in the collection folder. Sample frames were
inspected, full decoding checked, and direct VPN playback/seeking exercised.

Audio QA found a constant ~42.6 ms lag in the initial rendered master relative to
the original recording. A final mux of the original audio repaired the delivered
master without changing its encoded video packets. Three independent 5-second
windows at 5/39/68 seconds then showed zero best lag at 8 kHz and correlations
above 0.99. Original render metadata/full video are retained; the current video
sidecar records the explicit audio repair and points to `video-aligned.mp4`.
The bundle and dashboard use that aligned master, and excerpts were regenerated.
This is an artifact repair, not a general pipeline fix: the precise stage causing
the original delay has not been isolated. See `audio-lag-check.json`,
`audio-aligned-check.json`, and the video sidecar's `audioRemux` field.

The owner accepted the voice-and-drums specification after watching the final
video. It remains a separately named variant: the default and benchmark specs
are unchanged. `notes.json` preserves the original approximate listening marks.
Generated media and run artifacts remain local, outside Git; the committed
specification, source evidence and tests preserve the authoring work.

Integration check after rebasing onto `44c00256` (`rework/foundations`):
335 TypeScript tests and 11 Python tests passed, as did type checking,
reachability, the five-song browser checks, listening controls and judge parity
(33 tracks). Compile parity still differs from 44 committed references. A fresh
63-cell compile on the untouched upstream checkout produced exactly the same
track hashes and physical-frame counts as this branch in every cell, using the
rebuilt WASM engine. These are pre-existing reference mismatches; no reference
fixtures were changed. The accepted spec still matches its pre-generation hash.

## Music-library listening drafts (November 2026)

The 22 recordings supplied in `~/prog/double-pendulum/music/tracks/` now have
separate `_selection` productions, including the alternate-speed recordings.
These are **first listening drafts**, not owner-approved successors to the Circus
specification. No benchmark or held-out panel was changed. Original files remain
untouched; excerpts retain their original speed and are single contiguous cuts.

For each recording, the author inspected the full separated-stem envelopes,
chose a passage with an arrangement change, then read the source onsets and
vocal-attack estimates. `composition.json` records explicit selected times,
source, impact and the reason for each group, plus air/speed phases. The small
`spec.ts` adapter only reads these decisions; it does not select events.
`source.json` records the source hash, original-recording excerpt boundaries,
excerpt/stem hashes and separation settings. The tempo grid is only a librosa
hypothesis; it does not generate contacts. Drum classes were not measured.

Musical intentions and limitations:

- Passo Bem Solto and Los Voltaje alternate exposed vocal articulation with
  stronger percussion. Slower versions were read independently, not made by
  scaling another spec's timestamps.
- Funk Estranho follows the measured bass pulse; Funk do Bounce changes lead
  from voice to bass, then to drums and an upper instrumental figure.
- Dernière danse, Bones and Let the World Burn use amplitude-attack evidence
  alongside raw vocal events. A sustained note's many spectral changes are not
  treated as verified syllables. The exact vocal choices need listening review.
- Petrunko's selected passage is treated as instrumental; stem labels are not
  used to invent lyrics or singer identities.
- Raw coverage reports flag unselected material in every song. Strong percussion
  omissions were checked: clipped entrance attacks are explicitly omitted, and
  Lua na Praça uses the later of two nearby detections for the same entry. Other
  flags largely concern competing layers, subdivisions and sustained texture;
  they remain listening questions, not a requirement to maximize coverage.

All drafts are available in the existing spec dashboard's selector. Keep Clicks
enabled to audition the authored rhythm; slow playback or add unsnapped marks
where a phrase needs correction. Start with the three contrasting readings
`let_the_world_burn_selection`, `funk_do_bounce_super_slowed_selection` and
`derniere_danse_coral_selection`. Browser playback checks establish that audio
and controls work, not that the interpretation is perceptually correct.

| Recording | Original recording excerpt (s) | Length (s) |
| --- | ---: | ---: |
| LOS VOLTAJE | 34–91.4 | 57.4 |
| LUNA BALA (Slowed) | 40–96 | 56 |
| MONTAGEM TOMADA (Slowed) | 22–80 | 58 |
| Amor Na Praia | 49–109 | 60 |
| LOS VOLTAJE (Slowed) | 39–97 | 58 |
| FUNK ESTRANHO (Super Slowed) | 33–92 | 59 |
| PASSO BEM SOLTO (Slowed) | 43–101 | 58 |
| MXZI — MONTAGEM TOMADA (Extended) | 181–240 | 59 |
| LUNA BALA | 46–104 | 58 |
| MONTAGEM TOMADA (Super Slowed) | 32–92 | 60 |
| PASSO BEM SOLTO | 35–91 | 56 |
| LOS VOLTAJE (Ultra Slowed) | 58–118 | 60 |
| PASSO BEM SOLTO (Super Slowed) | 47–107 | 60 |
| FUNK DO BOUNCE (Super Slowed) | 60–120 | 60 |
| Dernière danse × Montagem Coral | 78–138 | 60 |
| ANDROMEDA — MONTAGEM COMA | 14–73 | 59 |
| NO BATIDÃO | 30–89.5 | 59.5 |
| NO BATIDÃO (Slowed) | 48–107.5 | 59.5 |
| LUA NA PRAÇA | 29–81 | 52 |
| Chris Grey — LET THE WORLD BURN | 104–163 | 59 |
| Bones | 105–165 | 60 |
| Petrunko | 76–136 | 60 |

The checked-in manifest is `productions/music-library.json`. Local study material
(full-recording overview plots, extraction/analysis scripts, coverage reports and
browser screenshots) lives in `generated/music-library-authoring/`. Audio and
full stem WAVs remain untracked. To reconstruct an excerpt, decode the exact
source file identified by its hash, trim at the recorded start for the recorded
length, and encode with `libmp3lame -q:a 2`; never rescale the timing. The stems
were separated from the full recording before cropping, avoiding crop-edge
separation differences. Regenerate descriptive evidence if any input changes.

The dedicated spec tests check all recordings, source-time provenance, distinct
physics frames, excerpt bounds, phase/axis validity and audio identity when the
local file is present. They do not certify musical quality.

Integration validation on `a9b4178a`: the full suite passed 358 tests; all 22
dashboard pages loaded their verified evidence and exercised playback. Type
checking, reachability and judge parity (33 tracks) passed. Compile parity has
47 saved-reference differences, but a fresh run on the untouched upstream
checkout produced exactly the same track hashes and physical-frame counts as
this branch for all 63 cells. References were not overwritten.

The first two preview-generation attempts exposed a separate upstream integration
issue: the compiler uses `catchReceivers` to place catches mid-frame, while
`verifyMainConstruction` still reconstructed the old position. Saving rejected
both rides at support 0. The verifier now uses that same placement helper; a
regression test fails before the fix, passes afterward, and still rejects altered
geometry. This changes validation only, not construction or the authored specs.
The 23 library tests and the new verifier regression pass together.

After the verifier fix (`b60fa025`), one standard-budget seed 101 run each
completed Let the World Burn (59 s) and Funk do Bounce (60 s), with valid and
qualified current impact accounts and independent geometry validation. Actual
compilation work was 3,750,995 / 4,047,700 allowed frames and
3,769,651 / 4,115,700 respectively. These are first previews, not best-of-many
selections or evidence of perceptual superiority. Plans, input/compiler
identities, measurements and tracks remain in
`generated/music-library-authoring/rides/*-verified/`; the existing production
dashboard opens `generated/music-library-authoring/collection.json`.
