# Benchmark tooling inventory (V2–V6) for a revived "V7"

Date: 2026-11-01. Read-only inventory. Unless noted, every path is at the git
ref `archive/pre-rework-2026-10-03` (written **A:**); read with
`git show 'archive/pre-rework-2026-10-03:<path>'` (in zsh quote the ref or use
`${A}:path`, since `$A:s…` is a history modifier). *(inferred)* marks inference.

Short version: only **V2** (and V1 "golden" before it) had a real `decide`
(paired seed-block jackknife, Student-t probabilities, derated critical,
simulation-calibrated sequential looks, outcome attribution, under-power hint,
`nextCommand`). **V3/V4** had a descriptive `compare` (paired deltas, no
probability); **V5/V6** had `eval` only (one musical-parent bootstrap on V6
motion diagnostics, never on the headline). The "convenient decide and
statistics" is the V2 tooling (July–early September 2026); V6 contributed
case families and panels.

---

## 1. Timeline

| | Freeze / ship | Suite | Seeds / budget | Runs per panel | Headline |
|---|---|---|---|---|---|
| V1 "golden" | to late June 2026 | golden specs (`scripts/v0/golden_suite.ts`) | budget ladder, disjoint seeds | — | budget-weighted suite score; paired cluster bootstrap `decide` |
| **V2** | eval chain `9d068571` (07-11); last promotion `3f9cb2a5` (09-09) | 44 dev (21 normative + 23 variants) + 5 qualification monitors | 250k/500k/750k, then 750k only at N=8/16/32/48 | 352 (N=8) – 2,112 (N=48) per arm | hierarchical shifted-geometric (below) |
| **V3** | `3831bae4` (09-09) | 88: 44 V2 bridge + 39 new + 5 production | seeds 16, 17; 750k | 176 | V2 hierarchy, time-weighted spans, endings |
| **V4** | `98936eeb` (09-10) | 176: 88 V3 unchanged + 88 companions in the same parents | 16, 17; 750k | 352 | V3 implementation |
| **V5** | `9831c4a0` (10-01) | 75 canonical (56 fixed + 19 automatic), 40 confirmation; 22 sources | 101/202 (conf. 307/409); 3M frames | 150 / 80 | musical score × fraction of constructions fulfilled |
| **V6** | `7f8591c6` (10-01) | 115 canonical (96 fixed + 19 automatic), 74 confirmation; 33 sources | 101–404 (conf. 503–811); 3M | 460 / 296 | as V5, plus transfer checks |

**V2** (A: `docs/benchmark-v2-context.md`, `docs/benchmark-v2.md`)
- **Suite:** 44 TypeScript cases in `benchmark/v2/cases/`; membership in
  `benchmark/v2/catalog.ts`; variants materialized into
  `variant_catalog.generated.ts`. Strata: representative 70% (14 parents, 28
  cases), capability 15% (3, 8), legacy regression 10% (2, 4), development
  music 5% (2 Believer, 4). Each variant records "its parent, kind,
  parameters, and rationale". Qualification monitors (Amor, Luna, Tiki,
  Shelter, Amour) never enter the headline.
- **Headline:** valid cells score `1000·exp(−weighted_axis_rms/0.25)` (air
  30, speed 30, impact 30, amplitude 10; undefined axes renormalized away;
  invalid = 0). Aggregation (context §Validity): shifted geometric mean over
  seeds → over parent + variants → over equal parents in a group; weighted
  arithmetic over groups → 70/15/10/5 strata → 20/50/30 over 250k/500k/750k
  (later 750k only).
- **Commands** (A: `scripts/benchmark/cli.ts`): `npm run benchmark --
  prepare | status | eval --seeds=48 --jobs=48 | baseline-cache extend |
  rebaseline --from=… | decide | explain | family … | scale …`. 48 workers by
  default, a resource sample every 5 s (`resource_monitor.ts`), seed-major
  queue (all 44 cases for a seed slot before the next).
- **Wall time (64-logical-CPU host):** July: 252 compiles in 58 s, "~4.3
  compiles/s at 48 workers"; a depth-48 confirmation (12,672 compiles) took
  58 min (A: `docs/benchmark-v2-resources.md`, `docs/archive/benchmark-v2/review-rfc.md`).
  An N=48 three-budget eval (6,336 candidate compiles) took 42m54s (A:
  `docs/archive/compiler-improvement-campaign-through-2026-08-16.md:2945`).
  Later a 44 × 8 eval at 750k took ~26 min (A: `scripts/benchmark/mover_grid.ts`).
- **Headline history:** ~441–451 (V2.2) → ~594–603 (August, impulse scorer)
  → 777.8 → **852.1248** (arc-control-memory, N=8, 2026-09-09).

**V3** (A: `docs/benchmark-v3.md`, `benchmark/v3/README.md`)
- **Suite:** 88 specs, 6 music works, 65 aggregation parents; the 39 new
  programs share 13 family grammars.
- **Changes from V2:** frozen integer airborne-frame air targets; every span
  scored, including endings (262.4 s); span errors time-weighted, impact
  event-weighted. Strata, groups, axis weights and tolerance 0.25 kept.
- **Commands:** `node --import tsx scripts/benchmark/v3.ts status | eval
  --compiler-root=. --out=DIR --jobs=16 | compare --candidate=RUN/run.json`
  (jobs capped at 48).
- **Wall time:** mean compile 21–22 s; two 176-compile panels ran
  concurrently at 14 workers each (A: `benchmark/v3/initial-validation.json`
  `.resources`), so about 5 min per panel *(inferred)*.
- **Headline:** 831.15 → 853.98, then 885 → 930 through the arc campaigns
  (`benchmark/v3/runs/arc-*.json.gz`). Both seeds gave identical geometry for
  every spec, which is why V3 dropped seed statistics.

**V4** (A: `benchmark/v4/README.md`): 176 cases, seeds 16 and 17, 750k, the
V3 judge. Each V3 case gets one companion in the same parent (tempo, cadence,
offsets, contrasts, and supported passages of **7–12 s, some 15 s**).
Commands: `npm run benchmark:v4 -- status|eval|compare`; also
`v4_author.ts`, `v4_audit.ts`, `v4_freeze.ts`. Headline: 915.69 baseline (V3
subset 930.16, extension 901.50) → 926.94 → 952.41 (`97d2af4d`) → 952.52
(`e374c022`). V3-subset and extension scores were reported alongside.

**V5** (A: `benchmark/v5/README.md`): construction requests (guided shapes,
ordinary arcs, scattered fragments) on copied V3/V4 targets. Headline = raw
V4 musical score × fulfilled fraction of scored supports; fixed and automatic
panels weigh half each. `v5.ts eval --out=DIR --compiler-root=… --jobs=8
[--split=confirmation]`. Result 449.09 → 770.12, confirmation 790.11 (A:
`docs/production-repertoire-results-20261001.md`).

**V6** (A: `benchmark/v6/README.md`; still in HEAD): 96 fixed requests (7
families × 8 musical contexts × paired and transfer layouts) + 19 automatic
arrangements; the automatic groups carry V2 group names (`regular_exceptions`,
`subdivision_pickup`, …). Motion-burst qualification sits beside the
headline. `v6.ts eval --compiler-root=… --out=DIR --jobs=8` (cap 24). Mean
compile **64–85 s**, 8–11 CPU-hours per 460-run panel (A:
`docs/evidence/intentional-motion-v6-development-20261001.json.gz`); a full
sentinel takes ~30 min at 24 jobs today (HEAD `WORKING.md`). Headline 536.33
→ 835.62 (`5b031f7e`), confirmation 795.53; 315 of 460 tracks distinct.

## 2. The decision tooling

### 2.1 V2 `decide` / `eval` / `rebaseline` (the tooling worth reviving)

| Path (A:) | Lines | Role |
|---|---:|---|
| `scripts/v0/benchmark_v2/decision_model.ts` | 927 | the statistics |
| `scripts/v0/benchmark_v2/sequential_inference.ts` | 197 | look boundaries, P(Δ>0) |
| `scripts/v0/benchmark_v2/decide.ts` | 1260 | archive comparison, `renderDecision`, `underPoweredHint`, `nextCommandFor` |
| `scripts/v0/benchmark_v2/eval.ts` | 766 | candidate-only run against the cached baseline, with looks |
| `scripts/v0/benchmark_v2/eval_report.ts` | 104 | terminal renderer |
| `scripts/v0/benchmark_v2/round_progress.ts` | 372 | live per-seed-round line |
| `scripts/v0/benchmark_v2/outcome_attribution.ts` | 82 | validity vs quality split |
| `scripts/v0/benchmark_v2/rebaseline.ts` | 586 | promotion |
| `scripts/v0/benchmark_v2/runner.ts` | 2002 | worker pool |

Policies: `benchmark/v2/decision-policy.ts`, `benchmark/v2/eval-policy.ts`.
Calibration: `scripts/benchmark/{calibrate_sequential_eval,calibrate_decisions,study_decision_coverage,study_power_grid,study_seed_structure,study_pairing}.ts`.

**Statistics:**
- **Paired.** The estimand is "candidate headline − baseline headline at the
  same literal seed prefix" (A: `docs/benchmark-v2-decisions.md`). Invalid
  runs score 0, so validity changes are part of the effect.
- **Unit = seed block** (one seed shared by every case at one budget).
  `seedBlockConfidence` takes leave-one-seed-block-out jackknife
  pseudo-values of the *full hierarchical headline delta* per budget,
  combines budgets as weight²·var/n, and builds Student-t intervals with
  Welch–Satterthwaite df (decision_model.ts ~L660–735).
- **Bootstrap = sensitivity only.** Policy method
  `stress_calibrated_paired_budget_seed_block_jackknife_t_with_parent_bootstrap_sensitivity`:
  20,000 crossed (parent × seed) and catalog-only parent-bootstrap draws,
  printed as "sensitivity SE", never the gate.
- **Derating.** The canonical profile has α=0.05 but decides with a
  **one-sided 99% t critical** (criticalAlpha 0.01), printed as "95% coverage
  target using a 99% one-sided t critical". The RFC calls the derate
  "load-bearing": α=0.05 breached 5% false-accept under zero-inflation
  (6.5% hard-zero at depth 8), while α=0.01 stayed ≤2.6%
  (A: `docs/archive/benchmark-v2/review-rfc.md` §B.3). The probe ("screening")
  profile used α=0.10 / critical 0.05 with verdicts advance/stop/unresolved.
- **Probability.** A reference Student-t "directional probability" P(Δ>0),
  printed every round; "interpretable but not an unadjusted promotion cutoff".
- **Sequential (from August).** Strict looks at N=8/16/32/48 with an
  O'Brien-Fleming-t boundary `T_N ≥ c/√(N/48)`, `c = 1.96392337`; a symmetric
  harm boundary; no futility stop. Calibrated on 10k + 10k simulated paths
  under Gaussian, t(5) and 20%-zero-inflated stresses, every Wilson-95 upper
  bound ≤5% (A: `docs/benchmark-v2-sequential-eval-calibration.md`).
- **MDE (July, fixed N, α=0.01; review-rfc §B.3):**

  | Seeds/budget | 8 | 16 | 32 | 64 | 128 |
  |---|---:|---:|---:|---:|---:|
  | MDE(80%), points | 10.6 | 6.8 | 4.4 | 2.8 | 1.9 |

  Compiles per arm ran from 1,008 (depth 8) to 16,128 (depth 128).
  Seed-count error tables: A: `docs/benchmark-v2-seed-allocation.md`.
- **Modes:** `improvement` (threshold 0) and `simplification --margin=m`
  (non-inferiority at −m, fixed N, no looks).
- **Outcome attribution** (A: `docs/benchmark-v2-outcome-attribution.md`):
  both-valid counterfactual delta with its own SE, validity-sensitive
  remainder, better/worse/tied counts on both-valid cells,
  reference-only-valid and candidate-only-valid counts. This is today's
  "completion separately from quality".
- **Under-power hint:** an unresolved Δ>0 prints the seeds needed,
  `N·(SE/SE_req)²` with `SE_req = Δ/(t_crit + 0.8416)` (80% power).

**Inputs and outputs:** candidate and baseline archives must match on suite
fingerprint, scoring protocol, engine artifact, schedule and scope, with
checksums verified. `eval` freezes the candidate compiler into a snapshot
tarball and compiles only the candidate; the baseline comes from a
prefix-addressable cache (`benchmark/v2/campaign-baseline.json`). Files next
to `--out`: `.request.json`, `.checkpoint.jsonl` (resumable),
`.progress.jsonl`, `.N8/.N16/.N32/.N48.json`, `.look-N.json`,
`.comparison.json` (promotion input), `.gz` + decision index + sha256
sidecars. `--json` writes one JSON value to stdout; exit 0 = completed
scientific result, 1 = invalid execution.

**Example output** (real; A:
`docs/archive/compiler-improvement-campaign-through-2026-08-16.md:2945`):
```
headline 497.82 -> 509.11   delta +11.29   seed-block SE 1.45   95% [+7.49, +15.09]
one-sided lower +7.87                      RESULT: STRONGER THAN BASELINE
validity 5852/6336 -> 5902/6336  (gained 96, lost 46)
  250k  +14.78  [+10.87, +18.69]
  500k  +12.07  [ +6.31, +17.84]
  750k   +7.65  [ -0.64, +15.94]
strata
  representative     +11.33  [+10.23, +12.44]
  legacy_regression  +12.22  [ +8.23, +16.20]
```
The full renderer (`eval_report.ts`) adds the sequential line
(`N=8 P(+)=75.40% (required 99.90%): continue; …`), outcome attribution, the
5 largest case regressions and improvements, artifact paths and
`nextCommand`. The live round line (`round_progress.ts`) reads
`round k/N seed s: valid a/b, failures f; cumulative H (Δ, SE, P+ x%); LOOK
action, need y%`, with throughput and ETA.

**Promotion:** `rebaseline --from=…comparison.json --label=…` requires
`accept` and committed compiler bytes that match the snapshot. Owner override:
`--force --force-reason`, which keeps the original verdict.

**Retired before October:** the attempt ledger (`benchmark/v2/attempts.jsonl`,
`era-state.json`, era α-budget) on 2026-07-23 (A:
`docs/archive/benchmark-v2/legacy-era-ledger.md`); the operating-point and
certification menus the same month (A:
`docs/archive/benchmark-v2/operating-points-era-workflow.md`).

**Relatives:**
- `benchmark -- scale baseline|eval|compare`: a compact paired multi-budget
  profile with 4/8/16 looks (A: `scale_decision.ts`, `docs/benchmark-v2-multi-budget.md`).
- `benchmark:v2:low-budget-reading`: 11 sources at 250k × 48 seeds, two arms,
  "tracked but never promoting"; verdicts PARITY / RESCUE-POSITIVE /
  SCORE-POSITIVE / ADVERSE / UNDERPOWERED (A: `docs/compiler-v2-workflow.md`).
- `scripts/benchmark/mover_grid.ts` + `mini_manifest.ts` + `action_set_power.ts`:
  a many-seed paired grid over only the sources a change can move, with a
  mandatory power footer (~4 min for 7 sources × 48 seeds at 750k).

### 2.2 V1 `decide` (June 2026)
`npm run decide -- <cand>/golden.json <base>/golden.json`
(`scripts/v0/analyze_golden_curve.ts` with `scripts/v0/metric.ts`
`pairedBootstrapCI`): a paired cluster bootstrap; accept iff P(Δ≤0) < 0.10;
prints the seeds needed to resolve. Example output:
`Δheadline = +12.5 · 95% CI [0.7, 24.7] · P(Δ≤0)=1.9% · effect=2.06 · VERDICT: ACCEPT`
(A: `docs/archive/GOAL_LDS_ARC_PLACEMENT.md:394`; `docs/archive/HOW_TO_WORK_V1.md` §Deciding).

### 2.3 V3–V6: no decide
- **V3/V4 `compare`** checks suite, budget, seeds and catalog, then emits
  before/after summaries, the delta and per-case deltas. Its decision field
  reads `'descriptive paired full-suite result; no automatic promotion or
  claim of generalization probability'` (A: `scripts/benchmark/v3.ts:118–132`,
  `v4.ts:125–140`), because two deterministic seeds gave identical geometry.
- **V5/V6** have `eval` only. Paired evidence was ad hoc:
  `scripts/benchmark/v6_motion_evidence.py` (a 1,000-draw musical-parent
  bootstrap on motion-burst change only, labelled "descriptive"),
  `summarize_v6_evidence.py`, `production_repertoire_evidence.py`.
- **Answer:** V3–V6 had **no decide-style probability on the headline**;
  only V2 (and V1) did.

## 3. Reporting, exploration, ledgers and fingerprints

| Tool (A:) | What it showed |
|---|---|
| `scripts/v0/benchmark_v2/explain.ts` (`benchmark explain ARCHIVE`) | per budget: valid/invalid, pooled valid axis RMS, dominant axis; per case and phase: complete runs, contact hit rate, incomplete phases; writes `.explanation.md` |
| `scripts/v0/benchmark_v2/status.ts` | active baseline, cache coverage, next look, exact compute required |
| `scripts/benchmark/v3_explorer.ts` → `docs/assets/benchmark-v3-explorer.html` (2.3 MB, standalone) | family filter, spec picker and brief; previous vs current score; SVG timeline of authored vs measured impact; air/speed/amplitude target vs achieved per gap; ending shading; Web-Audio authored clicks |
| `scripts/v0/benchmark_v2/{render_clicks,listening_review}.ts` | click renders per case for the owner's listening approval (`benchmark/v2/evidence/listening-review.json`) |
| `scripts/benchmark/analyze_campaign_baseline.ts` → `docs/benchmark-v2-current-baseline-analysis.md` | within-baseline axis headroom, per-case and per-phase errors |
| `scripts/v0/study_headline_counterfactual.ts` | zero-compile re-scoring ("headline if axis X were perfect") |
| `dashboard/` (`?golden=1`) | V1 golden-runs analyzer and per-run video + timeline cockpit; deleted in `04a481fa` |
| `motion-gallery/{production,workspace,music}.html` | V5/V6 repertoire and production review; `?compare=previous` paired native playback |
| `scripts/v0/analysis/lab.ts` (`npm run lab`) | SQLite over golden runs, 9 reports (V1 era) |
| `benchmark -- family capture/run/select` (`family.ts`, 1,134 lines) | ≤8 frozen compiler variants per round on shared exploration seeds (3e9–4e9, default 6); variants carried between rounds (`carriedFromRound`); descriptive report plus recorded selection |

**Ledgers:** `benchmark/v2/baseline.json` (frozen full ladder),
`benchmark/v2/campaign-baseline.json` (active 750k snapshot, promotion depth,
cache), `attempts.jsonl`/`era-state.json` (retired 07-23),
`benchmark/v2/confirmations/*.json` (18), `benchmark/v{3,4}/baseline.json` +
sha256 + `runs/*.json.gz`.

**Fingerprints:** `scripts/v0/benchmark_v2/suite_model.ts` hashes case,
scorer and aggregation script bytes (suite fingerprint), plus separate
inference, policy and calibration fingerprints. `compiler_snapshot.ts` tars
compiler sources, WASM bytes and `LR_*` env. V3–V6 used `plan.json`
(compiler identity, judge identity, `executionSha256`) and per-cell
`planSha256`. HEAD replaced all of this with a git-based
`scripts/lib/compiler_identity.ts` and an evaluator fingerprint in `tools/eval`.

**"DNA tree"** *(inferred; no file, commit or session log uses "DNA")*. Ranked
candidates:
1. **The decide/eval breakdown hierarchy**: headline → budgets → strata →
   largest case movers, with an interval on every level. It mirrors the V2
   suite tree in `suite-manifest.json` (strata → groups → normative parents →
   authored variants) and sat right next to decide and the statistics.
2. **The V2 case family tree**: variants derived from normative parents with
   "parent, kind, parameters, rationale"; V4 companions in the same parent;
   V2 group names surviving into V6 automatic groups. The genetic
   parent/variant vocabulary fits "DNA".
3. **`benchmark family`**: variant rounds carried forward, i.e. a candidate
   lineage.
4. Speech-to-text guesses: "data tree", or "D-index" (V2
   `*.decision-index.json`).

To confirm, show the owner the §2.1 output and the V3 explorer.

## 4. Documentation (ranked by usefulness for reviving)
1. `docs/benchmark-v2-decisions.md` (81 lines): estimand, uncertainty, looks,
   verdicts, promotion checklist. The best single page.
2. `docs/compiler-v2-workflow.md` (271): the operator loop (prepare, status,
   eval, rebaseline), what to inspect, low-budget reading, families, discipline.
3. `docs/benchmark-v2.md` (156): commands, artifacts, resume/pause protocol,
   JSON and exit behaviour.
4. `docs/archive/benchmark-v2/review-rfc.md` (631): purpose, usage model,
   MDE and power tables, derate rationale, "honest limits".
5. `docs/benchmark-v2-context.md` (225): catalog design, strata, headline,
   aggregation, identity boundary.
6. `docs/benchmark-v2-sequential-eval-calibration.md` (36) and
   `docs/benchmark-v2-decision-calibration.md` (59): how the rule was calibrated.
7. `docs/benchmark-v2-seed-allocation.md` (53), `docs/benchmark-v2-resources.md`
   (52), `docs/benchmark-v2-outcome-attribution.md` (33).
8. `docs/benchmark-v3.md` (181), `benchmark/v3/README.md` (81): endings and
   time-weighting rationale, fixed-track bridge method;
   `benchmark/v4/README.md` (95): companion design. `benchmark/v6/README.md`
   is still in HEAD.
9. Historical validation: `docs/archive/benchmark-v2/{eval-chain-validation,reliability-validation,workflow-validation-log}.md`,
   `docs/benchmark-v2-{audit,characterization,case-review,alignment-review}.md`.
10. `docs/HOW_TO_WORK.md` (126): the V6-era loop, with no decide.

## 5. Other removed things that look valuable
1. **Low-air endurance frontier.**
   `benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts`
   (62 s; 2 s, 3 s and 5 s low-air ride-outs with recoveries) and
   `variants/capability/frontier_low_air_endurance_{4s,6s,7s}.ts` make a 2–7 s
   ladder. V4 companions reach 7–12 s (some 15 s) of supported riding;
   prototype: `benchmark/v2/archive/prototype-v2.0/specs-v2/capability_low_air_rideouts.ts`.
   V3's largest regression was this parent (823.80 → 777.09).
2. The other capability frontiers: `frontier_dense_recovery` (+
   `_240ms_figures`) and `frontier_pickup_progression` (+ `_shifted`).
3. The V3 explorer (§3): standalone, no server.
4. `mover_grid.ts` + `mini_manifest.ts` + `action_set_power.ts`: cheap,
   targeted, many-seed, with an honest power statement.
5. Outcome attribution: both-valid counterfactual vs validity remainder.
6. The cached-baseline, candidate-only pattern, with a compiler snapshot for
   the baseline arm.
7. Simulation calibration of the decision rule
   (`calibrate_sequential_eval.ts`, `study_decision_coverage.ts`): null, gain
   and zero-inflated stresses are tested before use.
8. `explain.ts`: phase-level failure localization and the dominant axis.
9. The fixed-track bridge (`scripts/benchmark/v3_bridge.ts`): re-score the
   same tracks while changing one contract part at a time. Useful whenever
   the V7 ruler changes.
10. The low-budget reading: a non-promoting secondary operating point that
    shows rescue effects.

## 6. Still in HEAD and directly reusable
- **`tools/eval`** (782 lines), `run` and `report`:
  - plan-bound immutable inputs, resumable cells, evaluator fingerprint,
    every ruler (v1/v2/v3), completion first, quality on both-complete cells,
    per-spec seed signs, a geometry section;
  - headline `1000·exp(−rms/0.25)` per cell (invalid or incomplete = 0), per
    stratum and as the mean of strata;
  - `summary.ts` already has a song `bootstrap()`, used only by the dev and
    confirm report;
  - panels `dev`, `confirm`, `bench`, `bench-confirm`, `bench-pairs8`,
    `sealed`, `heldout`, with 11 `bench-*` and 6 `sealed-*` specs today;
  - the baseline `bench-base-20261031` is 41 cells in 249 s; mean compile is
    146–152 s per cell (`generated/eval/bench-base-20261031`, `pairs8-base-20261031`).
- `scripts/lib/{compiler_identity,artifact_lock,rng}.ts`; `tools/parity`
  (output-frozen V6 judge); `tools/report` + `motion-gallery/night.html`
  (night report); `motion-gallery/pairs.html` (blind pairwise owner
  studies); `spec-dashboard/`.
- `benchmark/v6` (sentinel, `scripts/benchmark/v6.ts`). `benchmark/v3`, `v4`
  and `v5` keep catalog, model, policy and evaluator but **no READMEs,
  baselines or runners**; the 176 V4 specs still feed the training-catalog audit.
- `docs/research/benchmark-audit-20261031.md`: it removed intervals because a
  4-*song* bootstrap excluded zero ~20% of the time under no change.

## 7. Recommendation for V7

**Revive first (tooling):**
1. **A `decide` on top of `tools/eval`**, not a resurrected V2 runner (2,002
   lines) with its governance. Port `seedBlockConfidence` and the Student-t
   helpers from `decision_model.ts`, plus `sequential_inference.ts`,
   `outcome_attribution.ts`, the `eval_report.ts` renderer, `underPoweredHint`
   and `nextCommandFor`.
   - Unit: the seed block (one seed across all V7 specs), paired by case.
   - Report the headline Δ with SE, interval and P(Δ>0); completion
     (validity) and both-valid quality separately; per stratum and per spec,
     with the largest movers; every ruler.
   - State the scope: "robust to new seeds on this frozen catalog", not
     "generalizes to new music"; held-out songs stay a separate decision
     point. This answers the audit's objection, since the df come from seed
     blocks rather than 4 songs.
2. **Cached baseline with candidate-only compiles,** a seed-major queue at 48
   jobs, and a live round line (running Δ, SE, P+, ETA).
3. **Recalibrate before use.** `c = 1.9639` and the derate are bound to the
   V2 scorer and its seed-variance structure. Rerun the
   `calibrate_sequential_eval.ts`-style simulation on a fresh V7 baseline with
   ≥16 seeds. Seeds now give distinct tracks (audit), unlike V3.
4. **`explain` and a regenerated explorer** (the V3 pattern on V7 specs:
   targets vs achieved per window, clicks), plus one usage document modelled
   on `docs/benchmark-v2-decisions.md` and `docs/compiler-v2-workflow.md`.

**Then the case suite:**
- Keep the bench strata (G, P1–P6) and the sealed and held-out discipline.
- Add capability strata re-authored as current production specs: low-air
  endurance (a 2–7 s ladder plus 10–15 s supported passages from V4), dense
  recovery, pickup progression. Re-author rather than port: V2/V3 cases use
  the old score model (air fractions, speed/amplitude curves, old impact
  targets), not `music.ts`/`spec.ts` with `line.strike.v3`.
- Weight patterns through spec counts (REWORK, Oct 31) but with explicit
  parents: V2's "a parent and its variants share one weight" stops
  near-duplicates inflating influence. That was V4's and V6's problem: V4
  doubled to 176 by companions; V6 had 96 fixed requests over only 8 musical
  contexts, with 315 distinct tracks in 460 runs.

**Size and runtime** *(inferred from ~150 s per compile; 48 jobs give at most
~1,150 cells/h, likely less on 64 logical CPUs)*:

| Specs × seeds | Cells per arm | Time per arm |
|---|---:|---:|
| 40 × 8 | 320 | ~20–30 min |
| 60 × 16 | 960 | ~1–1.5 h |
| 60 × 48 (V2-style maximum) | 2,880 | ~3–4 h |

All stay well under a day, especially with a cached baseline. Prefer ~40–60
distinct specs with strict sequential looks (8/16/32) over hundreds of
near-duplicates.

**Leave dead:** the attempt ledger and era α-budget; certification menus and
operating points; runner-compatibility approvals; the 250k/500k/750k ladder
(the budget is now `standard`, scaled to ride length); the qualification
monitor as a gate; the V5/V6 construction-fulfilment multiplier as headline;
V3–V6 catalogs as targets (trained on; V6 anti-correlated with clarity per
the codex-era audit); the 1,000+-line fingerprint machinery (git identity plus
the evaluator fingerprint suffice).

**Needs rework because the compiler, physics and ruler changed:**
- All old baselines and calibrations are invalid: impact went redirArc →
  accumulated impulse → `line.strike.v3`.
- The V2 amplitude axis and its 30/30/30/10 weights do not match today's
  grade (air, speed, v3 impact).
- V2 aggregated with shifted geometric means; today's report uses arithmetic
  stratum means. Choose one deliberately.
- Compile cost is ~7× V3's 22 s.
- Per CLAUDE.md, a decide probability on the headline becomes a decision basis
  only after the v3 impact account agrees with the owner's blind labels; until
  then it is reported, not optimized.
