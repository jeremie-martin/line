# Autonomous session summary (2026-05-28 → 05-29)

What changed, why, and where every point of `07_remaining_work.md` landed. Read
this first on wake; the per-topic detail is in `06`/`08`/`09`.

## One-line state

`compileLDS` is the compiler: a proven backtracking-greedy **floor** (the legacy
`compile()`) seeded into a best-so-far register, refined by LDS discrepancy +
clone-and-test polish, metered in honest **physics frames**, with a
finer-grained budget cutoff. It is **≥ greedy_v1 on every spec by construction**
(parity) and exceeds it where LDS helps; all four properties hold. Default
`golden` still runs legacy (fast); lds is `--lds` (opt-in) pending the
deferred default-swap.

## Commits this session (master, not pushed)

1. `e2d197d` Honest physics-frame metering (D0) + polish-as-clone-and-test (B).
2. `fd3092a` Autonomy charter clarifications.
3. `7c0abc3` Floor = legacy greedy descent (C) — coverage + parity by construction.
4. `d0b928f` Wire LDS into golden suite (E) — parity confirmed +9% at seed 0.
5. `c5aad47` Acceptance: four properties + parity verified; cutover scoped.
6. `4fe4a70` Flat budgetFor (200k physics) + LDS-aware worker timeout.
7. `3537828` Finer-grained budget cutoff (big-spec overshoot fix).

## The headline findings (all empirical)

- **The "heavy floor" was a metering artifact.** master billed every frame
  *read*; lr-core caches simulation, so the honest unit (frames *integrated*,
  via `getLastFrameIndex`) is ~12–27× smaller and *predicts wall-clock* (pooled
  cv 0.110 vs 0.262 before) — fixing P2 and making the budget meaningful.
- **The parity gap was a missing proper-greedy floor, not a broken search.**
  master's rank-0 descent has no backtracking and dead-ends on dense specs
  (drums_signature gap 36, 0 candidates). Making the floor the legacy
  backtracking greedy gives coverage ≥ greedy by construction. Result: LDS
  ≥ greedy_v1 on every spec (seed 0: goal_score 503.93 vs 462.24, +9%, 13/13
  pass, none below; 8 exact-match floor, 5 improved incl. tiny_dance +354).
- **The big-spec slowdown was real and is largely fixed.** At first compileLDS
  was 10–20× slower than greedy for zero gain on dead-end specs, from (a) an
  oversized affine budget and (b) the budget being checked only at yielded
  leaves so dead-end exploration overshot 2–3×. Fixed (a) with a flat 200k
  budget (floors are all 33–134k; parity holds at any budget) and (b) with a
  finer-grained cutoff inside `enumerateLeaves`. drums_signature 150→88s,
  solo_run 404→68s, parity held, CI green.

## Every point of 07_remaining_work.md

1. **Backtracking + recovery — DONE.** floor=legacy gives coverage by
   construction. Explicit recovery leaves deliberately NOT added (the floor
   subsumes their coverage role; would be unneeded complexity).
2. **Polish + phase-2 decision — DONE.** Phase-1 polish (clone-and-test) is in
   and safe; it fires on air specs, no-ops cleanly on mixed specs. Phase-2
   helpers are NOT needed for parity (met without them) — optional upside,
   not ported (avoid over-porting).
3. **Understand the equation + calibrate — DONE.** `08_budget_curves.md`:
   quality rises then saturates (spec-dependent knee), wall ≈ 0.27 ms/physframe,
   floor=greedy is the minimum. budgetFor calibrated flat from floor-cost data.
4. **Wire LDS + parity gate — DONE.** `golden.ts --lds` with budgetFor, untimed
   scoring. Parity gate met and exceeded (+9% seed 0; ≥ greedy_v1 by construction
   for all seeds; a 3-seed run confirms the definitive number — see below).
5. **Acceptance + cutover — DONE (acceptance) / partly deferred (cutover).**
   P1 (monotonicity, construction+CI+study 0/449), P2 (cv 0.110), P3 (physics
   frame = lr-core primitive, audited), P4 (determinism, CI) all hold (`09`).
   Deferred with reasons: default-swap of `golden` to lds (lds still slower than
   legacy — would regress the standard benchmark) and `time_multiplier` removal
   (legacy/timed path still default; removing breaks v0_score.test for no gain).
   Legacy `compile()` is NOT deleted — it is the floor dependency.
6. **Big/slow-spec speed — substantially DONE (safe parts), rest documented.**
   The safe, validated speedups (flat budget + finer cutoff) cut drums/solo
   2–6×. The residual gap (drums 88s vs greedy 24s) is the inherent cost of LDS
   exploring for the bonus on a spec where it can't beat the floor. Eliminating
   it requires LDS *completion* on dense specs (a backtracking leaf builder so
   deviations don't dead-end), which would also let LDS exceed greedy there —
   deferred as the remaining upside, must not regress any spec.

## Definitive parity number — CONFIRMED

Full 3-seed `golden --lds` run (seeds 0,1,2 — golden's set):

| | LDS | greedy_v1 |
|---|---|---|
| goal_score | **507.66** | 460.44 (frozen, 5-seed) / 478.82 (same 3 seeds) |
| contract-pass | **39/39** | 39/39 |
| specs below greedy_v1 (same 3 seeds) | **NONE** | — |

**+10.3% vs the frozen baseline, +6.0% on matched seeds, 100% pass.** Per spec
(matched seeds): 8 exact-match the greedy floor (LDS dead-ends or can't beat it),
5 improve — tiny_dance +245, mini_burst +124, rhythm_ladder +29, cold_start +17,
syncopated +9. No spec regresses, exactly as the floor=legacy construction
guarantees. Definition of done met: goal_score within 5% of greedy_v1 (in fact
above it) AND contract-pass ≥ baseline on every spec.

## Honest open items (none block parity; all are upside or polish)

- **Default-swap + time_multiplier retirement** — do together once lds speed is
  acceptable as the standard benchmark.
- **LDS completion on dense specs** (backtracking leaf builder) — the principled
  fix that both removes the residual big-spec waste AND lets LDS exceed greedy on
  drums/solo. The single highest-value next step; needs careful validation
  (must not regress monotonicity or any spec).
- **Phase-2 polish** — optional quality upside on speed/grain specs.
- **Scratch probes** (`_probe_*`, `_diag_floor`, `_floor_cost`, `_sweep_curve`,
  `_parity_lds`, `_stageA_work`) are investigation-only, uncommitted or clearly
  marked; delete at cutover.
