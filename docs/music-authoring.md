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
   - `beats/extract_spectrogram.py` gives the dashboard spectrogram (see
     `productions/trouble_50s` for the call).
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
5. **Author the spec.**
   - List the landings by hand, section by section, as measured event times.
     The spec looks each one up in `events.json` and fails on a time that is
     not an event.
   - Derive strength from the leading instrument's measured loudness; pin only
     structural moments (the drop).
   - Write down every event deliberately not landed on, with its reason.
6. **Resolve the coverage report.** Run
   `node --import tsx tools/music/coverage.ts --song=<song> --contacts-out=generated/stems/<song>/contacts.json`.
   It flags:
   - unlanded events stronger than the weakest landing within 2 s;
   - landings beaten by a neighbour within 0.35 s;
   - landings on no event.

   Every flag gets a decision: land it, or keep its reason in the spec. Then
   rerun `events.py --contacts=…` and check the landings on the sheets.
7. **Listen.** Open the spec dashboard,
   `http://<host>:8767/spec-dashboard/?spec=productions/<song>/spec.ts`
   (`HOST=0.0.0.0 npm run serve`):
   - the **events** lane shows each event in its instrument's colour (drums red,
     bass blue, vocals orange, other green);
   - **Clicks** plays a click at every landing;
   - notes are saved to `productions/<song>/notes.json`.
8. **Compile and review rides.** Run
   `npm run produce -- --song=<song> --seed=<n> --out=DIR` (add the song to
   `scripts/gallery/repertoire_catalog.ts`). Do not edit tracked files while it
   runs: its compiler identity check rejects the result.

## What the rider can do (current compiler, October 2026)

- **Spacing.**
  - Landings 0.33 s apart are feasible, but strength there caps near 0.55–0.75.
  - Two events 0.2 s apart cannot both be landings. Land the accent and keep
    the other as a stated decision.
- **Room makes a slam.** A float into a big hit (Trouble's drop after a 1.8 s
  break) reaches 0.97–0.98.
- **Quiet.** Gentle touches read about 0.05–0.15; requests below about 0.05
  sit at the floor of any touchdown.
- **The last landing** needs a little ride after it; a hit 0.2 s before the
  clip ends is better left out.

## New music is held out

New songs are the only test of whether the compiler generalizes. Author them
freely, but do not tune the compiler on them. Keep at least one new song
untouched by any compiler decision.
