# Compiler Optimization Log — Arc Placement Campaign

Objective: raise canonical HEADLINE to **>700** by improving arc placement/generation.
Judge success **only** through `npm run decide`. Keep a change when the canonical
comparison prints `VERDICT: ACCEPT` and the 12-seed Δheadline > **+5**. After an
accepted change, commit it and treat it as the new baseline before the next mechanism.

## Canonical run

```
LR_ENGINE=wasm npm run golden -- --jobs=32 --archive-dir=generated/golden-runs/<attempt-label>
npm run decide -- generated/golden-runs/<attempt-label>/golden.json generated/golden-runs/<baseline-label>/golden.json
```

## Rules
- Decide by golden + `decide`, not the test suite, not raw HEADLINE across unrelated runs.
- Do not edit scorer / golden specs / evaluator fingerprint / seed set / metric / budget grid.
- No spec-name branches; no tuning to one seed/budget/row or to the canonical grid as the only target.
- Budget behavior scales smoothly + deterministically; no hard thresholds. Determinism per (spec, seed, budget).
- Validity + wall-clock are diagnostic; the score is the decision signal.

## Baselines of record
- `baseline-db5afdb` — HEADLINE **624.6** (commit db5afdb, pre-DOF). Per-budget 25k/50k/100k/150k/200k ≈ 192 / 418 / 667 / 660 / 682.

---

## The arc-length lever (the "rules of the game")
The campaign's primary new degree of freedom is **arc/ride length**, wired in
`scripts/v0/arc_placement.ts` `sampleContactCenteredLines`: `sampledPostLength` is
multiplied by a deterministic per-attempt factor
`ARC_LEN_SPAN_LO..HI` (via `lowDiscrepancyRoll(attempt, ARC_LEN_SPAN_SALT)`, **no
rng-draw change**) and clamped to `ARC_LEN_FLOOR..ARC_LEN_CAP`. Opening the span
(`HI`>1, `LO`<1) and the cap (`>220`) gives each gap a pool of shorter AND longer
arcs; the forward-eval keeps whatever scores. **Shipped NEUTRAL** (1.0/1.0/28/220
= byte-identical baseline) — open it during the campaign.

### Probe: active widening (NOT kept)
- **Baseline used:** baseline-db5afdb (624.6)
- **Setting:** SPAN 0.6..1.6, FLOOR 16, CAP 320 (active).
- **decide:** HEADLINE 624.6 → **611.6**, Δ **−13.0** · CI[−33.1, +4.7] · P(Δ≤0)=92% · **VERDICT: REJECT**.
  Per-budget: 25k −15 (noise), 50k −18 (noise), 100k −27 (P=99%), 150k −8, 200k −8. Validity unchanged (no crashes).
- **Read:** the wider pool dilutes quality faster than the forward-eval recovers it —
  consistent with the earlier *forced* low-air ride-out relax (−60). The freedom
  isn't free: longer arcs crowd the next landing / spend sample budget without a
  selection or landing-setup improvement to make them pay.
- **Disposition:** REVERTED to neutral. The lever stays wired for the campaign.

## Where the campaign should dig (failure shape to attack)
To make the arc-length freedom (and arc placement generally) pay toward >700:
- **Landing setup for long ride-outs:** a long arc leaves little room to set up the
  next catch — pair a longer ride-out with a quicker/steeper pre-contact on the
  *next* gap so the on-beat landing still happens.
- **Selection/budget:** the wider pool costs sample budget and dilutes; make the
  forward-eval keep long/short arcs only where they raise score (the local axisCost
  is inert for final selection — the forward-eval `scoreDriftReport.full_score` decides).
- **Where budget stops converting:** inspect per-budget curves; 100k was the softest
  spot under widening.

## Next baseline-of-record
- `baseline-db5afdb` (624.6) — unchanged; the neutral lever is byte-identical to it.
