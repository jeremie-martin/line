# Bench v2 — Optimizer Decisions

Living record of which optimizer variants ship vs which get shelved, with
the bench measurements that drove the call.

---

## P3.3 — Beam search vs lookahead-2 control (2026-05-24)

**Decision: SHELVE beam search.** Keep `scripts/lib/beam_search.ts` and
`tests/beam_search.test.ts` in-tree as reference + validation, but DO NOT
register `compose_beam_search` as a default bench strategy.

### Measurement

5 strategies × 13 specs, parallel=8, job-timeout=120s. Per-beat data in
`bench/v2/records.jsonl`.

Strategies compared:
- `baseline_old` — pre-P2 slide+catch + greedy (negative anchor)
- `compose_arc_descend_climb` — Phase 1 winner on cool + survival
- `compose_primitive_search` — Phase 2 (primitive-type search, no lookahead)
- `compose_primitive_search_la2` — Phase 3.1 control (lookahead-2)
- `compose_beam_search` — Phase 3.2 (K=4, B=2)

Headline numbers (onBeat5% / coolScore / wall-time):

| spec | baseline_old | arc_descend_climb | primitive_search | primitive_search_la2 | beam_search |
|---|---|---|---|---|---|
| metronome_60 | 100% / 1500 / 5s | 97% / 3713 / 56s | 70% / 1234 / 28s | 77% / 1761 / 28s | **100% / 3438 / 105s** |
| metronome_90 | 73% / 1633 / 28s | 91% / 3394 / 110s | 45% / 1666 / 71s | 75% / 2020 / 41s | **TIMEOUT** |
| metronome_120 | 39% / 1316 / 61s | 75% / 3102 / 26s | 36% / 1260 / 111s | 56% / 1775 / 103s | **TIMEOUT** |
| metronome_180 | 16% / 0 / 26s | 11% / 2038 / 4s | 11% / 951 / 24s | 9% / 1228 / 18s | **TIMEOUT** |
| tempo_change_60_120 | 69% / 1151 / 18s | 90% / 2694 / 43s | 59% / 985 / 31s | 69% / 1344 / 33s | 69% / 2669 / 114s |
| accelerando_60_180 | 48% / 1553 / 41s | 47% / 2650 / 16s | TIMEOUT | 47% / 1898 / 79s | **TIMEOUT** |
| sparse_dense | 55% / 891 / 4s | 52% / 2697 / 13s | 38% / 899 / 20s | 45% / 1102 / 20s | **55% / 2515 / 71s** |
| syncopated_off | 96% / 1523 / 6s | 92% / 2587 / 11s | 35% / 1041 / 45s | 50% / 1627 / 47s | **TIMEOUT** |
| polyrhythm_3v4 | 31% / 873 / 24s | 27% / 1610 / 7s | 18% / 1096 / 45s | 16% / 1429 / 44s | **TIMEOUT** |
| long_gaps | 20% / 0 / 1755s | 20% / 0 / 4s | 20% / 0 / 4s | 20% / 0 / 10s | 20% / 0 / 8s |
| drums_0_30s_60_125 | 44% / 2062 / 70s | 59% / 2724 / 43s | TIMEOUT | TIMEOUT | **TIMEOUT** |
| adtof_kick_snare_30s | 79% / 1864 / 18s | 40% / 0 / 53s | 40% / 1426 / 43s | 47% / 1472 / 42s | **TIMEOUT** |
| madmom_onsets_drums_20s | 32% / 1339 / 33s | 32% / 2007 / 11s | TIMEOUT | 13% / 1410 / 102s | **TIMEOUT** |

### Decision criteria (from the plan)

Ship beam search if all three hold:
1. **Beam beats lookahead-2 on onBeat5 by ≥5% on ≥3 of 9+ specs** — FAILED (2 specs only: metronome_60 +23pp, sparse_dense +10pp)
2. **Beam has strictly higher survival rate** — FAILED (beam 4/13 vs la2 12/13 specs survived without TIMEOUT)
3. **Beam wallclock ≤ 2× lookahead-2** — FAILED (~3.2× on the 4 specs where beam survives)

### Why beam underperformed

- **Compute amplification.** With landingCandidates returning ~7 primitives,
  K=4 beams × B=2 tries per candidate = 56 sims per beat — vs ~7 for the
  lookahead-2 greedy. Beam runs out of time-budget on any spec with
  > ~30 beats at non-trivial difficulty.
- **No prior over primitives.** Each beam member tries every candidate
  primitive once. Most primitives are not appropriate for most rider states;
  the search wastes 6 of every 7 sims on near-doomed placements.
- **Lookahead-2 is doing the work already.** The data shows lookahead-2 gets
  most of the precision benefit (e.g. m90: 45% → 75% with la2 alone) at
  much lower compute cost. Beam adds a diversity dimension that isn't
  needed when the per-beat scoring already considers next-beat consequences.

### What's next (Phase 4 candidates, driven by this data)

1. **Smaller, weighted candidate set.** Drop the candidate list to 3 strong
   landings (slide, drop, catch) with a per-type prior derived from past
   wins. ~2-3× compute reduction, similar quality.
2. **Analytic warm-start for params with closed-form solutions.** Slope ↔
   exit-velocity is analytic; jitter-around-solution should crush the long
   tail.
3. **Move-type-aware tries budget.** Bisection primitives (landAt, landUp,
   jump) need fewer outer tries because their internal search is already
   doing the work.

Beam search is NOT the next priority. Lookahead-2 + the above is.

### Files affected by this decision

- `scripts/lib/beam_search.ts` — retained in-tree as reference
- `tests/beam_search.test.ts` — retained (6 tests pass; validates determinism property)
- `scripts/bench_music.ts` — `beamSearchStrategy` retained but flagged as
  "not a default candidate" via the SHELVED comment; remains runnable via
  `--strategies=compose_beam_search`
