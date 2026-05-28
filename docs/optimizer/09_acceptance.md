# Acceptance & cutover readiness

Where the four properties and parity stand after Stages B/C/D0/E, and an honest
account of what cutover does and does not include. Aligned with
`docs/compiler_goals.md`.

## The compiler, in one paragraph

`compileLDS` is the compiler. Its mandatory-prelude **floor** is the proven
backtracking greedy descent (the legacy `compile()` that greedy_v1 measures),
seeded into a best-so-far register; **LDS discrepancy enumeration + polish**
(clone-and-test) then refine on top, bounded by a **budget** metered in honest
**physics frames** (frames the engine actually integrates, via
`getLastFrameIndex`). The register keeps the best leaf under a strict-improvement
comparator. So "discrepancy-0 = the greedy track, coverage ≥ greedy by
construction" is realized with a *proper* greedy floor. Legacy `compile()` is
therefore a **dependency** of `compileLDS` (the floor primitive), not a rival
compiler — "one compiler" means one entry point, `compileLDS`.

## The four properties

### P1 — Monotonicity in budget — HOLDS (by construction + tested)
The leaf enumeration `E` is budget-independent; budget only truncates a prefix;
the register only swaps on strict improvement; the floor is always present. So
`contract_gated_quality` is non-decreasing in budget by construction. Verified:
the CI property test (`optimizer_anytime.test.ts`) passes across all changes, and
the Stage-2 study found 0 violations / 449 transitions.

### P2 — Wall-clock predictability — HOLDS (cv 0.110)
`wall_ms / physics_frames` across the full 13-spec suite (seed 0, at `budgetFor`):
min 0.253, mean 0.294, max 0.369 ms/frame, **pooled cv = 0.110** — well under the
0.25 gate. This is the honest-metering payoff: the read-based unit had pooled
cv 0.262 (the cache-hit re-reads were noise); physics frames track real
computation and so track wall-clock. Per-spec cv is even tighter.

### P3 — Cheat-resistance — HOLDS (design audit)
The budget unit is **physics frames**, charged as the delta in
`engine.getLastFrameIndex()` across each trajectory extraction / metered
`getRider` (`scripts/lib/detector.ts`). This is an lr-core primitive the optimizer
does not control:
- You cannot establish a candidate's physical viability (does the rider hit the
  contact ±1 frame, survive, exhibit the axis profile) without simulating its
  frames. Any genuine extra search work therefore advances `getLastFrameIndex`
  and is charged proportionally.
- Non-simulating work (geometry math, candidate ranking, cache lookups, polish
  fingerprinting) does not advance the simulation frontier and is not charged —
  correctly, because it does not change the physical result. Re-reading an
  already-simulated frame costs 0 (verified: `_probe_lastframe.ts`).
- To inflate "work per budget unit" a future change would have to either modify
  lr-core (out of scope per `compiler_goals.md`) or perform additional real
  simulation — which shows up as proportional wall-clock (P2). There is no
  inflation vector. The legacy `engine_add_lines` / `trajectory_frames_read`
  counters are retained as cross-checks.

### P4 — Determinism — HOLDS (tested)
`compileLDS(spec, seed, opts)` is a pure function of its inputs: RNG seeded only
by `(seed, gap_index)`, fixed enumeration order, deterministic comparator, budget
cutoff a pure function of the physics counter, floor (legacy `compile`)
deterministic. The CI test (`optimizer_lds.test.ts`) asserts byte-identical Tracks
across repeated calls; passes across all changes.

## Parity — MET and exceeded (seed 0; holds for all seeds by construction)

Apples-to-apples LDS-s0 vs greedy_v1-s0 at `budgetFor`: goal_score **503.93 vs
462.24 (+9%)**, contract-pass **13/13**, **no spec below greedy_v1** (8 exact-match
floor, 5 improved). The floor=legacy construction guarantees LDS ≥ greedy_v1 per
(spec, seed), so the 5-seed goal_score is ≥ greedy_v1's frozen 460.44 as well; a
multi-seed `golden --lds` run confirms the definitive number. `golden.ts --lds`
reproduces it (tiny_dance 769.19, time_multiplier=1). See `08_budget_curves.md`.

## Cutover: what is done, and what is deliberately deferred (honest)

Done / safe:
- `golden.ts --lds` is wired, validated, and scores on the untimed (pure-quality)
  basis matching the frozen baseline.
- Scratch probes (`_probe_*`, `_diag_floor`) are investigation-only and excluded
  from commits; they can be deleted at any time.

Deferred, with reasons (NOT done tonight, to avoid breaking a working workflow):
- **Default-swap of `golden` to lds:** deferred until big-spec speed is addressed.
  On dense specs (drums family, solo_run) LDS deviations dead-end, so budget above
  the floor is wasted wall-clock (solo_run ≈ 6.7 min/seed at `budgetFor`). Making
  the standard benchmark that slow is a workflow regression. lds is the intended
  default once the speed item lands; for now it is opt-in via `--lds`.
- **Removing the `time_multiplier` machinery from `score.ts`:** the legacy/timed
  path is still the `golden` default and still uses it; removing it now would
  change legacy's reported scores and break `v0_score.test.ts` for no current
  gain. Retire it together with the default-swap.
- **Big/slow-spec speed (point 6):** the real fix is letting LDS deviations
  *complete* on dense specs (a backtracking leaf builder), which both lets LDS
  exceed greedy there and removes the wasted above-floor budget. This is the last
  item and must not regress any other spec.

These deferrals are judgment calls in line with "never break what works"; each is
a small, well-scoped follow-up, not an open-ended risk.
