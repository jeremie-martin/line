# Geometry campaign — attempt log

Terse audit trail for the geometry campaign (scope: `docs/geometry-campaign.md`; prompt:
`docs/geometry-prompt.md`).

**Discipline (read once).**
- One entry per attempt or study. Format: **setup · what I did · result · verdict.**
- **Facts only. Never explain a result by a presumed mechanism we have not measured.**
  Write "rotate-span widen paid −1.2 on the board, gate-fails +18%" — not "it lost
  *because* the rider over-rotates." A measured cause is a fact and may be stated; an
  assumed one may not.
- Numbers come from real runs only — all from `./scripts/v0/eval_geometry.sh`
  (12 specs x {150k,300k} x 9 seeds, frozen baseline). The board is the campaign's
  decision instrument; there is no separate canonical gate.
- Studies / telemetry / statistics get entries too: this campaign gathers empirical
  data, it does not try random changes until one sticks. A study entry records what was
  measured and the numbers, not a conclusion beyond them.
- ACCEPT → commit, then `rebuild` the board baseline so it tracks the new HEAD. REJECT →
  revert code, keep the log entry + any scripts.

---

## 0. Baseline at campaign start

Setup: `scripts/v0/eval_geometry.sh` frozen-snapshot, board = 12 specs x {150k,300k} x 9
seeds, `LR_ENGINE=wasm LR_FWD_EVAL=greedy:2`, current committed default geometry
(`arc-rewrite` HEAD `07e220d`). Frozen baseline `baseline-b024ac55cf25`.

```
BOARD HEADLINE (probe tier)   611.24    validity 216/216
  150k  609.8
  300k  619.8
```

This is the board's frozen reference for every geometry edit; the script REUSES it
until specs/budgets/seeds change. North star: board headline up; the board is the
decision instrument (no separate canonical gate).

---
