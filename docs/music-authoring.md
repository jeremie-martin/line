# Authoring a spec from music

How a song becomes a spec: which moments the rider lands on, how hard, and what air and speed do in between.

## The production set

What is mass-produced is `productions/short_*`: one folder per piece of music, cut by the owner to the start and
end he wants, registered in `scripts/gallery/repertoire_catalog.ts` with the title a video may show (`source.json`
also holds the artist and what a recogniser said). Each is independent: its own specification, zoom lanes
(`zooms.ts`, registered in `scripts/video/zooms.ts`) and drop (`scripts/video/drops.ts`), even when another entry is
the same song at another speed. A specification covers the whole audio, to its end; the zoom-out, the fade and the
loop of a video (`docs/visual-system.md`, "The loop") are applied afterwards and are not its concern. The other
folders of `productions/` are the library the compiler is measured on, and the best of them are models for an
entry's spec. `npm run videos -- --songs=production …` makes a batch of the set.

## Principles

- **The video is the judge, and the owner's eye on it.** Neither the analysis, nor an author's confidence, nor
  even the owner's own marks placed by ear on a timeline say whether a ride is right: he found marks of his that he
  disliked once he saw them ridden. Every revision is shown as a video.
- **A spec is handcrafted.** No script and no recipe maps a song: the author reads the music from the analysis and
  from what the owner said, and makes choices. Which line a listener carries through a passage (the voice, a hook,
  the drums, a mix of them) cannot be read from the analysis alone, and it is often not one line.
- **The owner's direction is a direction.** His notes on the spec dashboard (marks `voice`, `mark`, `strong`, over
  a moment or a range, with a few examples) say what he wants there; the author extends them with craft and he
  corrects on the video. He is never asked to mark every note.
- **Tools measure; nothing chooses landings.** A spec is a list of deliberate decisions, each traceable to a
  measured note.
- **A stem is a separation, not a role.** A sampled or chopped voice often sits in `other`; one sound can leave a
  note in two stems. Say "the notes of `other`", not "the pads".
- **What is heard is the mix.** Among the notes of the line being followed, the ones a listener gets are those where
  the mix rises (`heard`) and the stem's attack is sharp. A sound's level or its share of the mix does not tell.
- **A hierarchy must survive the ride.** Strength is a few big hits, a body and light notes, and it only exists if
  the compiled ride delivers it: check asked against delivered (the manifest), not the spec.
- **No rules from one song or one remark.** What read well on a song is in `docs/research/`, as observations.

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
     gives the dashboard spectrogram;
   - `node tools/music/source.ts --song=<song> PATH/TO/FULL-RECORDING` finds where the excerpt sits in its full
     recording and writes `source.json`. A video loops into the music that leads into the excerpt
     (`docs/visual-system.md`, "The loop"); without this record it only fades at its end. Best for the loop: an
     excerpt that starts at least six seconds into the recording and ends on a bar line that leads into its start.
   - To choose an excerpt that loops, before cutting it: `node tools/music/passage.ts --recording=FILE` (or
     `--song=<song>` for the recording of an existing song, with `--around=27,38` to keep moments of that song)
     lists passages of 30 to 45 s that start on a strong onset and whose end is in step with what leads into their
     start. It measures; which passage carries the music is the author's choice.
   - An entry of the production set cut from audio already analysed: `node tools/music/cut.ts --song=<song>
     --name=short_<name> [--from=S --to=S]` (without them, the owner's saved cut:
     `/generated/concept-lab/closing/cut.html`) makes `productions/short_<name>/` with the audio between his markers
     and the source record, stems and measurements shifted, nothing measured again. Steps 2 to 4 are then done.
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
   For a sung melody, `~/.venvs/line-stems/bin/python tools/music/sung.py --song=<song>` writes
   `productions/<song>/sung.json`: sung notes with pitch (`docs/research/sung-notes-20261031.md`).
4. **Find every stem's notes.** `python3 tools/music/lines.py <song>` writes `productions/<song>/lines.json`: the
   attacks of each stem by one detector, each with `attack` (sharpness on the stem's own scale), `heard` (how much the
   mix rises there), `loud` and `share`; and prints a fold of each four bars onto one bar, where a figure that returns
   shows as a row. The bar is a hypothesis (check `repeats`); slot 0 is a beat, not necessarily the first.
   `sung.json` misses most syllables of a fast or chopped voice; use it for pitch, not for where the syllables are.
5. **Read what the owner said.** His notes on the song (`productions/<song>/notes.json`, from the spec dashboard)
   and on its earlier videos. For a song he has said nothing about, write a first reading and show its video.
   On the dashboard he slows a passage, hears the mix or one stem alone (Hear: mix, voice, other, drums,
   bass), and places notes that snap to measured events: M a mark, S the strong one (a mark one level up, relative
   to the passage; a moment holds one of the two), V a voice, I an impact.
6. **Write the spec.** In `productions/<song>/music.ts`, list the song's layers as measured times; each
   `variants/<name>.ts` is a whole spec chosen from them; `spec.ts` re-exports the preferred one.
   - Say in the header what each passage follows and what is deliberately left out. More than one variant is
     welcome where two readings are both good (a calm one, an ambitious one).
   - Land a figure whole, the same in every bar, unless the music changes.
   - Size hits from `heard` and the attack. Where landings come faster than about three a second the rider delivers
     little difference between them: thin around a big hit, or accept an even run and say so.
7. **Compile and check.** `npm run produce -- --song=<song> [--variant=<name>] --seed=<n> --out=DIR` (add the song to
   `scripts/gallery/repertoire_catalog.ts`; do not edit tracked files while it runs). Then:
   - asked against delivered strengths in the manifest: the spread asked, and whether the ride delivers it;
   - `node tools/music/coverage.ts --song=<song> [--variant=<name>]` lists strong events not landed. It is a list to
     read, not a form to fill: a written reason does not make a miss right.
8. **He watches.** The video, beside the spec on the dashboard: muted, it follows the dashboard's clock (position,
   speed, seeks). "Make the video" compiles that spec file at seed 101 into `generated/dashboard-rides/` and renders it
   to `generated/videos/dashboard/<song>--<variant>.mp4` (`spec` for `spec.ts`), one job at a time, in the look and
   zoom lane of the song's Astra video when it has one, else those the renderer chooses for the ride. The panel says
   whether the video was made from the spec file as it is now. His notes there start the next revision.
   `python3 tools/music/marks.py --song=<song> DIR` compares a ride with marks he placed by hand: a rough hint,
   since his marks are not always what he wants once ridden; nothing is tuned to it.

## What the rider can do (current compiler, October 2026)

- **Spacing.**
  - Landings 0.33 s apart are feasible, but strength there caps near 0.55–0.75.
  - Landings 0.21 s apart are feasible (Trouble pulse: light pickups at
    0.06–0.21 before kicks at 0.38–0.50), but a groove full of them can run
    out of budget (one of two seeds failed).
  - The first landing must come at about 0.2 s or later. Landings at 0.13 s
    and at 0.17 s (compiled 15 ms later at the time, 0.19 s) both failed with
    `no_arc`. A contact before 0.125 s (frame 5) is refused when the spec loads.
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
