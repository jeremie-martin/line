# The short forward-eval leaf — problem & tooling

## The observation

Forward-eval ranks candidate arcs by a charged greedy:2 rollout whose terminus is
scored by a **leaf scorer**. There are two:

- **FULL leaf** (`forwardNodeScore`, the default): re-detects the whole composed
  partial track with the engine and runs the true scorer.
- **SHORT leaf** (`objectiveLeafValue`, behind `LR_FWD_EVAL_LEAF=objective`):
  reconstructs the same score from the rollout's already-committed gap fits, with
  **zero** engine frames past each arc's geometric exit — the minimal-simulation rule
  (engine inside arcs and on real DFS expansion; ballistic from the arc exit
  everywhere else).

The short leaf is the enabling primitive for *wide* rollouts (many continuations per
arc), which are only affordable if each leaf is arc-to-exit + ballistic rather than a
full re-detection. The full leaf is the reference it must reproduce.

## The goal

**Make the short leaf at least as performant as the full leaf — measured by
`eval_short_leaf.sh` — without cheating** (no engine simulation smuggled past the arc
exit, no per-spec carve-outs, no A/B knob hiding the full leaf inside the short path).

Beyond the number, the standing bar is a **clean, simple, conceptually-sound codebase**:
one source of truth for the ballistic propagation, no workarounds, no parallel
reimplementations. Everything else in this directory — the analysis, probe and
telemetry scripts below — exists only to gather empirical evidence about where the
short and full leaves diverge. **They are tooling, not the target.** The target is the
short leaf reaching parity on the headline script.

## Current status

The catastrophic collapse (the objective leaf drove `drums_crescendo` to 0/10 valid)
is solved and committed (`bf49062`): with the reconstruction at
`axis × survival × missing`, `drums_crescendo` and `solo_run` reach parity with the
full leaf at ~21% fewer rollout frames. The short leaf is still flag-gated
(`LR_FWD_EVAL_LEAF` defaults to `full`). The open residual is **`big_air_ramp`**, where
the short leaf still trails the full leaf — closing that, through the short leaf, is the
remaining work.

## The measurement of record

- **`eval_short_leaf.sh`** — the headline and the target metric. Runs the golden suite
  with the short leaf on the focus board (`drums_crescendo`, `solo_run`, `big_air_ramp`
  × 100k/200k/300k × 12 seeds) against a one-time full-leaf baseline it builds and
  reuses, runs `decide`, and prints per-track×budget deltas plus per-axis/factor
  diagnostics. This is the bird's-eye view; the comparison that decides whether the
  short leaf has reached parity.

## The analysis / telemetry scripts (tooling)

Each isolates one layer of the short-vs-full question. Run any with
`LR_ENGINE=wasm npx tsx scripts/v0/<name>` (args via `--spec= --seed= --budget=`).

- **`eval_arc_apples.ts`** — per-arc apples-to-apples. From one real mid-track rider
  state, samples ~1000 candidate arcs and measures each two ways: short (engine through
  the arc + ballistic suffix) vs full (full re-detection). Separates per-arc
  *measurement* difference from *search* divergence; reports per-axis divergence and
  whether the two leaves rank the same arcs.

- **`eval_pergap_vs_composed.ts`** — on one committed track, compares each gap's
  ballistic `achieved` (what the short leaf reads) against the engine measurement of
  that gap inside the whole composed track (what the full leaf reads), per axis. Tells
  whether the ballistic reconstruction of the axes loses information relative to the
  composed-track measurement.

- **`eval_leaf_factors.ts`** — per offered node from a real compile, computes both
  leaves' factor breakdown on the identical node and reports, per factor
  (axis / drift / off_beat / missing / survival), the gap between the short leaf's
  reconstruction and the full leaf's measurement.

- **`eval_ballistic_vs_engine.ts`** — the airborne model in isolation. From the exact
  engine launch state at an arc exit, propagates the production ballistic and compares
  predicted vy/y to the engine truth frame by frame (dt=0 error is 0 by construction).
  Characterizes the ballistic model's own error over a flight.

- **`eval_rollout_ranking.sh`** — rollout-INTERNAL ranking telemetry. Runs the compiler
  in shadow mode (ranks by the full leaf, byte-identical, while also computing the short
  leaf value + per-factor breakdown of every pool candidate's rollout leaf — handoff.ts
  `LR_SHADOW_FACTORS=1`, gated). Reports per pool: top-1 short-vs-full agreement, the
  "real cost" of disagreements, and on each disagreement the full-measured factor
  breakdown of the full winner vs the short winner. Catches the mis-ranking in the
  rejected branches, not the committed path.

## The mechanism

`docs/forward-eval-map.html` is the verified logic map of the whole pipeline — pool
generation, ranking, the rollout, and both leaf scorers spelled out side by side with
the true scorer's five factors. Read it for *how* the short leaf reconstructs each
factor; this file is *what* we are trying to do and *which scripts* measure it.
