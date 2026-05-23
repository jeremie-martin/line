# Music-Synced Line Rider Track Generation — Problem & Definitions

This document states the **problem**, pins **definitions**, fixes **scope**, and
records what's **resolved**, **open**, and **deferred**. It deliberately does
*not* prescribe an architecture, compiler strategy, primitive library, or spec
syntax — those should emerge from experimentation and may need to be revised
as we learn what works.

## Problem

Procedurally generate Line Rider tracks whose physics-driven motion is
synchronized to a music track.

Reference for the human-made version: DoodleChaos's music-sync videos (e.g.
"Mountain King" — confirmed by the author as ~1+ month of fully manual
placement). No prior art exists for automated music-sync line placement;
this project targets that gap.

## What "physical sync" means

Working definition: **the viewer perceives the sled's motion and the music as
a single causal event** — either the music is driving the sled or the sled is
"playing" the music. Salient audible moments coincide, frame-aligned, with
salient kinetic moments.

This is the artistic north star. v0 does not aim at it directly — it aims at
the mechanical preconditions (controllable event timing and speed) without
which the artistic effect is impossible.

## Scope

**In:**
- **Beat sync** via three discrete event types:
  - *landing* — sled returns to contact after a sustained airborne phase
  - *bounce* — sled returns to contact after a brief airborne phase
  - *kick* — sudden velocity-direction change (with or without airtime)
- **Speed** — the sled's velocity envelope `v(t)`, controllable as a primary axis.

**Out:**
- Multi-track sync (instrument lanes → physical feature classes)
- Intensity sync (loudness ↔ kinetic energy)
- Textural sync (timbre ↔ ride surface)
- Structural sync (musical phrases → geometric acts)
- "Causal illusion" / theatricality (the sled appearing to *be* the music)
- Music-driven spec generation (`librosa` / `essentia` / etc.)
- Camera/zoom triggers (the bundle's default follower handles framing for now)
- LRA-family physics compatibility (we render through linerider.com's engine)

## Capability vs authoring

Two separable problems are easy to conflate:

1. **Capability** — given a spec, generate geometry whose physics satisfies it.
2. **Authoring** — given music, produce a spec.

Music-sync is essentially trivial once (1) exists — beat detection + envelope
extraction emits a spec, which (1) compiles to a track. (1) is the load-bearing
piece. We build and validate it independently.

Concretely: we should first be able to express *"landings at 48 bpm for 10 s,
then landings at 96 bpm for 5 s, with speed X from A→B and speed Y from B→C"*
and get a track that actually does that — before worrying about how a spec is
derived from music.

## Definitions

### Engine and timing

- **Physics engine**: `lr-core@0.8.2` (npm). Verified bit-identical to the
  linerider.com bundle that renders our videos (`npm run parity` — same MD5
  over 1201 frames × 36 k floating-point numbers on the test track).
- **Simulation rate**: 40 fps. 1 frame = **25 ms**.
- **Render rate**: 60 fps (the bundle interpolates physics frames during export).
- **Common time axis**: seconds. Both video and physics share it.

### Units

- **Distance**: engine units. (Roughly 1 unit ≈ 1 screen pixel at zoom 1; the
  default playback zoom of 2 makes it 2 screen px per unit, but pixel is a
  *render* concept and never appears in specs.)
- **Velocity**: engine units / frame. (Multiply by 40 for engine units / second.)
- **Time**: seconds.

The rider's default spawn speed is `0.4 engine units / frame = 16 units/second`.

### Initial conditions

v0 commits to lr-core defaults:
```
startPosition = { x: 0, y: 0 }
startVelocity = { x: 0.4, y: 0 }
```

The rider can decelerate (uphill, friction) or accelerate (downhill, gravity)
but is bounded:

- **Floor**: `|v(t)|` can go to 0, but that's a `rideStalled` terminus
  (see Failure modes).
- **Ceiling**: pure free-fall gives `|v(t)| ≤ 0.4 + 0.175 × frames`. At t = 1 s
  (40 frames): `|v| ≤ ~7.4`. Specs requiring more speed than this at any
  timestamp are infeasible from default spawn and should be rejected by a
  pre-check.

### Trajectory analysis

Simulating a track yields three categories of output, collectively the
**trajectory analysis**:

- **measurements** — continuous per-frame quantities:
  - `speed[f]` = `|rider.velocity at frame f|`
  - `velocity[f] = {x, y}`
  - `position[f] = {x, y}`
  - `airborne[f]` = boolean (no sled contact point in contact)
  - (per-contact-point positions available if needed)
- **events** — discrete, timestamped, derived from measurements; an ordered
  stream of `{frame, type, ...}` records.
- **terminus** — one per ride: `{frame, reason}` where
  `reason ∈ {endOfSpec, sledBroken, rideStalled, leftWorld}`.

The component that produces these is the **detector**. It runs against lr-core
output and is the single source of truth for everything downstream — compiler
search, spec verification, drift reports.

### Event types

All three event types emit at the frame of the salient transition. They can
co-occur in time (different frames close together) and a single trajectory
may emit any mix.

| Event | Signature | Parameter |
|---|---|---|
| **landing** | sled airborne for `T > K` frames, then re-contacts | event fires at frame of re-contact |
| **bounce** | sled airborne for `1 ≤ T ≤ K` frames, then re-contacts | event fires at frame of re-contact |
| **kick** | angle between `velocity[f]` and `velocity[f-1]` exceeds `θ` (regardless of contact state) | event fires at frame `f` |

Threshold parameters, project-wide:

- `K = 5` frames (~125 ms) — separates "bounce" from "landing"
- `θ = 20°` per frame — minimum direction change for "kick"

Both `K` and `θ` are tuned by visual inspection through the dashboard
(below); the values above are starting guesses.

The detector also defines **what "sled" means**: contact of any sled-side
contact point (`SLED_PEG`, `BUTT_LFOOT`, `BUTT_RFOOT`) with a line.

### Speed

- `v(t)` := `|rider.velocity|` (Euclidean magnitude of the aggregated velocity
  vector returned by `lr-core`'s `getRider(frame).velocity`).
- **Spec format** for `v(t)` (v0/v1): piecewise — constant segments with
  optional linear ramps between them. More expressive forms deferred.
- **Tolerance ε_v**: not per-frame. Compared by **windowed mean** over `W = 4`
  frames (≈ 100 ms): the measured mean of `|v|` over each window must be
  within `ε_v` of the spec's mean over the same window.
  `ε_v = max(5% relative, 0.2 abs)`. Forgives instantaneous contact-noise
  while catching sustained deviation.

### Time tolerance

- `ε_t = 1 frame = 25 ms` for event timing. (Matches the standard cinema
  audio-visual sync threshold and is what the detector can measure to.)
- A `--strict` mode rejects any track with event drift > `ε_t`.
- Default mode is **best-effort + drift report**: produces the nearest
  feasible track and returns a per-event drift vector.

## Constraints and failure modes

### Event–speed coupling

**Events and speed are not independently controllable** in a single
geometric track. A primitive that produces a landing (ramp + airtime +
impact) also changes the rider's speed — the airtime adds gravity-driven
`v_y`, the landing redirects velocity, post-landing friction decelerates.

Priority (v0):
- When the spec constrains only events → events satisfied, speed reported.
- When the spec constrains both → **events first, speed best-effort**.
- A future opt-in flag could invert this priority.

The compiler must report drift on both axes regardless.

### Multi-segment continuity

A spec with segments `[0–10 s: v = 2; 10–15 s: v = 5; …]` is *not* a sequence
of independent problems. The rider state at `t = 10 s` is determined by what
happened before, and must (within ε) match the next segment's entry
requirements. The compiler plans across segments; the spec author is
responsible for boundary feasibility.

### Termini

A ride **does not satisfy the spec** unless `terminus.reason = endOfSpec` and
`terminus.frame ≥ specEndFrame`. Detection rules for the other reasons:

- `sledBroken`: lr-core's rider exposes `SLED_INTACT.isBinded() = false`.
- `rideStalled`: `|v| < v_stall` for `N` consecutive frames
  (concrete values TBD; first guess `v_stall = 0.05`, `N = 20`).
- `leftWorld`: rider position outside some envelope (probably not needed in
  practice but enumerated for completeness).

### Mechanical correctness ≠ visual quality

A spec-satisfying track can still look mechanical, ugly, or boring.
Aesthetic constraints are *out of scope* in v0 — we'll observe outputs through
the dashboard and let aesthetic requirements crystallize from real examples
rather than guess them up front.

## Trust and validation

The detector's output is the ground truth for everything downstream. We
therefore need to **visually verify the detector** before trusting it.

A **synchronized dashboard** is part of the substrate, not a polish item:
the rendered mp4 plays alongside time-aligned plots of measurements
(speed, airborne) with event markers overlaid, all sharing a cursor
driven by `video.currentTime`. The first version of any detector must be
passed through this view on real outputs — every visible thud / bounce /
redirect must align with a detector event of the right type — before
downstream code trusts it.

Implementation is flexible (a single HTML file with `<video>` + canvas is
sufficient). The dashboard itself is treated as substrate, but its
*implementation* is not specified here.

**Spec verification = re-running the same detector.** A spec is satisfied
iff `detect(simulate(track))` matches the spec's expected event list
(within `ε_t`) and the measured speed envelope (within `ε_v` windowed).
One source of truth, no parallel verification logic.

## Success criteria

Stated in order of dependency. Each is a falsifiable target.

- **Step 0 — substrate validation.** Detector + dashboard exist and agree
  with the eye on existing rendered tracks. *Acceptance*: scrubbing through
  `test.track.json`'s mp4 in the dashboard, every visible thud / bounce /
  redirect aligns with a detector event of the right type within `ε_t`.
  No compiler yet.
- **Step 1 — first event.** A primitive (parameterized geometry) that
  produces one landing within `ε_t` of a target timestamp, verified by the
  detector. No spec language yet — just "given target time T, get a track
  whose detector reports a landing at T".
- **Step 2 — chain.** Multiple events in sequence; the detector confirms
  them all within `ε_t`.
- **Step 3+** — additive: speed targets, varying-rate specs, mixed event
  types, multi-segment continuity. Each step a new falsifiable acceptance
  criterion; no fixed roadmap beyond this.

## What this document does not prescribe

The following are deliberately open, to be settled by experimentation:

- Compiler search strategy (greedy forward / templates / optimization /
  trajectory-first / hybrid).
- Primitive library — names, shape, parameter spaces, granularity.
- Spec input syntax — JSON / DSL / programmatic API.
- Whether `v(t)` for speed control should be solved analytically (slope ↔
  exit-speed closed form) or by oracle binary search per primitive — likely
  hybrid, decide when measured.
- How the dashboard is implemented (HTML, Electron, Jupyter, …).

## Resolved questions

- **Physics lineage** — lr-core is bit-identical to the rendering bundle
  (`npm run parity`). LRA-family is irrelevant to us.
- **Velocity definition** — `|rider.velocity|` from `getRider().velocity`.
- **Time tolerance** — 1 frame = 25 ms.
- **Initial conditions for v0** — lr-core defaults; specs constrained to
  achievable-from-default.
- **Event/speed priority** — events first when both are constrained;
  speed best-effort.
- **Visualization is substrate, not polish.**

## Open questions

- Concrete pre-check formulation for over-constrained specs (event spacing
  × current speed × minimum primitive size at that speed).
- How multi-segment specs handle state continuity at segment boundaries
  (compiler-internal; doesn't affect the spec language).
- Tuning `K` (bounce/landing threshold) and `θ` (kick threshold) — start
  with `K = 5`, `θ = 20°`, refine via dashboard validation. Open whether
  to ever learn these from labeled-disagreement feedback.
- Whether to ever allow acceleration lines as a speed-control tool:
  currently leaning against (aesthetic cost, harder scheduling) but not
  banned. Revisit if pure geometry can't track `v(t)`.

## Deferred (out of current scope)

- Multi-track / intensity / textural / structural sync.
- Causal illusion / theatricality.
- Music-driven spec generation.
- Camera/zoom triggers (the bundle's default camera follower is used).
- Compatibility with LRA-family physics forks.
- Visual / aesthetic constraints — will be addressed once we have early
  mechanical outputs to react to, not before.
