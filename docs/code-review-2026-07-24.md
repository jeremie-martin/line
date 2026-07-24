# Code review — 2026-07-24

**Scope:** all changes since `f537539` (inclusive) plus the dirty worktree (unstaged/uncommitted changes) on `codex/engine-improvement-research-handoff`. This covers the ballistic-predictor promotion (`8f73527`, `2d66844`), the exact-constraint predictor cutover, the benchmark comparison-workflow simplification (`02c7828`), and the uncommitted refactor in the tree.

**Method:** medium-effort multi-pass review; candidate findings were adversarially verified. 5 correctness/process findings confirmed, 3 cleanup findings self-verified, 4 candidates refuted. Subsequently cross-checked against `docs/BALLISTIC_READINESS_CONTRACT.md` as the normative spec — see the final section; the cross-check narrowed finding 2's fix and upgraded findings 4 and 7 to contract violations.

## Disposition

The review has served its implementation-audit purpose:

| Finding | Disposition |
|---|---|
| 1. Untracked production files | Addressed in the working tree and exercised by a frozen compiler snapshot; all new source/test files must be included in the eventual commit. |
| 2. Elevation probe plumbing | Fixed. Readiness enablement now controls short/full probe projection, with enabled-path coverage. |
| 3. Fingerprint weakening | Not a defect for this campaign. The lean comparison behavior was an explicit project decision; provenance remains reported. |
| 4. Runway anchor/exit mix-up | Fixed through `ballisticLaunchFirstSampleFrame`, with a regression test. |
| 5. Duplicate projection | Fixed through shared projection memoization; study-only pool telemetry is gated. |
| 6. Stale `achievedAtEnd` reads | Removed from production, tests, and study scripts; the obsolete study surface was deleted. |
| 7. Dead suffix subsystem | Removed, together with orphaned output/alias exports. |
| 8. Per-candidate line copy | Removed by accepting readonly lines. |

The four refuted candidates remain refuted. This document is retained as the
historical review record; the clean current design lives in
`docs/BALLISTIC_READINESS_CONTRACT.md`.

---

## Confirmed findings

### 1. Untracked production files break the build if committed as-is

`scripts/v0/optimizer/readiness.ts:28` — **build-break / process**

Production code imports four brand-new files that are still untracked and absent from
the diff:

- `scripts/v0/optimizer/catchability.ts`
- `scripts/v0/core/ballistic_projection.ts`
- `scripts/v0/core/ballistic_launch.ts`
- `tests/ballistic_projection.test.ts`

`readiness.ts:28` (`from "./catchability.ts"`) and `handoff.ts:126` import symbols the
refactor moved out of `readiness.ts` into `catchability.ts`, but `git status` shows all
four files as `??`. Committing the tracked changes without `git add`-ing them means any
fresh checkout fails module resolution (`Cannot find module ./catchability.ts`), taking
down the whole optimizer path (readiness → handoff → aim → compile) and the test suite.

**Fix:** `git add` the four files before committing.

### 2. Elevation readiness fails closed but the aim-proposer path never emits elevation

`scripts/v0/optimizer/readiness.ts:196` — **correctness**

`elevationFitFactor` now fails closed (`return null`) on a missing `arrival.elevation`,
but the aim-proposer path never produces that field: the short probe omits
`includeElevation` (`arc_probe.ts:220`), so `next.elevation` is never among the
arc-vector model outputs.

Failure path: elevation-authored V2 spec + mature budget → `handoff.ts:2443` turns on
elevation readiness (`LR_M114_SPARSE_ELEVATION_READINESS` default-on, pressure ≥ 0.20)
→ `arrival.elevation` undefined → `readiness.ts:196` returns null → objective null →
`aim.ts:824` marks the variant `model_unscoreable` → **zero aimed candidates for every
elevation-target gap**.

The old code treated missing elevation as neutral (factor 1). Fail-closed is intentional
for speed/air (those stats *are* emitted), but elevation's plumbing is simply missing,
and the enabled path has no test coverage.

**Fix (contract-narrowed):** plumb the readiness policy's elevation enablement into the
short-probe projection request (`includeElevation`) so the arc-vector model emits
`next.elevation` whenever the component is enabled, and add coverage for the enabled
path plus the explicit, tested fallback ordering contract §15 requires for an
unavailable projection. Do **not** restore neutral handling: the contract (§15)
mandates that a *targeted* component with missing projection data fails closed —
neutral-at-1 is reserved for unauthored or disabled components. The fail-closed
behavior is correct; the bug is solely that the enablement policy switches on a
component whose input the probe path can never supply, which also violates §15's
"probe rows and real candidates use the same … projection, composition, readiness
functions."

### 3. suiteFingerprint no longer auto-invalidates on scoring edits

`scripts/v0/benchmark_v2/suite_model.ts:244` — **process / baseline-integrity**

`suiteFingerprint` now folds in the hand-maintained literal
`BENCHMARK_SCORING_PROTOCOL_FINGERPRINT` instead of byte-hashing the scoring/definition
sources. `benchmarkImplementationFingerprint` still hashes the files but is recorded
only — never compared in `decide.ts`, `baseline_cache.ts`, or `calibration_guard.ts`.
The `decide.ts:332` gate checks only `suiteFingerprint`, which is now invariant under
scoring edits.

Consequence: edit scoring semantics (benchmark/v2 `case.ts` / `catalog.ts` /
`score.ts`) without bumping the constant and the candidate is silently compared against
a baseline scored under different semantics. Previously any scoring edit
auto-invalidated the baseline and forced a re-freeze plus human listening review.

Additionally, the only test on it — `tests/benchmark_v2_numeric_fixtures.test.ts:120` —
compares the literal to a copy of itself (a tautology).

**Fix:** this weakening should be a deliberate decision, not an accident. Either restore
byte-hashing into `suiteFingerprint`, or make the decide/cache/guard gates also compare
`benchmarkImplementationFingerprint`, and replace the tautological test with one that
hashes the real sources.

### 4. leavesDetectorRunway measures runway from the anchor frame, not the exit

`scripts/v0/optimizer/contact_phase.ts:158` — **correctness**

`leavesDetectorRunway` now measures runway from `launch.anchorFrame`, which sits up to
`LAUNCH_READ_FRAMES − 1 = 3` frames *after* the geometric exit
(`anchorFrame = exit + (sampleCount − 1)`, see `ballistic_launch.ts:41-62`). The old
code used `release.frame` = exit. The same refactor reconstructs the true exit as
`anchorFrame − sampleCount + 1` at `candidate.ts:1054`, proving the two frames differ,
but `leavesDetectorRunway` omits that correction while keeping
`MIN_LANDING_AIRBORNE_FRAMES − 1` unchanged.

Because it is a suppression gate (`contact_phase.ts:123` — `incumbents.some(...) →
return []`), an incumbent with a multi-sample launch read now measures up to 3 frames
short → the gate returns false → extra detector-runway candidates are generated exactly
on the short-next-gap band.

**Fix:** use `launch.anchorFrame - launch.sampleCount + 1` as the runway base.

**Contract note:** this is precisely the frame-substitution class the contract's §15
checklist forbids ("`anchorFrame` is the actual last engine sample used, not a nominal
geometric-exit frame"; exit/anchor/pre-contact frames "separately named and never
substituted for one another"), and §2 states the anchor is "the geometric exit plus
zero to three readable airborne frames" — the exact discrepancy here.

### 5. recordPoolAirSpread doubles the ballistic projection per pool candidate

`scripts/v0/optimizer/aim.ts:1545` — **efficiency**

`recordPoolAirSpread` runs a full per-frame ballistic projection per pool candidate —
ungated, on the default production path — purely for telemetry. The old code was O(1)
arithmetic (`predictedNextGapAir`). The new code calls
`predictArrivalAtNextContact(cand, nextGap)?.airFraction`, which walks `dt` frames via
`projectBallisticGap` → `advanceConstraintBallisticTrajectory` with no cache
(`objectiveCache` at `aim.ts:1419` stores only the scalar objective). It runs per
candidate per pool build on every gap expansion (`POOL_MODE` hardcoded true, no
`LR_AIM_STUDY_STATS` gate), so every pool candidate is fully projected twice.

**Fix:** cache the arrival/airFraction from `candidateQualityObjective` and let the
telemetry read it, or gate the loop behind a study flag.

---

## Cleanup findings (self-verified)

### 6. ~76 stale `achievedAtEnd` reads across study scripts

`scripts/v0/core/substrate.ts:39` — **cleanup**

Deleting `GapFit.achievedAtEnd` (and its `LandingProbeCostSink` counterpart) left ~76
`fit.achievedAtEnd ?? fit.achieved` references across `scripts/v0/study_*.ts`
(`study_transition_envelope.ts`, `study_v2_arrival_prediction.ts`,
`study_impact_*.ts`, …). Under tsx these resolve to `undefined` and always take the
fallback. Semantically benign today (`achieved` now equals the old scorer-window
measure), but the dead accesses mislead readers into thinking two measures still exist
and will break silently if the semantics diverge again.

**Fix:** sweep the study sites to read `.achieved` directly.

### 7. Ballistic-suffix axis-completion subsystem is dead code

`scripts/v0/core/measure.ts:344` — **dead-code / contract violation**

`measureGapAxesWithBallisticSuffix`, `completeBallisticSpanAxesFromSummary`,
`BallisticAxisSuffix`, and helpers have zero remaining callers: `candidate.ts` and
`arc_probe.ts` no longer import them (current quality measures the exact
`[start, endFrame]` interval), and grep finds no caller outside `measure.ts` itself.
Same applies to the now caller-less exported `exitStateOutputs` in `arc_model.ts:924`
and the four unused `OBJECTIVE_*` alias re-exports in `objective.ts`.

**Fix:** delete the suffix-completion block and the orphaned exports.

**Contract note:** deletion is mandated, not optional hygiene. The suffix-completion
block is a second gap composer, prohibited by §12 ("one canonical gap composer imported
by production and benchmark") and §15 ("compatibility exports do not contain a second
implementation"). Its `BallisticAxisSuffix` type also collides in vocabulary with the
contract's canonical `BallisticSuffix` kernel output (§5.2), which the terminology
discipline of §3/§15 exists to prevent.

### 8. measureAchieved copies the lines array on every candidate fit

`scripts/v0/core/candidate.ts:877` — **efficiency**

`measureAchieved` spreads the lines array (`measureGapAxes(det, gap, [...lines],
gap.endFrame)`) on every candidate fit solely to satisfy a non-readonly parameter type.
It runs once per candidate evaluation (millions of calls per compile) while
`measureGapAxes` only reads the array (`arc_probe.ts` already passes `lines` without a
copy).

**Fix:** widen `measureGapAxes`'s `gapLines` parameter to `readonly TrackLine[]` and
pass `lines` directly.

---

## Refuted candidates

Four candidate findings did not survive adversarial verification and are listed here so
they aren't re-raised:

- an `objective.ts` guard suspected of misfiring;
- speed/air fail-closed readiness handling (intentional — those arrival stats *are*
  emitted on the probe path, unlike elevation);
- a suspected air-knob inversion;
- catchability gating behavior.

---

## Contract cross-check (`docs/BALLISTIC_READINESS_CONTRACT.md`)

The findings were cross-checked against the ballistic readiness contract, treated as
the normative spec for this codebase. Overall the review is an enforcement pass of the
contract; no finding contradicts it, and two are upgraded by it.

| Finding | Contract clause | Relationship |
|---|---|---|
| 1. Untracked files | §13 "Implemented" claims | Prerequisite — the contract's implemented status lives in those files |
| 2. Elevation fail-closed starvation | §15 fail-closed rule + §6 conditional elevation | Diagnosis confirmed; fix narrowed (neutral fallback is contract-forbidden) |
| 3. Fingerprint constant | §12 "fail loudly on incompatible corpus metadata" | Supported in spirit; direct authority is the benchmark-v2 freeze convention, needs a deliberate call |
| 4. Runway anchor-vs-exit | §2/§3/§15 frame-substitution ban | Strongly reinforced — exactly the violation class §15 targets |
| 5. Double projection telemetry | §15 "at most once per projection" + telemetry rules | Reinforced |
| 6. Stale `achievedAtEnd` reads | §15 "one production owner, no second implementation" | Aligned cleanup |
| 7. Dead suffix subsystem | §12 "one canonical gap composer" | Elevated: deletion is contract-mandated |
| 8. Array copy | §15 efficiency/budget honesty | Neutral-compatible |

Additional outcomes of the cross-check:

- **Contract status inaccuracy found via finding 2.** At review time §8 claimed as *Implemented* that
  `predictArrivalAtNextContact` supplies optional elevation from the canonical
  composer. That is true at the composer boundary but false end-to-end: the
  aim-proposer probe path never requests elevation, so the enabled component can never
  score. The implementation was subsequently fixed and the current contract
  records the completed shared-policy plumbing.
- **The review's refutations are contract-consistent:** declining to flag speed/air
  fail-closed handling as a bug matches §15's mandate that targeted components with
  missing projection data fail closed.
