# Consolidation — stepping back, looking at `work`, and what the data says

This doc captures the decision (2026-05-28) to stop maintaining two forks of
the LDS compiler and finish `master` by porting `work`'s proven mechanisms,
plus the empirical findings that reshaped the plan. Companion to the approved
plan; aligned with `docs/compiler_goals.md`. No hand-waving — every claim
below is backed by a number we measured.

## The question we were actually facing

The Stage-2 study (`02b_empirical_study.md`) showed master's LDS was slower than
and below greedy_v1 at feasible budgets, with a huge apparent budget "overshoot"
(up to 802×). The instinct "maybe something is fundamentally wrong, maybe the
plan isn't the cleanest path" was right to check. We investigated three things:
the `work` branch, the real scores, and master's own cost structure.

## Finding 1 — the architecture is sound; both forks share it

LDS over cost-ranked candidates + best-so-far register + "budget only truncates
a fixed leaf enumeration `E`" satisfies the four properties *by construction*.
Monotonicity held empirically in the study (0 violations / 449 transitions).
`work` is the **same** architecture, just finished. We are not redesigning.

## Finding 2 — `work` is genuinely strong where it passes (measured)

Ran `work`'s LDS compiler (`compile(spec,{strategy:"lds",budget:budgetFor(spec)})`)
on master's full 13-spec suite via a git worktree, untimed scoring
(`scoreDriftReport`, directly comparable to greedy_v1's frozen 460.44). Partial
run (killed to free CPU for fast iteration) — 10 cells:

| spec | seed | work score | greedy_v1 | Δ |
|---|---|---|---|---|
| drums_signature | 0–4 | 587–641 | 423 | **+39…+51%** (5/5 pass) |
| drums_pendulum | 0,1,2,4 | 482–614 | 380 | **+27…+62%** (pass) |
| drums_pendulum | 3 | 0 | 380 | **FAIL** |

Takeaways: (a) `work`'s polish + recovery mechanisms unlock large quality gains,
even on `drums_pendulum` which we'd written off as "physics-saturated" (R5 was
too pessimistic); (b) `work` is **not** a turnkey 65/65 — it still fails the odd
cell (drums_pendulum s3); (c) `work` is **slow** — ~140s per big-spec compile.
So porting its mechanisms is clearly worth it, but the floor/slowness is real and
shared. (My first read "work fails drums_signature" was a harness field-name bug:
`work`'s score field is `passed`, and `score = passed ? 1000·axis : 0` is already
contract-gated. Corrected.)

## Finding 3 — the "heavy floor" was largely a METERING ARTIFACT (the big one)

`work`'s stats distinguish two counters that master had conflated:

| counter (work, drums_signature s0) | value |
|---|---|
| `physics_frames_computed` | 568,739 |
| `trajectory_frames_read` | 9,630,851 (≈17×) |
| `work_units_used` | = 16 × physics_frames |
| budget | overshoot only **1.22×** |

lr-core **caches** simulated frames: `getRider(f)` is O(1) after frame `f` is
computed once. Master's `sim_frames` counted *every read* (the 9.6M figure → the
illusory "40M floor"); the honest cost is frames the engine *actually integrates*,
measured as the delta in `engine.getLastFrameIndex()`. That is ~12–27× smaller.

Proven directly on master (`_probe_lastframe.ts`): reading 601 frames advanced
`getLastFrameIndex` 0→600 (600 new); reading the same window again advanced it
0 (all cached). The floor is not 40M frames of work — it's ~600k, and master was
billing the cache hits.

## Stage D0 (done) — honest physics-frame metering

Ported `work`'s metering into master cleanly (not cherry-picked):

- `scripts/lib/detector.ts`: added `_physicsFrames` charged by the
  `getLastFrameIndex` delta around each `extractRawTrajectoryWindow`, plus an
  exported `getRiderMetered()` for the 4 raw `getRider` probe sites in
  `compile.ts`. Kept the read-count (`getFrameCount`) as a secondary cross-check.
- `scripts/v0/optimizer/sim_frames.ts`: `getSimFrames()` now returns the physics
  counter.

Validated (`_probe_metering.ts`, 200k-physics budget, seed 0):

| spec | pass | score | physics | read/phys | ms/physFrame |
|---|---|---|---|---|---|
| tiny_dance | PASS | 769.5 | 200,334 | 27.2× | 0.331 |
| mini_burst | PASS | 615.1 | 201,224 | 16.8× | 0.271 |
| cold_start | fail | 0 | 210,556 | 12.4× | 0.269 |

- read/phys = 12–27× → confirms the over-billing across specs.
- **ms/physFrame ≈ 0.27–0.33 across specs** (and matches `work`'s 0.29 on
  drums_signature) → wall-clock tracks the honest unit. This is the Property-2
  win: the honest unit is also the wall-clock-predictive one.
- Cheat-resistant (Property 3): `getLastFrameIndex` is an lr-core primitive.
- Tests green (11/11: monotonicity, determinism, prefix-superset). Determinism
  and monotonicity are unaffected — the counter only feeds the budget cutoff.

Consequence: the budget *number* now buys ~17× more real work, so per-spec
`budgetFor` calibration rescales in Stage E. The floor problem dissolves: budgets
above ~one-complete-track (now ~hundreds of k, not tens of M) are meaningful.

## What's NOT fixed by metering

Honest metering makes the budget unit truthful; it does not make a big-spec
compile *fast* (drums_signature is still ~140s wall = ~570k physics × 0.29ms).
Wall-clock is genuinely dominated by physics frames. The dial now lets a user
trade quality for time honestly (lower budget → fewer leaves → faster, monotone
best-so-far), which is the intended behavior. Further speedups (fewer candidates,
cross-leaf simulation reuse) are optional and out of the current scope.

## Revised next steps (data-driven)

1. **Stage D0 — honest metering. DONE & validated.**
2. **Stage B — polish-as-clone-and-test.** Biggest quality lever per Finding 2.
   Port `work`'s `polishLeafVariant` (clone fits, run existing in-place helpers,
   fingerprint-diff, offer as a new leaf). No 14-helper refactor.
3. **Stage C — recovery leaves.** Coverage lever; closes failing cells like
   cold_start / drums_pendulum that polish alone won't.
4. **Stage E — rescale `budgetFor` to physics-frame units; wire LDS into the
   golden suite; parity gate vs greedy_v1.**
5. **Stage F — acceptance sweep + cutover; delete the duplicate `work` compiler.**

## Artifacts (investigation; removed at cutover)

- `scripts/v0/optimizer/_probe_lastframe.ts` — caching proof.
- `scripts/v0/optimizer/_probe_metering.ts` — read-vs-physics validation.
- `/tmp/work_tree` — git worktree of `origin/work` (+ 5 newer spec files copied
  in to run its compiler on the full 13-spec suite); `/tmp/stageA_work.json`.
