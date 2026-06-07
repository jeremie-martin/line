# Compiler Optimization Log — Arc Placement Campaign

Objective: raise canonical HEADLINE by improving arc placement/generation.
Judge success **only** through `npm run decide`. Keep a change when the canonical
comparison prints `VERDICT: ACCEPT` and the 12-seed Δheadline > **+2**. After an
accepted change, commit it and treat it as the new baseline before the next mechanism.

## Canonical run

```
LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/<attempt-label>
npm run decide -- generated/golden-runs/<attempt-label>/golden.json generated/golden-runs/<baseline-label>/golden.json
```

## Rules
- Decide by golden + `decide`, not the test suite, not raw HEADLINE across unrelated runs.
- Do not edit scorer / golden specs / evaluator fingerprint / seed set / metric / budget grid
  (the 2026-06-07 spec addition below was an explicit, user-requested board change — the
  fingerprint was re-baselined in the same commit; that is the exception, not licence to keep editing).
- No spec-name branches; no tuning to one seed/budget/row or to the canonical grid as the only target.
- Budget behavior scales smoothly + deterministically; no hard thresholds. Determinism per (spec, seed, budget).
- Validity + wall-clock are diagnostic; the score is the decision signal.

## Baselines of record
- **`cand-arclen-room` — HEADLINE 580.42** (CURRENT, attempt 1 accepted). Room-gated
  arc-length opening. Per-budget 276 / 431 / 604 / 614 / 619.
- `baseline-newgolden` — HEADLINE 572.74 (superseded by attempt 1). 30 specs (20 original + 10 new
  sparse/creative), 12 seeds, fingerprint `2437d832b61e`. Per-budget 25k/50k/100k/150k/200k
  = 258 / 437 / 601 / 598 / 613. Validity 1741/1800 (@200k 360/360).
- `baseline-db5afdb` — HEADLINE 624.6 (SUPERSEDED; pre-spec-addition, 20 specs only,
  fingerprint `9b9776df145f`). Not comparable to the current board.

---

## Board change (2026-06-07): 10 new sparse creative specs
The original 20 golden specs are **~98% dense** (median gap 19f / 0.47s; only 2% of
gaps ≥40f). Longer arcs / climbs / pops physically have no room there — which is why
the earlier uniform arc-length widening regressed (−13): on a dense suite the lever
has nothing to express. To give the campaign signal, 10 specs were added (user request):
sparse or mixed cadence, **air + speed always, no grain**, 5 exercising **elevation**
and 5 exercising **amplitude**. The suite is now 25% gaps ≥30f, 12% ≥40f.

New specs and their baseline 200k score (axis headroom is the opportunity):
```
climb_terrace 493  swoop_dive 563  rolling_hills 638  summit_push 416  mixed_grade 550
big_air_ramp 458   pop_train 522   soar_settle 451   leap_cadence 474  float_bounds 424
```
These barely improve with budget (e.g. summit_push 393→416 across 25k→200k; float_bounds
390→424) — a **quality plateau**, not a completion gap. soar_settle is even non-monotonic
(444→473→459→442→451) — a selection pathology. This is the arc-placement lever's domain.

## The arc-length lever (the "rules of the game")
The primary new degree of freedom is **arc/ride length**, wired in
`scripts/v0/arc_placement.ts` `sampleContactCenteredLines`: `sampledPostLength` is
multiplied by a deterministic per-attempt factor `ARC_LEN_SPAN_LO..HI` (via
`lowDiscrepancyRoll(attempt, ARC_LEN_SPAN_SALT)`, **no rng-draw change**) and clamped
to `ARC_LEN_FLOOR..ARC_LEN_CAP`. **Shipped NEUTRAL** (1.0/1.0/28/220 = byte-identical).
For air-targeted gaps the air block (≈line 843) then re-sizes the ride-out toward a
`(1-air)` target capped by `safeCap = speed·nextGapFrames·0.55`; that cap is the real
ceiling on low-air (long ride-out) catches. Both are open for the campaign.

### Probe: active widening (NOT kept; measured on the SUPERSEDED dense board)
- SPAN 0.6..1.6 / FLOOR 16 / CAP 320 → HEADLINE 624.6 → 611.6, Δ−13, REJECT.
  The wider pool diluted faster than the forward-eval recovered. On the dense board
  longer arcs only crowded the next landing.

### Attempt 1: room-gated arc-length open (ACCEPTED, +7.7)
- **Baseline:** baseline-newgolden (572.74). **Candidate:** cand-arclen-room.
- **Change:** `SPAN 0.80..1.45`, `CAP 220→260`, and BOTH span ends fade to the
  neutral 1.0 as room→0 (`arcLenRoom` ramps over nextGapFrames 26→46). Dense gaps
  (the original 20 specs) stay byte-identical; only gaps with room get the wider
  (shorter AND longer) ride-out pool, which the forward-eval ranks.
- **decide:** HEADLINE 572.7 → 580.4, **Δ+7.7** · CI[−1.0, 23.6] · P(Δ≤0)=4.3% ·
  **VERDICT: ACCEPT**. Per-budget 25k +18, 50k −6 (noise), 100k +3.7, 150k +15.8,
  200k +5.7. Validity unchanged.
- **Read:** the lever's failure on the dense board was crowding; gating it to gaps
  with room turns it from −13 into +7.7. Confirms the board change was the unlock.
- **Disposition:** KEPT. New baseline-of-record.

## Selection / search facts (the deciding machinery)
- Per-candidate generation: `arc_placement.ts`. Local validity gates + axis-L2 `cost`:
  `core/candidate.ts`. Prefix ranking: `optimizer/handoff.ts`.
- **Forward-eval is the deciding ranker ≥75k budget** (`LR_FWD_EVAL`, default greedy:2):
  ranks each candidate by the TRUE metric score (`scoreDriftReport.full_score`) of where
  it leads over a 2-contact charged rollout. Below 75k the cheap local proxy decides
  (`scoreCandidateForHandoff`). The local `axisCost` weighting is INERT for final selection.
- Start selection (`LR_START_EVAL`, greedy:2) and worst-gap repair (`LR_REPAIR`,
  minBudget 150k) also use the true-score forward tool.

## Where the campaign should dig (failure shape to attack)
- **Low-air / long ride-out** (e.g. drums_pendulum glued sections, elevation specs): the
  `safeCap=0.55` ride-out ceiling floors achievable air. Earlier global relaxes regressed
  because longer ride-outs crowd the NEXT landing. The fix is to EXPAND the pool (keep the
  safe short candidates, ADD longer ones) — gated to ≥75k where the forward-eval ranks the
  downstream consequence honestly — not SHIFT it, and pair it with next-gap landing setup.
- **Amplitude / pop** (big_air_ramp, leap_cadence, float_bounds, soar_settle): sparse gaps
  now give room for tall arcs; the amplitude launch exists but these plateau at 30-45% axis.
- **Elevation climb** (summit_push, climb_terrace, swoop_dive): climb spends speed; the
  launch-vy band is wired. summit_push (climb to ceiling) is the floor at 416.
- **Selection/budget**: soar_settle's non-monotonicity says the forward-eval/repair is
  picking worse catches at higher budget on mixed cadence — a selection bug worth tracing.
