# Optimizer improvement backlog (capability roadmap)

This is the **Track B** working backlog for the agent improving the LDS optimizer — the
capability changes that move `goal_score`, as distinct from the **Track A** hygiene work
(decoupling the optimizer from the legacy `compile.ts`, see the self-containment plan).

The findings below come from a deep review and have been **verified against the current
code** (file:line cited where checked). Each is one mechanism; follow the charter loop —
propose → `--fast`/targeted probe → keep-or-revert by judgment → canonical + property
tests before commit. None of these are byte-identical-preserving (they change output on
purpose); the guardrail is **property tests green + `goal_score` non-regressing**, not a
hash diff.

## Ownership split (why these are the agent's, not done up front)

A change is done up front (by the human/refactor pass) only if it's verifiable **without**
the slow golden loop. Everything whose value is measured by `goal_score` is the agent's,
because that *is* the propose→measure→keep loop — doing it blind would violate the
discipline. So: **#5 is done; the rest are the agent's capability track.** #7 (diagnostics)
lands as Track-A phase A5.

## Sequence (one mechanism at a time)

### #1 — Repair discrepancy should be base-relative (DO FIRST; verified bug)
`perGapRanksFromCommit` (`lds.ts:342`) records the **absolute** committed sorted-index per
gap, not the **base-relative** local rank the LDS model defines (base choice = local rank
0). So a repair leaf's discrepancy is `sum of absolute indices`, and the gate
`if (discrepancy > maxDiscrepancy) break` (`lds.ts:~437`) suppresses repair on exactly the
backtrack-heavy hard specs whose base path commits high indices — repair is effectively
disabled where it's needed most. Fix: compute repair ranks in the same rotated local-option
order `enumerateDeviations` uses (base choice → 0; off-base → cheapest), via a
`localRankRelativeToBase(baseChoice, choice, candidateCount)` helper, and replace
`perGapRanksFromCommit(repair.baseCommitPath, …)` with a base-aware version that also takes
`base.baseCommitPath`. Add a unit test: `base=[3,SKIP]`, repair commit `[3,0]` → local ranks
`[0,1]`, not `[3,0]`. **Re-run the prefix-superset + monotonicity property tests** (this
changes which leaves are admitted) and the `dense_sprint`/`drums_*` probes; watch
`sim_frames` (more repair work enters the budget).

### #5 — Centralize the leaf-key (DONE)
`leafKeyForReport(report, totalFrames)` is now the single source of truth in `register.ts`;
`api.ts` and the anytime test both use it (the test previously reconstructed the key without
`totalFrames`/`drift_quality`). Committed.

### #2 — Make skipped contacts repairable (`forbidSkip`)
A missed contact owned by a *skipped* gap can't be repaired today: `lds.ts:441`
(`if (committed === SKIP) continue`) has no candidate to forbid, and the descent re-skips.
This is the `dense_sprint` failure mode (base-path skip the repair can't recover). Extend the
repair constraint from "forbid candidate indices" to `{ forbiddenCandidates: Set<number>,
forbidSkip: boolean }`; when `failureOwnerGaps` finds a missed contact whose owner gap was
skipped, set `forbidSkip` for it; in `buildBacktrackingLeaf`, a `forbidSkip` gap that exhausts
candidates backtracks instead of committing null (and the repair leaf fails to null if it
can't — fine, the base leaf is still registered). Keep repair budget-subject. Probe
`dense_sprint` at 40k and 200k; success signal = fewer missing contacts, no off-beat
explosion, bounded `sim_frames`.

### #4 — Deterministic candidate "lanes" (fuses with Track-A A2: owning the candidate core)
The atomic sampler uses `gap.targets` directly and never puts a recoverable candidate in the
pool for the hard cross-gap failures. Replace a few of the 32 attempts with deterministic,
**attempt-index-selected** lanes keyed on local physical state (dense-catch: short gap / high
incoming speed; braking: high speed before dense contacts; glued: low air / high
contact_style; loft: high air; grain: line-scale) — must keep `solveOneGap(K')` prefix-
compatible (lane chosen by `attempt`, not by reordering). Start with ~6–8 reserved attempts of
32, rest unchanged. This is the highest-leverage lever for `dense_sprint`/`drums_pendulum`;
do it *in* `core/candidate.ts` once Track-A A2 owns the candidate core.

### #6 — Gate polish on the already-computed report
`evaluateLeaf` already computes the report once; pass it to `polishLeafVariant` and run polish
only when the report shows actionable air/contact error in sections with committed fits.
Polish stays deterministic/additive; this just avoids spending sim-frames on known no-ops.
Start conservative (skip only when no relevant axes / no relevant committed fits). The win is
speed; verify `goal_score` holds and polish-adopted count drops only on no-ops.

### #7 — Optimizer-native diagnostics (lands as Track-A A5)
`CompileStats` is legacy-shaped; the optimizer zeros most counters. Add: leaves considered
(`register.consideredCount`), polish variants tried/adopted, repair rounds yielded/dead-ended,
skipped gap indices, backtrack count, candidate-cache hit/miss, first failure-owner per repair
round. Non-scoring; makes the golden breakdown actionable (the charter says the gradient lives
in the breakdown, not the headline).

### #3 — Split the floor (cheap completion + budgeted recovery) — DEFER
Today the d=0 base both guarantees completion and does bounded cross-gap search (budget-exempt,
~460k frames on `drums_crescendo`). A cleaner design: leaf 0 = one-pass rank-0-or-skip march
(cheap, always completes); backtracking/repair/deviations = budgeted leaves. Preserves the
fixed-prefix contract but stops hiding large search in an unbudgeted phase. **Defer** until
#1/#2/#4 land — it trades budget-honesty for a worse low-budget floor and parity currently
leans on the strong floor. The reviewer flagged this caution too.

## What NOT to do first
Don't raise `BASE_BACKTRACK_DEPTH` / `REPAIR_ROUNDS_CAP` / `N_CAND` / the default budget — the
charter already calls these padded constants, and the hard failures are *capability* failures,
not budget failures. More search over the same poor candidate set burns sim-frames without
fixing skipped/off-beat cases. And don't jump to beam search before #1/#2 — the architecture
is sound; the immediate problem is the leaves being fed to it.
