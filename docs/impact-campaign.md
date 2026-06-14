# Impact-metric campaign — bring `redirArc` fully under control

**Mission.** An author writes `impact 0→1` on any beat and gets a *meaningful, physically-achievable,
discriminating, reliable* amount of real impact across the whole range — working cleanly with the
compiler, without sacrificing the other axes. The metric (`redirArc = v·Δθ`, commit `79627f5`) is a
better match to felt impact; this campaign makes the whole system honest and solid around it.

**Three work-streams (do all, properly, not patched):**
1. **Lock the calibration** — felt-anchored `[0,1]` map (anchor A: `SOFT≈2.8 / VSTRONG≈6.5`) + the
   convention rescale, then **bake it into the specs** (re-author/rescale on disk; no permanent
   runtime remap).
2. **Adapt the impact-geometry to the new metric** — re-sweep the *carrier* (curvature: flatten /
   frontload / activation ramp) and re-derive the lever thresholds/caps (all tuned for the old metric).
3. **Make the response reliable** — achieved impact rises *monotonically* with the authored value (no
   mid-band undershoot / non-monotonic median); the other axes stay whole (recover the collateral).

**Method — empirical, methodical, NO trafficking.** Judge every change on lots of specs × seeds (full
golden + perturbed corpus) by the corpus response curve **and** the 13-spec board. Sweep one knob at a
time, keep only confirmed wins, log dead-ends. The score is an instrument, not the goal — never
dead-zone or rescale targets to manufacture a number; a win counts only if achieved impact *genuinely*
improves on representative data **and** the other axes hold.

## Instruments

```bash
# 1) corpus response — achievable redirArc per AUTHORED level, 1000 variants / 48 cores
for k in $(seq 0 47); do LR_ENGINE=wasm LR_PLAN_LOOP=0 LR_IMPACT_RESCALE=1 LR_IMPACT_SOFT=2.8 LR_IMPACT_VSTRONG=6.5 \
  npx tsx scripts/v0/calibrate_corpus.ts --count=1000 --spec-mod=$k/48 --budget=150000 --perturb=5 --seed-vary \
  --out=generated/impact-study/shards/c-$k.json & done; wait
python3 generated/impact-study/merge_corpus.py 'generated/impact-study/shards/c-*.json'

# 2) board A/B — 13 specs × {150k,300k} × 9 seeds, candidate vs frozen baseline
CAND_ENV="LR_IMPACT_RESCALE=1 LR_IMPACT_SOFT=2.8 LR_IMPACT_VSTRONG=6.5 LR_IMPACT_FLATTEN=20" ./scripts/v0/eval_impact.sh
# or: bash generated/impact-study/board_validate.sh <tag> <EXTRA_ENV...>   (compares to anchorA baseline)
```
Knobs: `LR_IMPACT_{SOFT,VSTRONG,RESCALE,FLATTEN,FRONTLOAD,CURVE_START,CURVE_SPAN}`; `LR_IMPACT_GEOM_OFF=1`
= ablation floor. Helper scripts live in `generated/impact-study/` (analyze_shift, merge_corpus,
ablation_cmp, sweep_carrier, board_validate). Old-metric worktree: `/home/wyss/line-oldmetric` (`e1950f7`).

## Findings (live)

- **Anchor A validated** (board, planning off): honest scale — soft beats *match* (target≈achieved≈0),
  high beats reach `redirArc 5.9–6.5` and score ~0.81, mid shows the *true* undershoot. Drag 67→32, no
  breakage (234/234, 0 deaths). The 76% "dead-zone" is correct (existing specs are soft-heavy on the old
  convention). Convention rescale `a_new = normImpact(a_old·8.5)`: `0.2→0, 0.5→0.39, 0.85→1.0`.
- **The −35 non-impact collateral is the new measurement's cost-landscape, NOT the geometry levers**
  (ablation: `excl_impact` only +3.4 with levers off). Separate issue.
- **The geometry levers EARN their keep** (ablation: full −63 with them off). So adapt, don't delete.
  The **carrier** (curvature modulation) is the +53 lever; the angle-shift levers are marginal (±2,
  don't widen — regressed historically).
- **Carrier adaptation direction (corpus-confirmed):** under anchor A the carrier ramp `START=0.25` is
  too high for the rescaled target distribution (p50 0.14) — a mid-band beat gets only ~28% pressure.
  Lowering `CURVE_START→0.12` (+ `FLATTEN→20`) lifts the p50 response across the high bands and reduces
  the non-monotonic dip. `start` is the dominant lever; `frontload` barely moves it. **Pending board
  validation that the other axes hold.**
- **The residual top-end median gap is feasibility/composition** (high-authored beats on physically
  limited geometry; p90 reaches 6.5, median is setup-limited). The feasibility bound caps those targets,
  so it's correct behavior, not a compiler miss — the *board* (achieved vs bounded target) is the clean
  reliability instrument, the corpus-by-authored conflates it.

## Status
1 calibration: anchor A validated (defaults not yet locked). 2 geometry: carrier `start=0.12/flatten=20`
corpus-confirmed, board-validating. 3 thresholds: carrier `START` is the lever; angle-shifts stay.
4 reliability: pending. 5 lock+bake: pending.
