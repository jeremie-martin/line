# lab — golden-run analysis dataset

SQLite extraction of `generated/golden-runs` for score-loss analysis. Zero
deps (Node 22 built-in `node:sqlite`); the DB file is also readable from
Python stdlib `sqlite3`. DB: `generated/analysis/lab.sqlite` (~1.5 GB).

```
npm run lab -- index [--full] [--include-old]     build/refresh (incremental; full ~75 s)
npm run lab -- simulate [--run NAME] [--budget N] re-simulate a run → landings tier (~25 s/run)
npm run lab -- runs                               one line per indexed run
npm run lab -- sql "SELECT ..." [--json]          ad-hoc read-only SQL
npm run lab -- report <name> [--axis A] [--run R] canned analyses (see usage for list)
```

## Tiers

| table | grain | notes |
|---|---|---|
| runs | run dir | headline, score_without_impact, fingerprint, commit |
| budget_scores / spec_scores | run × budget (× spec) | from golden.json |
| checkpoints | run × spec × variant × seed × budget | scores + `compile_stats_json` and `budget_telemetry_json` blobs (query via `json_extract`) |
| gaps | per gap | per-axis target/achieved/error + impact/elevation ceiling, raw speed |
| arcs | per placed arc | from track.json: entry/exit tangent (deg, + = descending), signed turn (− = scoop), straightness, descent; `contact_index` pairs arc→gap (filter `checkpoints.arc_pairing_confident = 1`) |
| landings | per landing event | from `simulate` re-simulation: speed in/out over IMPACT_WINDOW, dspeed_px, vx/vy_in, redir_px/norm, air_frames; `contact_index` pairs landing→gap |
| ingest_issues | per problem | every skipped/corrupt file; cleared each index pass |

`budget_telemetry_json` follows `line.compile-budget-telemetry.v1`. Its units,
field semantics, estimator formulas, and analyzer commands are documented in
[`docs/compile-budget-telemetry.md`](../../../docs/compile-budget-telemetry.md).

## Reproducibility contract

- The indexer is read-only over archives and deterministic: two `--full`
  rebuilds give identical query results. Incremental re-index keys on
  golden.json mtime + checkpoint file count.
- `report loss` recomputes the headline from raw gap rows and must reproduce
  the run's stored `headline.score` and `score_without_impact` (it prints the
  self-check). If it drifts, the ETL or scorer changed — investigate before
  trusting anything else.
- `simulate` uses the scorer's own machinery (`extractRawTrajectory`,
  `detect`, `contactRedirArcPxAtLanding`); re-simulated `redir_norm` matches
  stored `gaps.impact_achieved` bit-exactly (verified over 57k landings under
  the pre-2026-07-31 net-form metric; the promotion moved both together).
- Canned reports default to the best-headline canonical run at the current
  `EVALUATOR_FINGERPRINT`; scores across fingerprints are NOT comparable
  (raw axis measurements are, EXCEPT `landings.redir_px`/`redir_norm` — the
  scored impact metric itself changed on 2026-07-31, so those two columns are
  only comparable within one fingerprint; join `checkpoints`→`runs` to tell
  which ruler a row was written under). `--run` / `--all-fingerprints` to
  override — the default single-fingerprint scope is what keeps this safe.

## Findings (2026-06-10, run arc-rewrite-work-new-smooth-merge-canon-01, headline 580.83)

Each finding lists its reproduction. Re-run after compiler changes to see if
they still hold.

1. **Impact is the dominant axis cost: ~62 headline points.** Dropping air or
   speed would *lower* the headline (−23/−26) — they prop up the RMS.
   → `npm run lab -- report loss`
2. **Achieved impact undershoots everywhere**: bias ≈ −0.15 globally, worse at
   high targets (−0.26 at target decile 8); flat across track position.
   → `report axis-vs-target`, `report position`
3. **The feasibility ceiling is NOT binding**: clamped and at-ceiling
   fractions ≈ 0. The shortfall is search/placement, not physics.
   → `report ceiling`
4. **Speed predicts impact**: corr(raw landing speed, impact_achieved) = 0.31;
   undershoot shrinks monotonically with approach speed.
   → `report speed-impact`
5. **Scoop shape predicts impact**: corr(turn_deg, achieved) = −0.47,
   corr(straightness, achieved) = −0.44; same features predict amplitude even
   harder (turn −0.67). Landing-tangent steepness reduces undershoot
   monotonically (−0.24 bias at −15° vs −0.06 at +40°) but the compiler lands
   near-flat (mode ≈ 5°).
   → `report geometry`, `report arc-angle`
6. **Hard landings cost speed (validated rider dynamics)**: dspeed over the
   6-frame window ≈ −0.15 px/f per 0.1 redir_norm, to −2.2 px/f at 0.8 —
   independent of speed band. By the next gap, slow/mid bands recover fully;
   fast keeps −0.3/−0.4 px/f yet stays above its speed target, so the
   score-level impact↔speed conflict is mild.
   → `simulate` then bin `landings.dspeed_px` by `redir_norm` × speed band
7. **Steep entry + deep scoop reconciles impact and speed**: entry +20° with
   turn −20..−30° ≈ same impact as flat+bendy, best bias (−0.04 vs −0.21
   typical), and next-gap speed GAIN (+0.3..+0.5 px/f vs −0.65 for flat+deep).
   The steep descent funds the redirection.
   → 2D bin arcs(entry_angle_deg × turn_deg) joined to gaps k and k+1

**Implication**: bias candidate selection toward steep-entry, deep-scoop
catches on impact-targeted beats. Three independent angles (scoring, geometry,
dynamics) point the same way; headroom ≈ 60 points before feasibility binds.

## Gotchas

- WASM engine in long batches: add lines as ONE `addLine(array)` call and
  force `gc()` + event-loop yield periodically (the lab npm script passes
  `--expose-gc`), or engine versions exhaust memory ("unreachable" panics).
- `arcs`/`landings` pair to gaps by order/time heuristics — always filter on
  `arc_pairing_confident = 1` (99% of checkpoints) resp. `contact_index IS
  NOT NULL`.
- Schema changes: bump `SCHEMA_VERSION` in schema.ts → next `index` drops and
  rebuilds the DB (landings must be re-simulated). Purely additive tables can
  skip the bump (DDL is idempotent).
