# Goal — satisfy the v0 compiler contract quickly

Maximize `goal_score` over the three reference specs in `specs/golden/`:

- `drums_signature` — 3-act, `contact_style` swap at constant high speed.
- `drums_pendulum` — 6-act, only `air` flips ±0.70 every 5s.
- `drums_crescendo` — 3-act, all four axes grow monotonically.

Each spec is 30 s against `beats/drums_0_30s_60_125.json`. Together they
exercise axis-isolation contrast, single-axis oscillation, and graduated
multi-axis coupling — distinct failure modes the compiler must handle.

## Score

Per spec:

```
hard gates:
  all contacts hit within ±1 frame
  survived through endOfSpec
  off_beat_landings == 0
  elapsed_time <= 45s

sync_score = contacts_hit_within_1_frame / total_contacts
axis_score = clamp(1 - mean_axis_error / 0.25, 0, 1)

spec_score = 0 if any hard gate fails
spec_score = 1000 * sync_score * axis_score otherwise

goal_score = mean(spec_score across specs)
```

Runtime is a gate, not an optimization term. A correct run gets no extra
credit for finishing faster than 45 s; an over-budget run is a timeout.

## Preroll

A spec may declare `preroll: N` seconds (capped at 10s; see `PREROLL.MAX_S`
in `types.ts`). The compiler is then handed a synthetic `[-N, 0]` prefix in
front of the real spec timeline — free territory where it can place any
geometry to deliver the rider into spec-frame 0 in a state that makes the
rest of the compile easier (rough position, velocity, contact history).

What goes in the preroll: anything the engine accepts. Free-form arcs,
chains, energy-bleeding bouncers, deliberately-shaped landings. The
compiler treats it as its own synthetic block.

What it does *not* affect: scoring. The `DriftReport` already strips
preroll contacts and any landings in `[0, prerollFrames)` before returning;
axis measurements, contact sync, and off-beat checks therefore apply only
to the real spec sections. Compute and geometry spent inside the preroll
is pure upside for the optimizer — no metric penalty for using it.

The current implementation (`extendSpecWithPreroll` + `unshiftReport` in
`compile.ts`) seeds the preroll with a section mirroring §0's axes plus
synthetic contacts every `CONTACT_SPACING_S`. That's a reasonable starting
point but not load-bearing; the preroll is yours to redesign — e.g.,
gradient axes from a "neutral" initial state to §0, contact-free pure
ballistic setup, conditional contact spacing. Treat it as a search
affordance, not a fixed prelude.

## What You Can Change

High-leverage areas:

- `scripts/v0/compile.ts`
- `scripts/v0/arc.ts`
- **Optimizer knobs** in `scripts/v0/types.ts`'s `CALIB`: `K` (per-gap
  candidate budget), `BACKTRACK_DEPTH`, `OFF_BEAT_RETRIES` (final-track
  validation retries). Adding new optimizer-side constants is fine.
- **Most `CALIB.ARC` bounds** — angles (`START_ANGLE_MIN/MAX_DEG`,
  `END_ANGLE_MIN/MAX_DEG`) and anchor offsets (`ANCHOR_X_OFFSET_MIN/MAX`,
  `ANCHOR_Y_OFFSET_MIN/MAX`) shape *where* the search looks and are fair
  game. Replacing the static bounds with context-conditional derivations
  (per-section, per-gap, per-rider-state) is encouraged — the open finding
  is that uniform widening breaks high-speed sections, so conditioning on
  the gap's targets is the path forward.

Do **not** change semantic constants — anything that defines how the world
looks or behaves physically. The goal is to improve the optimizer, not to
change what good tracks look like. If a target is unreachable inside the
current physical envelope, that is information about the optimizer; don't
widen the envelope to score points. Off-limits (non-exhaustive):

- `FPS`, `SPEED_CAP`, `LINE_LENGTH_CAP`, `SIGMA` in `types.ts`
- `CALIB.ARC.LENGTH_MIN/MAX` and `CALIB.ARC.SEGMENTS_MIN/MAX` — these
  determine how each Arc *looks* on screen, not where it can sit
- any `START_DEFAULT`, `PREROLL`-style initial-condition or framing
  constants introduced later

Do not change the scorer (`scripts/v0/score.ts`, `scripts/v0/golden.ts`) or
the golden spec files (`specs/golden/*.ts`) to improve the score. Metric or
suite changes are allowed only when the goal itself is deliberately revised.

## Hard Contract

1. **Determinism**: same `Spec` + same `seed` must produce byte-identical
   `Track`. No unseeded `Math.random()`, no time-based inputs.
2. **lr-core in the loop**: every geometric decision must be validated by
   `lr-core` plus `detect`; approximate physics cannot be the source of truth.
3. **Beat sync is physical sync**: matched beats must be detected landings at
   the requested contacts, not camera edits or report-side accounting.
4. **No off-beat landings**: any landing not aligned with a Contact is a hard
   failure.
5. **Axis honesty**: measured section axes in `DriftReport` must stay tied to
   the finished track, not to candidate-side intent.
