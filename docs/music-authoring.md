# Authoring a spec from music

How a song becomes a spec: which moments the rider lands on, how hard, and what
air and speed do in between. This replaces the June guide
(`docs/creative_workflow.md` at tag `archive/pre-rework-2026-10-03`), whose
reading of the analysis layers still applies but whose single-mix tooling
proved insufficient on `productions/trouble_50s`.

## Principles

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
   `node --import tsx tools/music/coverage.ts --song=<song> --contacts-out=generated/stems/<song>/contacts.json`.
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

## What the rider can do (current compiler, October 2026)

- **Spacing.**
  - Landings 0.33 s apart are feasible, but strength there caps near 0.55–0.75.
  - Landings 0.21 s apart are feasible (Trouble pulse: light pickups at
    0.06–0.21 before kicks at 0.38–0.50), but a groove full of them can run
    out of budget (one of two seeds failed).
  - The first landing must come later than 0.13 s after the start (compile:
    `no_arc`).
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
