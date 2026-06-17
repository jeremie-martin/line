# Creative workflow — rhythm analysis to an expressive Line Rider spec

This is the current human-in-the-loop workflow for turning music into a Line
Rider spec. It is not automatic spec generation. The useful split is:

1. analyze the song into evidence layers;
2. interpret those layers into musical contacts and support contacts;
3. author curves/impacts as intent;
4. compile, watch, annotate, and iterate.

The TIKI TIKI 48s pass is the first successful example of this newer workflow:
`scripts/v0/specs/tiki_tiki_48s.ts`, driven by
`beats/tiki_tiki_48s.rhythm.json`.

The workflow is meant to be reusable, not song-specific. It should be a good
starting point for old specs such as Believer too, but those should be treated
as legacy tracks to rebuild from analysis evidence rather than as examples to
copy. The analysis can expose plausible musical events for almost any track;
the spec still needs human choices about hierarchy, density, camera, and motion.

## Core idea

Do not treat a uniform beat grid as "the beats".

A song often has multiple rhythmic layers: a slow primary beat, a faster pulse,
bass/synth hits on subdivisions, drum fills, and genuine drops. The compiler
needs contact times, but a viewer hears hierarchy. A bass-heavy subdivision can
be real evidence without being a landing beat.

The rhythm-analysis output should make this distinction explicit without
pretending to be a finished spec:

- `grid.*` — pulse placement, primary-beat match, and meter position.
- `scores.event` — how much onset/bass evidence exists at this row.
- `scores.body` — local loudness/body with a small lift credit.
- `scores.contact` — numeric plausibility that this row can carry a musical
  landing.
- `scores.support` — usefulness for quiet continuity contacts.
- `scores.impact` — suggested relative impact if the row becomes a contact.
- `timing.event_t` — a timing hint for audible contacts; primary rows use the
  detected primary beat, secondary rows use a local percussive attack when
  available.
- `transients[]` — independent onset candidates between grid rows, with
  percussive strength, local body, and phase inside the surrounding primary beat
  interval.

The spec author is expected to argue with this output. If it is incompatible
with what you hear, fix the analysis or override it deliberately.

## Analysis

Use the Python analysis environment:

```bash
/tmp/mm310/bin/python scripts/analyze_rhythm.py \
  --audio beats/tiki_tiki_48s.mp3 \
  --out beats/tiki_tiki_48s.rhythm.json \
  --window 6:13
```

The console table is for quick listening checks:

```text
time    P pos  event body  jump  prom  contact support impact  perc bass rnn
7.030   1   1   1.00 0.44  0.77  1.00     0.88    0.74   0.81  1.00 1.00 1.00
7.465   0   2   0.54 0.18  0.65  0.32     0.26    0.54   0.33  0.61 0.93 0.28
9.640   0   -   0.70 0.59  0.76  0.32     0.58    0.33   0.59  0.72 0.46 0.81
10.510  1   1   1.00 1.00  0.68  1.00     1.00    0.65   1.00  1.00 1.00 1.00
10.945  0   2   0.73 0.53  0.10  0.10     0.57    0.43   0.54  0.48 0.68 0.96
```

For TIKI, this fixed the earlier mistake: the 136/138 BPM pulse is real, but it
is not the contact list. The first perceived beat region reads as `7.03`,
`7.90`, `8.77`, a smaller `9.64`, then the hard-drop grid row at `10.51`
with corrected event/contact timing at `10.43`. The old `10.91` contact is now
support/subdivision evidence, not a beat.

The next timing lesson was equally important: the grid row time is not always
the audible attack. TIKI's grid rows were often 70-90ms late versus the primary
beat/attack. The spec now keeps support contacts on `row.t`, but uses
`timing.event_t` for audible contacts. That is a timing correction, not a global
offset.

The later TIKI pass added a transient layer. This found real audible events that
were missing from the grid rows, including clean half-beat hits and anticipation
hits shortly before primaries. The half-beat transients became useful contacts.
The anticipation hits stayed analysis evidence, because landing on both the
anticipation and the following primary made gaps around 200ms and produced a
worse physical track.

`scripts/analyze_music.py` is still useful for broad tempo/downbeat/energy
checks, but `scripts/analyze_rhythm.py` is the better authoring input because it
keeps metrical layer and event salience separate.

## Extract audio

For a fixed excerpt:

```bash
ffmpeg -y -i "TIKI TIKI (Slowed) [bEYiPCbHAtM].opus" \
  -t 48 -vn -codec:a libmp3lame -q:a 2 beats/tiki_tiki_48s.mp3
```

Optional spectrogram assets for dashboards:

```bash
/tmp/mm310/bin/python - <<'PY'
from pathlib import Path
import importlib.util
spec = importlib.util.spec_from_file_location("extract_spectrogram", "beats/extract_spectrogram.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
mod.main(Path("beats/tiki_tiki_48s.mp3"), Path("beats/tiki_tiki_48s.spectrogram.png"), Path("beats/tiki_tiki_48s.spectrogram.json"))
PY
```

## Build contacts

A spec can load the rhythm JSON and choose contact rows. The analyzer writes
schema v2 rows: grid placement lives under `grid.*`, timing hints under
`timing.*`, musical evidence under `scores.*`, and extra onset evidence under
`transients[]`.

```ts
const rhythm = JSON.parse(
  readFileSync(resolve("beats/tiki_tiki_48s.rhythm.json"), "utf8"),
) as RhythmAnalysis;

function keepAsContact(row: RhythmRow): boolean {
  if (row.t < 0.75 || row.t > 48.0) return false;
  if (row.t < 6.90) return row.grid.is_primary && row.scores.support >= 0.55;
  if (!row.grid.is_primary) {
    return row.scores.contact >= 0.79 &&
      row.scores.event >= 0.88 &&
      row.scores.body >= 0.60;
  }
  return row.scores.contact >= 0.55;
}

function contactTimeFor(row: RhythmRow): number {
  if (isQuietSupport(row)) return row.t;
  return row.timing?.event_t ?? row.grid.primary_t ?? row.t;
}

function selectedContactRows(): ContactRow[] {
  const gridRows = selectedGridContactRows();
  return [...gridRows, ...selectedTransientRows(gridRows)]
    .sort((a, b) => a.t - b.t);
}
```

The important authoring rule: **support contacts are allowed**, but they should
stay on the chosen grid and carry very low visual/impact weight. For TIKI, intro
contacts before the first real beat are `impact: 0.02`; they exist for motion
continuity, not because the music asks for hard landings.

Per-beat `impact` is authored on contacts:

```ts
if (row.t < 6.90) return 0.02; // quiet support
if (row.scores.contact >= 0.96 && row.scores.body >= 0.80 && row.scores.lift >= 0.45) return 1.0;
if (!row.grid.is_primary) return Math.min(0.76, 0.30 + 0.46 * row.scores.impact);
return Math.min(0.78, 0.22 + 0.44 * row.scores.impact);
```

`impact` is felt landing intensity. It is scored. Dense beats may not be able to
hit every high-impact ask; the report's target/achieved values tell you whether
the compiler found the requested slam.

## Choose beats under a gap budget

The analyzer may find more real musical events than the track can physically hit.
A detected onset is evidence, not an obligation. The goal is not the maximum
number of contacts, and it is not merely the easiest feasible contact list. The
goal is the best musical compression of the song into landings, impacts, motion,
and camera.

Be explicit about density problems. If the important musical layer would require
many contact gaps below about 400ms, call that out in the work notes or final
summary instead of silently producing a weaker-looking spec. This is not a hard
rule; occasional short gaps can work when they are musically essential and kept
visually small. But repeated sub-400ms contacts leave little physical room for
readable arcs, impact, or amplitude. Gaps below about 300ms are especially risky,
and anticipation plus primary pairs around 200ms were too tight to read well in
TIKI.

When a real event is too close to another real event, do not simply erase the
music to satisfy the compiler. Resolve the conflict musically:

1. keep the event that carries the phrase, body hit, drop, or downbeat;
2. replace a nearby weaker contact rather than appending another required
   landing;
3. express the omitted event through impact, speed, air, amplitude, camera, or
   a low-impact support contact;
4. preserve the listener's hierarchy, even if the exact event count changes.

Promoting every detected event created more contacts but a worse track. Filtering
too aggressively can create the opposite failure: a feasible spec that no longer
sounds like the music. Keep the right beats, not the most beats, and document any
important beats that were represented indirectly instead of as landings.

A useful promotion order is:

1. keep primary beats, drops, and phrase anchors;
2. add clean subdivision contacts only when they leave enough room;
3. add quiet support contacts for continuity when they stay visually small;
4. leave too-close events in the analysis, or express them through impact,
   speed, air, or camera instead of a separate landing.

For current TIKI, the spec keeps primary/drop/grid contacts, adds at most one
clean half-beat transient inside a primary interval when there is no existing
secondary contact, and does not automatically promote late-interval anticipation
transients. This was not hardcoded to the user's timestamps; those notes became
a validation set for whether the analysis was seeing the same musical layer.

## Author axes

The thin baseline for a new song should be contacts, per-contact `impact`,
`speed`, and `air`. That is enough to test whether the rhythm interpretation is
right before adding vertical tricks.

`amplitude` and `elevation` are optional expressive layers. They are not required
for a good first pass, and they should not hide bad beat choices. `impact` is
per-contact, not a continuous curve. `grain` is legacy/report data and should
not be treated as an active v0 target.

Practical guidance:

- `air` carries how floaty the rider feels.
- `speed` is a resource; it often overshoots late through gravity.
- In pure baseline mode, do not author `amplitude` or `elevation`; let rhythm,
  speed, air, impact, and optionally camera zoom carry the piece.
- `amplitude` needs sparse gaps to read. Dense 0.4s beats cannot produce big
  jumps. Put high amplitude on longer phrase gaps or drops, and expect tradeoffs
  with impact.
- Do not pair `amplitude` and `elevation`; both steer launch angle.
- Set `jitter: 0` when your curves already carry variation.

TIKI uses a dynamic amplitude function keyed to the selected contact row and
gap length. Long gaps get big-pop asks; dense secondary hits stay small. A good
next validation pass is a TIKI or Believer spec with no amplitude/elevation at
all: pure beat selection, impact, speed, air, and zoom.

## Compile and inspect

Compile:

```bash
npx tsx scripts/v0/run.ts \
  --spec=scripts/v0/specs/tiki_tiki_48s.ts \
  --compiler=handoff \
  --budget=1000000 \
  --seed=0 \
  --out=generated/tiki_tiki_48s
```

Read the terminal summary first:

- contacts hit/drift/missing/off-beat;
- survival reason;
- score and `axis_rms`;
- worst gaps.

For the TIKI rhythm-driven spec, the useful result was:

```text
contacts 77/77 hit · 0 drift · 0 missing · 0 off-beat
survival endOfSpec
```

Keep timing offsets explicit. The default jolt offset should be zero; if a run
uses `LR_JOLT_OFFSET_MS=25` or any other value, put it in the command and the
output name so timing comparisons are not ambiguous.

Then inspect without rendering:

```bash
npx tsx scripts/inspect.ts \
  --track=generated/tiki_tiki_48s.track.json \
  --name=tiki_tiki_48s \
  --no-render
```

Run the shape analyzer:

```bash
/tmp/mm310/bin/python scripts/analyze_track_shape.py \
  tiki_tiki_48s \
  --json generated/tiki_tiki_48s.shape.json
```

The score is not the whole story. For TIKI, a 300k compile scored slightly
better numerically, but the 1M compile cleared the shape flags and had better
pop/relief, so the 1M track was the better creative candidate.

## Render

Make sure the mirror and dashboard are available:

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory mirror
npx tsx scripts/serve.ts
```

Render with spec-authored action zoom. `--zoom=action` reads the camera lane
from the spec or from the `<out>.camera.json` sidecar written by the compiler.
The old realized-path auto-framing mode is still available as `--zoom=trajectory`
for comparison.

```bash
npx tsx scripts/inspect.ts \
  --track=generated/tiki_tiki_48s.track.json \
  --name=tiki_tiki_48s \
  --render \
  --zoom=action
```

Mux the audio:

```bash
cp beats/tiki_tiki_48s.mp3 shakedown/tiki_tiki_48s/audio.mp3
ffmpeg -y \
  -i shakedown/tiki_tiki_48s/video.mp4 \
  -i shakedown/tiki_tiki_48s/audio.mp3 \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest \
  shakedown/tiki_tiki_48s/video_with_audio.mp4
```

Overlay data:

```bash
npx tsx scripts/make_overlay_data.ts \
  --spec=scripts/v0/specs/tiki_tiki_48s.ts \
  --report=generated/tiki_tiki_48s.report.json \
  --track=generated/tiki_tiki_48s.track.json \
  --out=remotion/public/tiki_tiki_48s.overlay.json
```

Dashboard:

```text
http://127.0.0.1:8767/dashboard/?run=tiki_tiki_48s
```

## Iteration loop

The loop is:

1. listen and annotate in the spec dashboard;
2. check whether `analyze_rhythm.py` agrees in broad strokes;
3. if it disagrees badly, improve the analysis or override intentionally;
4. choose contacts under a gap budget, set impact hierarchy, and note any dense
   passages that forced indirect representation;
5. adjust `air`/`speed`, then add optional amplitude/elevation only if needed;
6. compile;
7. inspect report + shape analyzer + rendered video;
8. repeat.

Useful failures:

- A support row looks like a beat: the contact selection is too literal.
- A true beat is missing: analysis or contact filtering is too conservative.
- A real event creates a tiny gap: keep it as evidence, replace a neighboring
  contact, or express it through impact/camera instead of adding a landing.
- The contact list is feasible but no longer sounds like the song: restore the
  musical hierarchy, even if that means admitting the track needs indirect
  representation in dense passages.
- High amplitude on dense beats does nothing: create a longer gap or lower the
  amplitude ask.
- High impact and high amplitude fight: decide which one the music needs more.
- The report score improves but the shape flags regress: watch the video and
  prefer the version that reads better.

The current workflow is still young, but it is already much better than the old
"clean grid -> contacts" assumption. The analysis should make musical hierarchy
visible; the spec should turn that hierarchy into motion.
