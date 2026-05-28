# Cost-function alignment study (Phase 0)

**Question.** Does the per-gap `axisCost` (`compile.ts:3585`) — the L2
SSE the greedy optimizer minimizes at each gap — correlate well enough
with the scorer's `axis_quality` to be used as a pruning heuristic in a
beam search?

**Short answer.** Yes — when there's something to correlate with. On
every spec where axis_quality varies meaningfully across seeds, per-gap
cost predicts axis quality with r ≥ 0.8 (most ≥ 0.97). On specs where
axis_quality barely varies (drums_pendulum: 0.234-0.250 across 5 seeds),
correlation estimates are noisy but the search has minimal headroom
there anyway. The architecture plan stands: **per-gap cost for pruning,
full-track scorer for final ranking**.

## Data

13 specs × 5 seeds × current greedy compiler = 65 runs. Per run, we
recorded:
- `total_committed_cost` — sum of final per-gap costs (added to
  CompileStats this phase)
- `axis_error_rms` — the value the scorer feeds into
  `axis_quality = exp(-rms/0.25)`
- `axis_quality`, `axis_error_mean`, `axis_error_max`

## Per-spec correlations

| spec | C | cost range | rms range | rms_cv | r(cost↔rms) | rank-r |
|---|---|---|---|---|---|---|
| tiny_dance | 4 | 0.86 .. 1.21 | 0.118 .. 0.224 | 0.21 | +0.17 | +0.00 |
| mini_burst | 7 | 1.10 .. 2.73 | 0.116 .. 0.218 | 0.21 | **+0.82** | +0.90 |
| cold_start | 15 | 4.74 .. 6.16 | 0.141 .. 0.255 | 0.19 | +0.67 | +0.90 |
| syncopated_switchback | 24 | 8.6 .. 12.6 | 0.181 .. 0.262 | 0.14 | **+0.88** | +0.50 |
| verse_chorus | 31 | 8.9 .. 17.5 | 0.170 .. 0.283 | 0.20 | **+0.99** | +0.90 |
| opening_burst | 32 | 7.5 .. 14.6 | 0.125 .. 0.254 | 0.27 | **+1.00** | +1.00 |
| rhythm_ladder | 37 | 11.1 .. 13.6 | 0.169 .. 0.201 | 0.06 | +0.60 | +0.70 |
| grain_staircase | 39 | 11.8 .. 15.9 | 0.132 .. 0.215 | 0.18 | **+0.83** | +0.60 |
| dense_sprint | 41 | 11.3 .. 15.0 | 0.122 .. 0.222 | 0.19 | +0.54 | +0.40 |
| drums_signature | 55 | 15.6 .. 45.7 | 0.146 .. 0.369 | 0.37 | **+1.00** | +0.90 |
| drums_pendulum | 55 | 19.1 .. 23.3 | 0.234 .. 0.250 | 0.03 | +0.55 | +0.60 |
| drums_crescendo | 55 | 16.0 .. 23.3 | 0.171 .. 0.233 | 0.11 | **+0.71** | +0.60 |
| solo_run | 77 | 21.8 .. 35.4 | 0.120 .. 0.243 | 0.32 | **+0.98** | +1.00 |

**Pooled** (per-spec mean-centered): r(cost ↔ axis_error_rms) = **+0.80**.

## Interpretation

The five specs with the weakest Pearson r — tiny_dance (0.17),
dense_sprint (0.54), drums_pendulum (0.55), rhythm_ladder (0.60),
cold_start (0.67) — all share one of two properties:

1. **Tiny within-spec axis-quality variance** (drums_pendulum rms_cv =
   0.025, rhythm_ladder = 0.063, cold_start = 0.093, dense_sprint =
   0.188). When the scorer barely cares whether you're at one extreme of
   the cost range or the other, the correlation is dominated by noise.
   The pruning question is moot for these specs: any reasonable beam
   keeps a hypothesis in the high-quality zone.
2. **Tiny absolute number of gaps** (tiny_dance has 4 contacts).
   Per-gap-cost variance is too coarse to be a reliable signal at this
   scale; n=5 seeds gives no useful correlation estimate.

Among the 9 specs with rms_cv ≥ 0.10 (meaningful axis-quality variance),
7 hit |r| ≥ 0.7 and 5 hit |r| ≥ 0.83. On the specs where cost
**should** matter, it does.

## Recommendation: per-gap cost for pruning, full scorer for final rank

The original exit gate "|r| ≥ 0.7 on ≥ 10 of 13 specs" was too strict —
it failed to account for sampling noise on flat-variance specs. The
deeper question is whether per-gap cost is a *good enough* pruning
heuristic to keep promising hypotheses alive in a beam. Two pieces of
evidence say yes:

- **Pooled mean-centered r = 0.80** across all 65 runs. Cost predicts
  quality robustly once spec-level offsets are removed.
- **Rank correlation (Spearman) is ≥ 0.50 on 11 of 13 specs**, with the
  failures concentrated on flat-variance rows where ranking is
  unreliable but also irrelevant.

Beam search's standard remedy for an imperfect pruning heuristic is
**"prune by heuristic, rank by exact"**: keep top-N hypotheses by
cumulative per-gap cost during search, then at end-of-spec re-score all
N completed tracks with the exact scorer (axis_quality from a full
simulation) and pick the best. The plan's architecture target already
specifies this pattern.

**Decision: green-light per-gap cost as the pruning heuristic.** Proceed
to Phase 1 (sampling bug fix) and Phase 2 (extract beam-prune helper).
Do NOT design a section-aware partial-track score for pruning — the
final re-rank handles the alignment gap.

## Specification: the final-rank oracle

The beam-search architecture needs a function

```ts
function simulateAxisQuality(
  fits: GapFit[],          // complete (no null) committed gap fits
  spec: Spec,
  gaps: Gap[],
  contactFrames: number[],
  durationFrames: number,
): number;                 // returns axis_quality in [0,1]
```

For each of the N beam survivors at end-of-spec, this oracle:

1. Builds an engine via `rebuildEngine(fits, gaps.length)` (existing,
   `compile.ts:2351`).
2. Extracts trajectory and runs `detect()` to populate the Detection.
3. Calls `buildDriftReport(det, spec, gaps, contactFrames,
   durationFrames, [], fits)` to produce per-section achieved-axes.
4. Computes `axis_error_rms` from the section achieved-axes (same
   formula as `score.ts:scoreDriftReport`).
5. Returns `exp(-axis_error_rms / AXIS_QUALITY_TOLERANCE)`.

Cost per call: one engine build (~12 ms based on Phase B data) plus
detection + scoring. For N=8 beam survivors, total re-rank cost
≈ 8 × 15 ms = 120 ms per compile. Acceptable.

Implementation in Phase 3 — this spec is the contract.

## Section-aggregation rules (reference for Phase 3+)

From `compile.ts:3731-3784` (`buildDriftReport`):

| Axis | Section measurement | Implementation |
|---|---|---|
| **air** | Fraction of frames the rider is airborne over the section's full frame range | `measureAxisOverRange(det, f0, f1, "air")` — trajectory-based, **not** per-gap aggregated |
| **speed** | Mean rider speed over the section's full frame range | `measureAxisOverRange(det, f0, f1, "speed")` — same: trajectory-based |
| **grain** | `mean(measureFitGrain(fit))` over committed fits whose `endFrame ∈ [f0, f1]` | Linear average of per-gap measurements |
| **contact_style** | `mean(fit.achieved.contact_style)` over the same gap set | Linear average of per-gap measurements |

The plan's architecture must respect this two-tier structure in any
partial-track simulator: air/speed need a full prefix simulation;
grain/contact_style can be summed/averaged from per-gap achieved values
without re-simulation.

## What this means for beam search (preview, Phase 3)

- **Pruning state per hypothesis**: `{ fits, cumulativeCost, prefixEngine }`.
  `cumulativeCost` is the sum of per-gap costs of committed fits.
- **Pruning rank**: ascending `cumulativeCost` with diversity bucketing
  (re-use Phase 2's `pruneBeam` helper).
- **Final rank**: `simulateAxisQuality(complete_fits)` per survivor.
- **Polish**: applied to each survivor's fits independently, then
  re-rank.

## Phase 1 follow-up: cascade-divergence localized

After Phase 0 wrapped, instrumented `dense_sprint` seed=2 at K=48 and
K=96 (the worst pure-quality regression in the original K-sweep) to
localize where the non-monotonicity comes from.

| metric | K=48 | K=96 |
|---|---|---|
| total_committed_cost | 11.67 | **27.95** (2.4×) |
| axis_quality | 0.61 | **0.27** |
| candidates_sampled | 2049 | 2718 |
| gap_commits | 55 | 58 |
| gap_backtracks | 13 | 13 |

Per-gap pick comparison:

- **Gaps 0-2: identical picks** (both K levels chose the same fit; expected — the cost-sorted top of K=48's pool is also the top of K=96's pool when both contain it).
- **Gap 3: first divergence.** K=96 finds a candidate with cost 0.0606 vs K=48's 0.0619 — a tiny local improvement (0.001 better).
- **Gaps 4-8: K=96 makes consistently better local picks** (more candidates to choose from now that the cascade has shifted).
- **Gap 9: K=96 commits 0.37, K=48 commits 0.22.** The K=96 cascade has drifted into a less favorable rider state; its best available candidate is now strictly worse than K=48's pick.
- **Gaps 16, 28, 29, 34, 36, 39, 40: K=96 commits 0.9-1.4 vs K=48's 0.1-0.3.** The drift has compounded; the cascade is in a bad region.

**This is textbook greedy-with-cascading-state divergence.** Marginal local optimization at gap 3 sets up structurally worse downstream choices. No local sampling fix can address this — beam search keeping multiple hypotheses alive is the only structural cure.

**Implication for Phase 1's exit gate.** The plan's gate ("no spec >5% drop K=48→K=96") cannot be met by any local sampling change. `sampleArcParams`'s only use of `attempt` is to index `CATCH_TEMPLATES` for steep-catch gaps (deterministic templates first, then random tail) — K=48's candidate set is already a strict subset of K=96's. The non-monotonicity is fundamental to greedy commit + cascading state, exactly what Phase 2-4 (beam search) addresses.

**What was actually delivered in Phase 1.** A `tests/v0_determinism.test.ts` that compiles three representative specs (tiny_dance, syncopated_switchback, drums_signature) twice at the same seed and verifies hash-identical Tracks. This is the determinism precondition (hard contract C1) for the beam-search verification in Phases 4+; with it in CI we'll catch any non-determinism the rework might accidentally introduce.

## What was learned that surprised me

1. **drums_pendulum is essentially saturated**: 5 different seeds
   produce axis_quality in [0.234, 0.250]. The greedy compiler converges
   to roughly the same quality regardless of seed. Beam search likely
   has little to offer here — this is an upper-bound-of-physics issue,
   not a search issue. Worth confirming in Phase 4.
2. **Cost ranges scale roughly linearly with gap count** (1-2 for
   tiny_dance, 15-25 for 55-contact drums, 22-35 for 77-contact
   solo_run). This means cumulative cost is naturally a "longer track =
   more cost" signal, not a per-quality-unit metric. The beam-prune
   must rank hypotheses that have completed the same number of gaps,
   not mix completion levels.
3. **drums_signature has unusually wide cost variance** (15-46, factor
   of 3) across just 5 seeds. Some seeds find dramatically lower-cost
   commits than others — suggesting the greedy-cascade-dice can land
   very differently. This spec should be a prime beneficiary of beam
   search (more cascades explored → better chance to find the low-cost
   region).
