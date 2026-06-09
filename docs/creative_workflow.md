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

## Per-beat: `impact` (landing intensity)

`impact` is NOT an axis — it's a qualifier on a *beat*, authored on the `Contact`
(`{ t, impact? }`), absolute [0,1]. It is the rider's **velocity REDIRECTION** ("how
hard the rider slams into the arc" — *claquage*): the peak perpendicular component of
the centre-of-mass velocity change over the ~6-frame episode after contact, normalized
by `CALIB.REDIR_CAP`. 0 = a smooth tangent glide that doesn't bend the path, 1 = the
hardest catchable slam (the path is sharply redirected at speed). It is *absolute* (so
you can author an all-soft or all-hard track) and *speed-bounded* — a slow rider can't
redirect hard, and beyond the catchable bound the catch ejects; the per-gap `ceiling`
in the report (`impactCeiling`) is the honest "hardest possible here", so
`target > ceiling` is physics, not a compiler miss.

Why redirection (not the old one-frame "normal closing speed"): a felt impact is the
surface *redirecting* the path; decelerating *along* the path (a glide slowing on a
curved arc) is not felt as a hit, and redirection is CoM-only so it's immune to sled
rotation / limb whip (which look violent but aren't felt). See
`docs/impact_problem_statement.md`.

**Status: SCORED.** impact folds into the contract `axis_quality` (target/achieved/
error/ceiling in the drift report). The compiler hits it via candidate-cost ranking;
explicit redir-aware *steering* is a deferred follow-up (the old one-frame steering was
neutralized in the metric swap).

Author it with the helpers in `core/beats.ts` (co-author timing + impact in one
file, no external JSON, no duplicated timing):

```ts
import { beats, withImpact } from "../core/beats.ts";

// Fine per-beat control — each landing hand-tuned:
const contacts = beats([
  { t: 0.75, impact: 0.1 },   // soft
  { t: 1.25, impact: 0.1 },
  { t: 1.75, impact: 0.9 },   // the one hard hit
  { t: 2.25 },                // no target → untargeted, like a plain { t }
]);

// Or decorate loaded onsets BY RULE (timing stays single-sourced):
const contacts = withImpact(
  raw.onsets.map((o) => ({ t: o.t })),
  (t) => (t < 38 ? 0.15 : t < 58 ? 0.6 : 0.3),   // soft verse, hard chorus, ease-out
);
```

Calibrate `CALIB.REDIR_CAP` against `specs/probe_impact.ts` / `study_impact_calibrate.ts`
(the achieved-envelope workflow used for `amplitude`/`grain`); pass
`--track=<labeled.track.json>` when you want the Shelter label percentile block.
Inspect the candidate definitions with the `ImpactStudyOverlay` Remotion composition
and the `scripts/v0/study_impact_*.ts` harnesses.

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
