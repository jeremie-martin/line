# Optimizer improvement backlog (capability roadmap)

This is the **Track B** working backlog for the agent improving the LDS optimizer — the
capability changes that move `goal_score`.

**Track A (hygiene) is DONE:** the optimizer is now self-contained — its substrate lives in
`scripts/v0/core/{substrate,candidate,preroll,polish}.ts` and `scripts/v0/optimizer/*`
imports **nothing** from the legacy `compile.ts`. So the file homes below point at `core/`
where the candidate/polish/preroll code moved; the search algorithm (`lds.ts`, `api.ts`,
`register.ts`, `sample.ts`, `node.ts`) is unchanged and lives in `optimizer/`.

The findings below come from a deep review and have been **verified against the current
code** (file:line cited where checked). Each is one mechanism; follow the charter loop —
propose → `--fast` or targeted probe (`--specs=… --budget=… --seed=…`, add `--jobs=N` to
parallelize multi-spec probes) → keep-or-revert by judgment → canonical + property tests
before commit. None of these are byte-identical-preserving (they change output on purpose);
the guardrail is **property tests green + `goal_score` non-regressing**, not a hash diff.

## Ownership split (why these are the agent's, not done up front)

A change is done up front (by the human/refactor pass) only if it's verifiable **without**
the slow golden loop. Everything whose value is measured by `goal_score` is the agent's,
because that *is* the propose→measure→keep loop — doing it blind would violate the
discipline. So: **#5 (leaf-key) and #7 (diagnostics) are done; the rest are the agent's
capability track** — their value is measured by `goal_score`, so they belong in the loop.

## Sequence (one mechanism at a time)

### #1 — Repair discrepancy should be base-relative (DO FIRST; verified bug)
`perGapRanksFromCommit` (`lds.ts:342`) records the **absolute** committed sorted-index per
gap, not the **base-relative** local rank the LDS model defines (base choice = local rank
0). So a repair leaf's discrepancy is `sum of absolute indices`, and the gate
`if (discrepancy > maxDiscrepancy) break` (`lds.ts:456`) suppresses repair on exactly the
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

### #2 — Make skipped contacts repairable (`forbidSkip`) — TRIED, REVERTED (inert)
A missed contact owned by a *skipped* gap can't be repaired today: `lds.ts`
(`if (committed === SKIP) continue`) has no candidate to forbid, and the descent re-skips.
Implemented as designed (`forbidSkip` set threaded into `buildBacktrackingLeaf`; a `forbidSkip`
gap backtracks past `MAX_BT`, bounded by `STEP_CAP`/budget, and fails to null if it can't land).
**Reverted** — provably inert on the current suite (2026-05-29):
- `dense_sprint`, the motivating "base-path skip the repair can't recover" case, **already
  passes 3/3** (its seed-0 repair already lands all 41 contacts; the backlog premise is stale).
- The remaining failures (`drums_pendulum` s0, `drums_crescendo` all) are **drift/off-beat**
  misses, NOT skip-owned: diagnostic shows `owners=[12,13,17] committed=[0,0,1]` — the owner
  gaps committed candidates that landed off-beat, so there is no SKIP to forbid.
- Those rows are also **budget-starved**: the budget-exempt base floor consumes ~the entire
  per-spec budget (`drums_pendulum` floor ≈ 200k = its budget; `drums_crescendo` floor ≈ 457k >
  200k budget), so `getSimFrames()` is already ≥ budget when the repair loop starts — repair and
  the deviation sweep never run (`leaves_considered=1`, `repair_rounds=0`). No skip-recovery
  mechanism can help until the floor leaves budget headroom.

So the real levers for the drums failures are **candidate quality (#4)** — land the missed
contacts *on-beat at the floor* — and/or a **cheaper floor** (why does it backtrack so much?
§8 / #3). Re-open #2 only if a skip-owned miss reappears once repair has budget headroom.

### #4 — Deterministic candidate "lanes" (highest-leverage capability lever)
The atomic sampler uses `gap.targets` directly and never puts a recoverable candidate in the
pool for the hard cross-gap failures. Replace a few of the 32 attempts with deterministic,
**attempt-index-selected** lanes keyed on local physical state (dense-catch: short gap / high
incoming speed; braking: high speed before dense contacts; glued: low air / high
contact_style; loft: high air; grain: line-scale) — must keep `solveOneGap(K')` prefix-
compatible (lane chosen by `attempt`, not by reordering). Start with ~6–8 reserved attempts of
32, rest unchanged. This is the highest-leverage lever for `dense_sprint`/`drums_pendulum`.
`sampleArcParams` now lives in **`core/candidate.ts`** (add a `sampleArcParamsForLane` there);
the per-attempt lane selection goes in `sampleOneCandidate` (`optimizer/sample.ts`), which
already threads `attempt`. (Residual/look-ahead targeting stays out — it's compile-only legacy
in `compile.ts`, deliberately not used by the optimizer.)

### #6 — Gate polish on the already-computed report
`evaluateLeaf` (`api.ts`) already computes the report once; add a `shouldTryPolish(report,
leaf.fits, spec, gaps)` check in `api.ts`'s `consider` loop and only call `polishLeafVariant`
when the report shows actionable air/contact error in sections with committed fits. Polish
stays deterministic/additive; this just avoids spending sim-frames on known no-ops. Start
conservative (skip only when no relevant axes / no relevant committed fits). The win is speed;
verify `goal_score` holds and polish-adopted count drops only on no-ops. Note: the polish
*helpers* now live in `core/polish.ts`; `polishLeafVariant` (in `optimizer/polish.ts`) takes
`(fits, spec, gaps, contactFrames, durationFrames, startState)` — keep that signature.

### #7 — Optimizer-native diagnostics (DONE)
`CompileStats` (`types.ts`) now carries optimizer-native fields, populated by `compileLDS`
(via a `SearchTelemetry` object threaded through `enumerateLeaves`) and visible in
`golden --json` `compile_stats`: `leaves_considered`, `improvements`,
`polish_variants_tried`/`_adopted`, `repair_rounds`, `candidate_cache_hits`/`_misses`,
`base_backtracks`. Non-scoring; use them to read what the search is doing on hard specs
(low cache hit-rate ⇒ re-sampling many prefixes; high `base_backtracks` ⇒ a thrashing floor;
`repair_rounds` ⇒ repair activity). Committed.

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
