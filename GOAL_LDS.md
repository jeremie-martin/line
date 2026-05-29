# Goal — the standalone LDS compiler (operating charter)

> **This is an operating contract for an autonomous optimization agent — you.**
> You will be run in a loop: change the compiler, measure, keep or revert, repeat,
> until the stop condition holds. This document is the *context you need to
> interpret the harness correctly* — read it fully before you start, and re-read
> §3–§6 before any change you're unsure about. The harness gives you numbers; this
> charter gives those numbers meaning.
>
> It is deliberately self-contained. Deeper background (the four properties and
> their acceptance tests) lives in `docs/compiler_goals.md`; day-to-day working
> discipline in `docs/HOW_TO_WORK.md`. You should not *need* them to operate.

---

## 0. The job, in one screen

- **What you change:** the compiler in `scripts/v0/optimizer/*` (the search, sampling,
  ranking, repair, the register, optimizer-side constants).
- **What you optimize:** `goal_score` over the golden suite, with `contract_pass_rate`
  as the shippability gate (§1).
- **How you measure:** `npm run golden` and its modes — your **instrument**, not a
  judge (§2). It reports rich signal; *you* reason about it.
- **The loop:** propose one change → `--fast` probe → keep/revert by judgment →
  full run before you commit (§4).
- **The one hard rule:** **determinism** — same `(spec, seed, budget)` → byte-identical
  `Track`. Break it and nothing else you measure can be trusted (§3). Everything
  else is signal + your judgment, not a wall.
- **The spirit:** you have wide freedom *inside* `optimizer/*`. The walls around it
  (the scorer, the specs, the physical constants) are fixed on purpose, and some are
  watched mechanically (§5–§6). Use your intelligence on the search; don't spend it
  finding ways to satisfy the metric's letter against its intent.

---

## 1. What we optimize

The compiler turns a `Spec` into a Line Rider `Track` so the simulated rider lands on
the spec's contacts and exhibits its section character (air, speed, grain,
contact_style). Two numbers describe a run:

- **`goal_score`** — the gradient you climb. A smooth product of quality factors,
  aggregated over the golden suite (`specs/golden/`, seeds `[0,1,2]`), each spec at
  its calibrated **sim-frame budget**.
- **`contract_pass_rate`** — the fraction of `(spec, seed)` runs meeting *every* hard
  invariant (`drift==0 && missing==0 && off_beat==0 && terminus==endOfSpec`). This is
  shippability. Aim: `→ 1.0`.

Per `(spec, seed)`, the score is a product of factors in `[0,1]` (`scripts/v0/score.ts`,
no time term on the LDS path):

```
axis_quality     = exp(-rms(|axis_error|) / AXIS_QUALITY_TOLERANCE)
drift_quality    = exp(-rms(max(0,|frame_error|-1)) over LANDED contacts / SYNC_TOLERANCE)
missing_quality  = exp(-missing_count / MISSING_CONTACT_TOLERANCE)
off_beat_quality = exp(-off_beat_count / OFF_BEAT_TOLERANCE)
survival_quality = 1 if terminus==endOfSpec else terminus.frame / total_frames
spec_seed_score  = 1000 * axis * drift * missing * off_beat * survival
spec_score = shiftedGeometricMean(spec_seed_score over seeds)
goal_score = shiftedGeometricMean(spec_score over specs)
```

Tolerances: `AXIS_QUALITY_TOLERANCE=0.25`, `SYNC_TOLERANCE=1.0`,
`MISSING_CONTACT_TOLERANCE=1.0`, `OFF_BEAT_TOLERANCE=1.0`. Hard-contract violations
**degrade smoothly** (they don't zero the score), so you always have gradient.

**The most important thing to understand about this metric.** The product and the
shifted-geomean are **zero-sensitive**: one hard-failing spec drags `goal_score` hard,
and when *several* specs fail the headline collapses toward zero — so `goal_score`
alone gives you almost no gradient about *which* change helped. **The gradient lives
in the breakdown, not the headline.** Always read the per-spec / per-seed / per-factor
rows and the progress signals (contacts landed `hits/contacts`, `missing`,
`survival_quality`, `off_beat`, per-axis error). A change that moves `drums_pendulum`
from "dies at frame 200" to "dies at frame 600" is *progress* even while `goal_score`
is unchanged at near-zero — the headline can't see it, but the breakdown can. Climb
the breakdown; the headline follows once a spec actually crosses into passing.

This zero-sensitivity is intentional (it forces *cracking* the hard specs rather than
polishing the easy ones), not a bug to engineer around — see §6.

---

## 2. The harness is your instrument

`scripts/v0/golden.ts` (`npm run golden`) is how you see. Treat it as a fast,
informative tool you collaborate with — **not** a yes/no gate you work against. It
prints rich, disaggregated signal precisely so you can diagnose, not just grade.

### Canonical vs. indicative

Exactly one shape of run defines `goal_score`: **the full LDS suite, all specs, all
seeds, default budget.** That is *canonical*. Anything narrower — `--fast`, `--budget`,
`--specs`, `--seed` — is **indicative**: useful signal for iterating, never
the metric of record. The harness labels indicative runs `NON-CANONICAL (indicative
only, NOT goal_score)` and refuses to print `GOAL_SCORE` for them. Never report or
commit against an indicative number as if it were the goal.

### Commands

```
npm run golden                              # CANONICAL goal_score (lds default; parallel, ~minutes)
npm run golden -- --fast                    # indicative: FAST_SPECS subset, seed 0, small budget (~30-45s)
npm run golden -- --specs=tiny_dance,cold_start --seed=0 --budget=40000   # targeted probe
npm run golden -- --variants                # + generalization probe (perturbed timing/stretch)
npm run golden -- --jobs=N                  # worker parallelism (default min(6, cpus-1)); does not affect scores
npm run golden -- --json | --details | --json-full     # machine-readable / per-row diagnostics
npx vitest run tests/optimizer_*.test.ts    # the property tests (§3)
```

Runs execute in isolated workers through a bounded pool: parallelism is safe
(each compile is independent + deterministic; scores are unaffected) and a single
runaway compile fails its own row gracefully (scored 0) rather than aborting the
suite. The full run is still minutes — the budget-exempt drums floors dominate
(§8) — so **iterate with `--fast`**, not the canonical run.

**Inner loop = `--fast`** (or a targeted `--specs/--budget/--seed`): seconds, not
minutes. The agent has no felt sense of time but the human running you does — do not
launch the full canonical suite after every edit. Probe fast, and pay for the full run
only when a change looks good and before you trust or commit it.

`--fast` covers cheap-floored specs only (`tiny_dance`, `mini_burst`, `cold_start`,
`rhythm_ladder`); the hard specs have budget-exempt floors that no budget cut can
speed up, so a fast probe can't tell you about them — use a targeted `--specs` run for
those.

### How to read the report

Each row: `STATUS  score  sync=hits/contacts (drift,miss,off)  axis=% (loss,maxErr)`.
The summary adds per-spec scores, per-seed scores, `contract_pass_rate`, and the
**worst rows / worst axes / worst contacts** — your first stop for "where is the gap."
`--json` adds `compile_stats` per row (sim_frames, gap_commits, etc.) — your structural
diagnostics (is this getting cheaper / simpler?). Read the breakdown, not just the top
line (§1).

### Two built-in safeguards you'll see in the output

- **`evaluator_fingerprint <hash>`** (printed every run) — a hash of the "ruler"
  (`score.ts` + `specs/golden/*`). If it shows `⚠ DRIFTED`, the scorer or a spec
  changed and your scores are no longer comparable to history. You should not be
  editing those (§5); if a change was deliberate, the constant
  `EVALUATOR_FINGERPRINT` (golden_suite.ts) is updated in the same commit.
- **`--variants` = your generalization probe.** It re-runs each spec with perturbed
  contact timing (`+25ms`) and a slight time-stretch (`×1.02`). A *large* base-vs-variant
  gap means you've overfit to exact spec timings rather than learning the intent.
  This is the lightweight "held-out" signal — check it before declaring victory.

---

## 3. The four properties (the real contract)

The rebuild's value is not just the score but the properties that make it
*debuggable* (`docs/compiler_goals.md`). A change that raises `goal_score` while
breaking a property is **not** an improvement.

1. **Determinism — the ONE hard rule.** Same `(spec, seed, budget)` → byte-identical
   `Track` **for a given build of the compiler**. No unseeded RNG, no wall-clock inputs.
   This is non-negotiable because if it breaks you can no longer tell a real improvement
   from noise — the entire premise of the loop collapses. Treat a determinism failure as
   a hard STOP-and-fix.
   **This is reproducibility, NOT output-stability across changes.** Improving the
   compiler is *expected* to change the `Track` for a given `(spec, seed, budget)` — that
   is the whole point. "Byte-identical" is the right check only when verifying a *refactor*
   that should change nothing; for a genuine improvement the guardrail is instead
   "properties still green + `goal_score` does not regress." Never let byte-identicality
   become a reason not to improve the output.
2. **Monotonicity-in-budget** — for the same `(spec, seed)`, more compute never yields
   worse contract-gated quality. It holds because the leaf-enumeration *sequence* is a
   **deterministic prefix-superset in budget** (base floor → guided-repair chain →
   `d=1..maxD` deviation sweep — *not* a globally discrepancy-sorted order; the budget
   only truncates a fixed sequence). Reported, judged — see the property tests.
3. **Cheat-resistance** — the budget unit is **simulated rider frames** (charged at the
   trajectory-extraction boundary). Extra search work can't be hidden; it shows up as
   more frames. Sim-frames are wall-clock- and thread-count-independent *by design*:
   when multi-processing lands it will lower wall-clock but **not** change sim-frames,
   so the budget stays meaningful. Wall-clock is a *separately reported, single-core-
   referenced* diagnostic, never part of the contract.
4. **Wall-clock predictability** — per-budget-unit wall-clock is stable across
   specs/seeds. A reported property, not a score term.

**How they're checked:** the property tests in `tests/optimizer_*.test.ts` — notably
`optimizer_lds.test.ts` (determinism byte-identical, the prefix-superset property,
`d=0`-equals-greedy) and `optimizer_anytime.test.ts` (the comparator key is
non-decreasing in budget). Run them after any change to the search/enumeration. They
are the executable form of properties 1–2; treat a red property test as a real
regression, not noise.

---

## 4. The loop & when to stop

1. **One mechanism per step.** Make a single, explainable change (§6). Don't bundle.
2. **Probe fast.** `--fast` or a targeted `--specs/--budget/--seed` run. Read the
   *breakdown* (§1) — did the thing you targeted move? Did anything else regress?
3. **Keep or revert — your judgment.** Keep a change if it's a real improvement *or* a
   net-positive trade (e.g. a simplification that's cleaner/more general and only
   slightly worse on a possibly-overfit row). You own this call; there is no automatic
   ratchet. But the bar for *accepting a regression* is high and explicit (next point).
4. **Regressions are allowed, never silent.** The harness surfaces every per-spec delta
   and pass→fail flip. If a change regresses a spec that was passing, you must justify
   it concretely — robustness, generality, simplicity, removing overfit — in the commit
   message. "It improves this other row" is not enough. When in doubt, prefer the
   change that makes the compiler *simpler and more general*, even at a small score cost.
5. **Confirm before committing.** Run the **canonical** `npm run golden` and the
   property tests (§3). Only a canonical run tells you the true `goal_score` /
   `contract_pass_rate`. Check `--variants` for overfitting.
6. **Stop condition.** Stop when **`contract_pass_rate == 1.0` on the canonical run, all
   property tests green, and `goal_score` has plateaued** (no accepted change has moved
   it for several iterations). Short of that, the highest-leverage work is whatever the
   breakdown says is failing — today, the genuinely-hard specs (§8).

---

## 5. What you may change / what's off-limits

**You may change** (this is your sandbox — be ambitious here):

- The optimizer itself: `scripts/v0/optimizer/*` — sampling, ranking, the search, the
  repair, the register comparator.
- **Optimizer knobs** — the optimizer's own `BASE_BACKTRACK_DEPTH` / `REPAIR_ROUNDS_CAP`,
  `CALIB.{K, BACKTRACK_DEPTH}` in `types.ts`, and candidate ranking/targeting. New
  optimizer-side constants are fine; re-baseline any kept constant.
  (`CALIB.FINAL_VALIDATION_RETRIES` is **vestigial** on the LDS path — the standalone
  search replaced the validation-retry loop with guided-repair leaves. Don't reach for it.)
- **`budgetFor(spec)`** (`golden_suite.ts`) — per-spec compute calibration (contact-count
  / density-based, *generalizing*; never per-spec-name).
- **Most `CALIB.ARC` bounds** — angles + anchor offsets shape *where* the search looks;
  context-conditional derivations (per-section, per-gap, per-rider-state) are encouraged.
  Uniform widening breaks high-speed sections — condition on the gap's targets.

**Off-limits** (the walls; some are mechanically watched):

- The **scorer** (`score.ts`, `golden.ts` scoring) and **golden specs**
  (`specs/golden/*`). These define the objective; you do not get to move the goalposts
  to score points. **Watched:** the `evaluator_fingerprint` tripwire (§2) makes any edit
  here visible. Changing them is a deliberate *charter revision*, not optimization.
- **Semantic / physical constants** — `FPS`, `SPEED_CAP`, `LINE_LENGTH_CAP`, `SIGMA`,
  `CALIB.ARC.{LENGTH,SEGMENTS}_MIN/MAX`, `START_DEFAULT`/`PREROLL`. If a target is
  unreachable inside the physical envelope, that's *information about the optimizer* —
  don't widen the world to score points.
- **Determinism** (§3) — enforced by the byte-identical property test.

---

## 6. Design discipline (how to stay aligned)

These are prose, not gates, because you're capable enough to honor them — and because
the harness can't fully express them. Hold to them; they're what keep a score win from
being a hollow one.

- **No overfitting.** No spec-name / seed / branch-artifact detection. Every change must
  be explainable from local physical state + authored intent (gap duration, contact
  spacing, sampled targets, rider state, candidate survival, measured error). Density /
  contact-spacing heuristics that generalize are fine. The `--variants` gap (§2) is your
  check.
- **Smooth over thresholds.** Continuous influence (interpolation, smoothstep, falloff)
  except at true contract boundaries / finite search budgets.
- **Every heuristic justified.** State the failure mode it addresses, the signal that
  activates it, why that scale, and how it avoids hurting other specs. "It improves this
  golden row" is not a justification — that's the road to overfitting.
- **Simplicity is a feature.** A smaller, more general compiler that scores slightly
  lower can be the better compiler. Prefer removing special-casing over adding it; prefer
  generalizing a mechanism over stacking another constant on top of it.
- **Don't game the metric.** The zero-sensitive geomean is meant to make you *crack hard
  specs*, not discover that nudging an easy spec's smooth factor is cheaper. If a change's
  only story is "the number went up," distrust it.

**What's mechanical vs. prose:** determinism (test), the evaluator fingerprint (tripwire),
and the property tests are enforced. Overfitting, simplicity, and justification are *your*
responsibility, surfaced by the breakdown, the `--variants` gap, and regression deltas.
The split is deliberate: maximum freedom inside the sandbox, hard walls only where
objectivity is possible.

---

## 7. The compiler today (`scripts/v0/optimizer/`)

A **standalone** limited-discrepancy search — **no legacy floor, no fallback**:

- `buildBacktrackingLeaf` (`lds.ts`) — the **d=0 base path**: a deterministic
  explicit-stack greedy descent with bounded cross-gap backtracking and a skip-march
  fallback. Its own completion guarantee (it replaced the legacy `compile()` floor).
  Note its forward-progress guarantee comes from the *skip fallback*, not from the
  `BASE_BACKTRACK_DEPTH` value — the depth is performance tuning, not correctness.
- **Guided-repair leaves** — when the assembled track misses or lands off-beat, the
  owning gap's committed candidate is forbidden and the backtracking descent re-runs;
  the result is offered as an ordinary deviation leaf (budget-subject, deterministic).
- **Base-rotated deviations** (`enumerateDeviations`) — discrepancy = edit-distance from
  the base path; low-d leaves explore completions *near* a completing track.
- Best-so-far **register** (`register.ts`) — strict-improvement-only under a deterministic
  comparator (`contract_passed ≻ axis_quality ≻ on-beat tightness ≻ full score`). This
  register is the single source of truth for leaf selection.

`compile.ts` (the preview greedy compiler) is **no longer invoked** — reused only for
held-constant geometry/detection primitives (`sampleArcParams`, `tryCandidate`,
residual/detection helpers) via `export`.

### Hard contract (physical honesty)

1. **Determinism** — §3.
2. **lr-core in the loop** — every geometric decision validated by `lr-core` + `detect`;
   approximate physics is never the source of truth.
3. **Beat sync is physical sync** — matched beats are detected landings at the requested
   contacts, not report-side accounting.
4. **No off-beat landings** — any landing not aligned with a Contact is a hard fail.
5. **Axis honesty** — measured section axes in `DriftReport` are tied to the finished
   track, not candidate-side intent.

---

## 8. Open problems (the current frontier — living section)

The honest gaps. Append findings here as you learn; this is your lab notebook.

> **Capability backlog:** the concrete, verified, sequenced improvement plan for the gaps
> below lives in **`docs/optimizer/improvement_backlog.md`** — start there. It covers the
> base-relative repair-discrepancy fix, repairable skips, candidate lanes, polish gating,
> and diagnostics, in priority order, with the verification each needs.

- **Genuinely-hard specs.** `dense_sprint` and `drums_pendulum` fail the contract even at
  large budgets — `dense_sprint`'s miss is a base-path *skip* the repair can't recover;
  `drums_pendulum` a stuck off-beat. They need new *search capability* (better candidate
  generation / look-ahead), not more budget. Because of the geomean's zero-sensitivity,
  these cap `goal_score` until cracked — the breakdown (§1) is how you measure progress
  toward them before they flip to passing.
- **`drums_crescendo`'s expensive base floor.** Its budget-exempt backtracking descent
  thrashes (~460k sim-frames) and still misses. Understand *why* it backtracks so much
  before leaning on budget to mask it.
- **The completion story rests on padded constants.** `BASE_BACKTRACK_DEPTH`, `STEP_CAP`,
  `REPAIR_ROUNDS_CAP` are empirical ceilings, not a principle; the real guarantee is the
  skip fallback (which silently drops contacts when the depths are undersized). A
  principled completion guarantee would be a deeper fix than tuning these.
- **Candidate-generation quality.** The optimizer samples `gap.targets` directly;
  residual/look-ahead targeting was tried and *refuted* (it traded contact-landing for
  axis-alignment and broke a passing spec). A better-aligned generator that lands more
  contacts *at the floor*, cheaply, remains the highest-leverage open lever.
