# Creative workflow — from a song to an expressive Line Rider video

Turn a song into a hand-shaped, music-synced track + annotated video. The
compiler only ever *hits the detected beats*; everything expressive lives in the
**spec** (continuous per-axis curves) you write, informed by the music.

Worked examples (all on this pipeline):
- `scripts/v0/specs/believer_curves.ts` — Believer 56s, air/speed/grain.
- `scripts/v0/specs/shelter_curves.ts` — Shelter 65s, air/speed/**elevation**.
- `scripts/v0/specs/shelter_amp.ts` — Shelter 81s, air/speed/**amplitude** +
  phrase-hit rests.

## One-shot pipeline

```
scripts/produce_video.sh --spec=<spec.ts> --name=<name> \
  --budget=300000 --audio=beats/<song>.mp3 \
  [--res=1080p|720p|480p] [--zoom=action|speed|N] [--hq]
```

Runs all five stages → `remotion/out/<name>_annotated.mp4`, auto-managing the
mirror. `--budget=300000` iterates fast; `--res=480p` is a quick preview. The
five stages, if you want to run them by hand:

1. **Clean beat grid** → `beats/<song>.json` (contacts the compiler must hit).
2. **Understand the music** → `scripts/analyze_music.py` (madmom; tempo, meter,
   4-bar phrase lines, energy contour). A *listening aid*, not a beat generator.
   Install recipe in its docstring; run via the `/tmp/mm310` py3.10 venv.
3. **Design the spec** (axes below).
4. **Compile + iterate** → `scripts/v0/run.ts --spec=… --compiler=handoff
   --budget=N`; read the per-gap `achieved/target` in the report and tune.
5. **Render** → `scripts/inspect.ts` (drives the mirror), then mux audio and the
   Remotion overlay. `produce_video.sh` does 3–5 for you.

## The axes (`scripts/v0/types.ts`)

Author each as a continuous curve of track time (`core/curves.ts`:
`constant`/`ramp`/`keyframes` with `hold`/`linear`/`smooth`/`easeIn`/`easeOut`).
A curve is sampled ~once per gap (~0.4–0.6s), so author at gap granularity.
Set **`jitter: 0`** when the curves carry the variation (the curve specs do).

- **`air`** [0,0.99] — airborne fraction. Most controllable. Measured envelope
  ~**0.45–0.78**: resists going fully grounded or fully airy. Design inside it.
- **`speed`** [0,1] → 5.4–12.6 px/frame. **Overshoots late** (gravity); keep
  targets modest or nudge them up toward the achieved overshoot.
- **`grain`** [0,1] — median line length (choppy ↔ swooping). Tracks tightly.
- **`elevation`** [0,1] — altitude *trend* vs the speed-supported vy band: 0.5
  level, →1 climb, →0 plunge. Speed-coupled: **bank speed BEFORE a climb and let
  it decay DURING it** (don't co-demand high speed/air at a climb gap — they fight
  it). Honest per-gap `ceiling` in the report (~0.65 at chorus speed); author a
  climb as a *pulse* where speed is mid-fall, not a sustained max.
- **`amplitude`** [0,1] — pop height of the airborne arc (≈ `g·N²/8`). A *moment*
  axis: only large on **long gaps** (~12px @0.6s, ~50px @1.2s, ~113px @1.8s), so
  drive it where the grid is sparse. Author moderate (~0.6) — maxing it makes arcs
  plunge and blows speed up (axis error). **Cannot be paired with `elevation`**
  (both write the launch angle).

## Key levers / lessons

- **Contact density is the main interestingness lever.** A uniform grid rides as
  a flat glide; a **variable-density grid** (tight 0.6s in the groove, sparse
  1.2–1.8s where you want jumps/long slides) maps the music's breathing and gives
  the sparse sections real drama. Put boundaries on madmom phrase lines.
- The **contract score ≠ fun to watch.** It only checks beats-hit + axis-match.
  Use the shape analyzer (below) and your eyes for "interesting."
- Tight sync ⇄ small arcs ⇄ flat: the compiler lands gently on dense beats, so
  big air comes from *sparser contacts*, not from fighting the per-gap cap.

## Track-shape (interestingness) analyzer

```
/tmp/mm310/bin/python scripts/analyze_track_shape.py <name> [--json out.json]
```

Reads `shakedown/<name>/detection.json` (the rider trajectory) and reports a
descriptive profile — pop above the takeoff→landing chord, air-arc path length,
arc vertical span, vertical relief, airborne/slide runs, speed variety — and a
static track-map PNG, plus soft "flat" flags. The companion to the numeric score
for judging the *ride*.

## Camera / speed-aware zoom

The native playback camera follows the rider at a **fixed** zoom by default
(there's no built-in auto-zoom; the fit-to-scene method is a stub). `inspect.ts`
adds per-frame zoom via the engine's own `window.createZoomer(keyframes,
smoothing)` hook (log2 interpolation + cosine smoothing; dense fallback):

- `--zoom=action` (recommended) — **auto-frame the action**: zoom OUT on big
  jumps/drops (large local vertical extent), IN on flat — *independent of speed*.
- `--zoom=speed` — zoom by forward pace (vx). Looks odd on fast-but-flat stretches.
- `--zoom=N` — static.

Tune with `:IN,OUT,SMOOTH` (linear zoom; larger = more zoomed in), e.g.
`--zoom=action:2.6,1.9,25`. For reference the app's default zoom is `2`.

## Annotated overlay (`remotion/`)

`CurveOverlay.tsx` draws each targeted axis's target curve + per-gap measured
dots + error, a sweeping playhead, and a phase band, synced to the ride. It plots
**only the axes the spec targets**, and reads per-song title/phases from the
spec's exported `overlayMeta`. Data is baked by `scripts/make_overlay_data.ts`.

## Manual render / preview

```
python3 -m http.server 8765 --bind 127.0.0.1 --directory mirror   # mirror
npx tsx scripts/serve.ts                                          # dashboard :8767
npx tsx scripts/inspect.ts --track=<t>.track.json --name=<n> --render [--1080p --hq] [--zoom=action]
```

Dashboard: `http://127.0.0.1:8767/dashboard/?run=<name>` (and `?report=` for the
per-gap achieved-vs-target view).
