# Benchmark and evaluation audit (2026-10-31)

Read-only audit at `75793369`. No benchmark, eval, compiler or spec code changed.
Evidence, commands and definitions are in
[benchmark-audit-20261031.json](benchmark-audit-20261031.json). The scratch
scripts are not committed; the JSON describes each one.

Trouble, Valhalla and Circus Minimus are held out. They appear here only as
binned categories (none / some / many, duration bands), never as exact
parameters. Nothing proposed below is built from them.

## Summary

- **The behavioural panel is four specs.** `--panel=dev` and `--panel=confirm`
  compile the same four production specs. Each panel varies only seeds and
  one-frame perturbations. Two of the four are near-grids: 62 of 74 gaps on
  Luna and 69 of 77 on Amor are 0.55 s long.
- **The panel lacks what the new songs need.** No authored panel gap is under
  0.29 s, and only Amour has gaps under 0.35 s. There are no long floats with
  a high air ask, no word-like runs of light hits (asks 0.2–0.35 appear only on
  Luna's 0.55 s grid), and nothing of 70 s or more. All three held-out songs
  have these categories.
- **Completion is at its ceiling.** 957 of 962 stored panel cells are
  complete. All 5 failures are in ablation or half-budget arms. The panel
  cannot see the failures that matter (Circus `pairs4`: 0 of 24 seeds).
- **The intervals are weak.** The song bootstrap has n = 4. Under no change,
  each metric's interval excludes zero about 19–21% of the time. The report
  prints 74 such rows (37 metrics × authored/perturbed).
- **Recommendation.** Keep every layer for history. Replace the decision
  panel with a pattern-stratified panel of new dev specs on the four songs.
  Report completion per pattern and before quality, and seal some specs for
  confirmation.

## 1. Inventory

| layer | what it runs | measures | gates | cost | verdict |
|---|---|---|---|---|---|
| `npm run parity` (`tools/parity`) | 63 cells, 18 distinct V6-catalog cases (copies of the 4 songs + 2 `bridge_frontier` programs); landing 30, strike/strike2/strike3 11 each; 18 cells at 150k/750k frames pin hash+frames only | track hash, physics frames, score | structural changes | about 81 s (REWORK, Oct 3; not re-run) | **Keep.** An identity check, not a benchmark. Its inputs are V6 copies with stored V6 preferences, so the production default path (`productions/*/spec.ts`, `creative: {}`) is not byte-pinned (ARCHITECTURE says so too). |
| `npm run parity:judge` | re-scores 33 stored tracks; `--all` adds the stored V6 run | score identity | judge/compiler file cleanups | short | **Keep.** |
| V6 sentinel (`npm run sentinel`, `benchmark/v6`) | 115 cases × 4 seeds = 460 runs (confirmation split 74 × 4 = 296), 33 sources, fixed 3M frames | frozen V6 musical score × fulfilment | delivery-boundary regression only | about 30 min at 24 jobs (WORKING.md; not re-run) | **Keep frozen; it is legacy.** It compiles in `landing` mode (its worker passes no `impactContract`), which is not the product's objective. Retire it with landing mode. Frozen by outputs (`judgeIdentity`, stored scores). |
| `benchmark/v3`–`v5` | no runners (archived at tag) | — | none | — | **Legacy library.** It holds code and data for V6 (`v5` aggregation), training (`v4` catalog, `caseSpec`) and production loading (`v3/model.ts` `sha`, `Case`). Move what is needed when V6 goes. |
| `npm run eval` (`tools/eval`) dev / confirm | 4 production specs × (4 seeds + 2 perturbations at one seed) = 24 cases per panel; standard budget (1,700 frames per ride frame); `strike3` | 37 song-level metrics: completion, all impact accounts, guards, air/speed/amplitude rms, cost | behavioural accept/reject | 24 compiles per panel; stored runs show a median of 75–123 s per compile at 24 jobs | **Change** (section 4). The provenance machinery (plan, resolved inputs, evaluator identity, cell records) is sound and stays. |
| Training-catalog audit | 168 `benchmark/v4` cases × seeds 101/202 = 336, 15 groups | the eval summary, group bootstrap | supporting evidence only (Oct 5, Oct 30) | 336 compiles | **Keep as a labelled robustness diagnostic.** It has the short gaps and long songs the panel lacks, but it is training data for the construction and value models, so it cannot be a target. There is no committed runner (a scratch worker, per `binding-stop-20261030.json`). |
| Held-out new songs | ad hoc `npm run produce` seeds (for example Circus `pairs4` × 24) | completion, review | none formally | per run | **Formalize** as a sealed eval panel, run only at decision boundaries. `tools/eval` hard-codes the four songs and has no variant support. |
| Owner blind studies (`labels/studies`, `tools/measure` pair tools) | pairwise clips | agreement of measures with the owner | whether a measure may become an objective | owner time | **Keep.** The only ground truth. |
| `tools/report` (night page) | viewer over eval runs | — | — | — | Keep as a viewer. |
| Golden runs, V2 "suite", `baseline.json`/`attempts.jsonl`, "handout" | none | — | — | — | **Dead.** Archived at `archive/pre-rework-2026-10-03`. No tracked code references them (grep). `generated/golden-runs` is August-era local data. |
| `productions/*/select.json` `floors`, `budget` | loaded by `scripts/produce/config.ts` | — | nothing reads them | — | **Dead fields** (grep). |

## 2. Composition

### The panel, spec by spec (jolt −15 ms applied, as the eval does)

| spec | s | landings | per s | gaps < 0.25 | < 0.35 | ≥ 1.2 s | most common gap | asks < 0.1 / 0.1–0.3 / 0.3–0.6 / 0.6–0.8 / ≥ 0.8 | mean speed ask |
|---|---|---|---|---|---|---|---|---|---|
| luna_bala_44s | 44 | 75 | 1.70 | 0 | 0 | 2 | 0.55 s (62 of 74) | 8 / 3 / 37 / 15 / 12 | 0.70 |
| amor_na_praia_46s | 46 | 78 | 1.70 | 0 | 1 | 1 | 0.55 s (69 of 77) | 8 / 1 / 41 / 22 / 6 | 0.69 |
| tiki_tiki_48s | 48 | 77 | 1.60 | 0 | 0 | 0 | 0.425 / 0.875 s | 14 / 0 / 16 / 45 / 2 | 0.66 |
| amour_de_ma_vie_44s | 44.5 | 85 | 1.91 | 0 | 34 (min 0.294) | 1 | 0.65 / 0.325 s | 0 / 3 / 5 / 21 / 56 | 0.84 |

These specs predate the event-first authoring workflow. By their own headers,
Luna and Amor use the beat grid as the backbone of their main section.

### Near-duplicates

- **Each panel is one spec per song.** The 24 cells are 4 seeds plus 2
  perturbations of each.
- **Seeds give distinct tracks.** All 4 authored seeds per song gave distinct
  track hashes in 4 stored runs. The October 3 claim that seeds reproduce
  identical tracks no longer holds, but seeds only vary the arrangement, not
  the musical material.
- **Perturbations change little.** One shifts 45–65 of 75–85 landings by
  exactly one frame (25 ms) and changes asks by at most 0.05 (mean 0.023).
  The material is the same.
- **The confirm panel is the same four specs.** It uses fresh seeds and
  perturbations 3–4, so it confirms seed robustness, not generality.
- **One song dominates the loss.** Amour carries 59–64% of the sum of
  per-song v3 loss in two dev runs. It is also the only song with sub-0.35 s
  gaps.

### Pattern coverage

| pattern (auditor's definitions; see the JSON) | dev/confirm panel | held-out (categories) | V4 training catalog (176 specs) |
|---|---|---|---|
| Short audible pairs (≤ 0.35 s, both asks ≥ 0.25) at speed | Amour only, all 0.29–0.35 s | all three; under 0.25 s in two | 68 specs |
| Gaps under 0.25 s | none (perturbed minimum 0.244) | some or many in two of three | 31 specs, mostly the `*_frontier` groups |
| Voice-led close words (runs of ≥ 4 within 0.4 s, light clear asks) | Amour has 8 runs, but of strong asks (mean 0.80); light asks of 0.2–0.35 appear only on Luna's 0.55 s grid (25 of 315) | all; many in `pairs4` | 25 specs |
| Long floats (≥ 1.2 s) in calm moments | 4 gaps in total, none with an air ask ≥ 0.7 | all | 95 specs |
| Intense dense sections | Amour (12 window-seconds) | `pairs4` | 23 specs |
| Drops and re-entries after a break | Amor 2, Amour 2 | all | 82 specs |
| Long songs (≥ 70 s) | none (44–48 s) | Circus | 9 specs |
| Irregular timing (gap CV; share of the 3 most common gap lengths) | CV 0.22–0.40; share 64–92% | CV 0.3–0.6 and above; share 40–70% | — |

**Durations.** They are consistent on the eval panel (44–48 s), and duration
weighting is not the problem there. They vary in V6 (44–81 s) and in V4
(42–97 s).

**What is over-weighted:** steady 0.43–0.65 s grooves with mid-to-strong asks,
in four near-copies per spec.

**What is missing:** sub-0.29 s pairs, light word runs, high-air floats,
irregular timing, and long rides.

## 3. What it rewards

### How a cell is scored

- **Complete:** the ride survives and every beat is matched within ±4 frames.
- **v3 loss:** strength error², timing error², extras (strength²) and missing
  beats (1 each), all per beat.
- **Other rows:** air/speed/amplitude rms from the frozen V6 judge axes, guard
  rows, and the older accounts.
- **Aggregation:** cells are averaged per song, then bootstrapped over the 4
  songs. No row is a headline; each change states its rule in advance.

### Findings

1. **Completion cannot move.** 957 of 962 stored cells are complete. A change
   that hurts quick re-landings can pass. A change that rescues them earns
   nothing.
2. **Quality mixes in completion.** The summary does not exclude incomplete
   cells, and missing beats enter v3 loss at 1/m each. CLAUDE.md asks for
   these to be reported separately.
3. **The intervals have false positives.** With 4 songs, an interval excludes
   zero whenever all four paired differences share a sign. In simulation, a
   null metric excludes zero 18.8% of the time (normal) and 20.8% (heavy-tailed).
   At 8 units this falls to 11–12%, at 12 units to 9–10%. With 74 rows per
   report, several "significant" rows per comparison are expected by chance.
   For example, step 2 of the October 30 binding-stop work was rejected on two
   such rows that had the opposite sign elsewhere. This is consistent with
   noise; it does not show the rejection was wrong.
4. **The main ruler is mostly unvalidated.** v3 loss is 70% strength error,
   18% timing and 12% extras on the authored panel
   (`measure-step-back-20261031.md`). Only ordering of clearly different hits
   is validated. The owner does not see differences under about 1.5×, and
   "same" was his answer on 10 of 16 random strong pairs.
5. **Per-beat averaging dilutes patterns.** A spec's few pair beats barely
   move its loss unless the ride fails. And because of finding 1, rides do
   not fail on this panel.
6. **What the owner values is largely unmeasured.** From
   `docs/music-authoring.md` and REWORK:
   - pairs that read as two hits;
   - floats in calm and speed in intense passages;
   - no follow-up upper hit;
   - landings only on audible sounds.

   Upright strong arrivals are measured (a guard row). Extras are measured but
   undercounted (`unwanted-impacts-20261030.md`). "Score does not predict
   taste": the best-scoring Trouble variant was the least liked.

**Can a worse compiler look better?** Yes, both ways:
- **A false win.** Spending search on strength polish at the 0.55 s groove
  lowers panel loss and leaves completion at 24/24. Recovery for quick
  re-landings can get worse unseen.
- **A false loss.** Making 0.2–0.3 s pairs feasible, for example by accepting
  an upper hit and then a bottom hit, can add v3 opposite-push extras and
  strength error on the panel, while being what the owner asked for.
- **V6.** It is inversely related to measured hit clarity (REWORK, "Why").

## 4. Proposal

### Keep, change, add, remove

| layer | action |
|---|---|
| parity, parity:judge | keep; add 3–4 production-path cells (`productions/*/spec.ts`, `creative: {}`, strike3) with the owner's OK |
| V6 sentinel, `benchmark/v3`–`v5` | keep frozen, run at delivery boundaries only; retire with `landing` mode |
| eval dev/confirm | keep runnable, unchanged, as `legacy-dev`/`legacy-confirm` for history; stop using them alone for decisions |
| eval, new | add a `patterns` panel (below) and a `sealed` panel; the tool needs per-case `variant` and a pattern tag |
| eval summary/report | completion first; quality only on cells complete in both arms; per-pattern rows; per-spec sign counts instead of a 4-song bootstrap |
| training-catalog audit | keep as an optional, labelled robustness run; commit its runner if used again |
| held-out songs | an `--panel=heldout` that runs only on an explicit decision, is logged, and never used for tuning |
| dead fields and terms | drop `select.json` `floors`/`budget` (structural); stop using "golden", "suite" and "handout" |

### The new panel

Specs are variants on the four panel songs (`productions/<song>/variants/dev-*.ts`).
`spec.ts` stays the current production spec, so the legacy panel is unchanged.

| stratum | specs | seeds (dev) | compiles |
|---|---|---|---|
| G ordinary groove (the 4 existing specs) | 4 | 2 | 8 |
| P1 short audible pairs at speed | 2 | 3 | 6 |
| P2 voice-led close words, long rides on held notes | 2 | 3 | 6 |
| P3 calm floats, soft opening, float into a slam | 2 | 3 | 6 |
| P4 intense dense section at speed (≥ 8 s sustained) | 2 | 3 | 6 |
| P5 stop-and-go: breaks, drops, re-entries | 2 | 3 | 6 |
| P6 long ride (75–90 s), a full mixed reading | 1 | 3 | 3 |
| **total** | **15** | | **41** |

- **Weight.** Each stratum counts once in any summary. Within a stratum,
  each spec counts equally, and seeds are averaged. Specs within 40–50 s,
  except P6, so that weight comes from the number of specs, not from length.
- **Pattern windows.** Each spec declares the time windows of its pattern.
  The report gives rulers inside the windows as well as over the whole ride.
- **Completion first.** Per stratum, report complete rides out of compiles,
  paired lists of recovered and lost spec×seed cells, and the fraction of
  beats reached on incomplete rides. The last gives a graded signal where
  completion is 0 of N.
- **Quality second.** Only on cells complete in both arms, per stratum, under
  every ruler.
- **Units.** 15 specs on 4 songs. Report per-spec and per-song sign counts
  with their n, and do not present a 4-unit bootstrap as an interval.
- **Seeds at decisions.** Completion rates need more seeds: 3 of 6 against
  0 of 6 is not conclusive (Fisher p ≈ 0.18). For a P1/P2 completion claim,
  rerun those strata at 8 seeds per spec.
- **Cost.** At HEAD, one compile took 53–60 s wall and 73–80 s CPU for a
  44–48 s song (4 concurrent, seed 101). 41 compiles, with P6 at about twice
  the cost, is about 1 CPU-hour, roughly 6–10 min wall at 24 jobs. Today's
  dev + confirm is 48 compiles, so the cost is about the same.

### Confirmation

- **Fresh seeds** on the same 15 specs.
- **A sealed sibling per stratum** (6 specs). They are authored with the dev
  specs, frozen by hash, and never compiled until a candidate is adopted.
- **The held-out songs** at major boundaries only.

### Dev specs to write (by Claude, event-first)

Each spec uses the `docs/music-authoring.md` workflow on the panel song:
stems, ADTOF, `events.json`, `sung.py`, `music.ts` layers. Every landing is a
measured, audible event. The pattern's parameters come from the music and the
category definitions, never from the held-out specs. Whether each song
actually contains each pattern is **unverified** until its stems are read; if
the music does not offer a pattern, move it to another song rather than
inventing landings.

| spec | stratum | what it stresses, in this song (from its spec header) |
|---|---|---|
| `amour_de_ma_vie_44s/dev-pairs` | P1 | the dense, strong song: kick–snare or pickup–kick doublets at 0.2–0.33 s, at high speed |
| `tiki_tiki_48s/dev-pairs` | P1 | post-drop groove pickups before heavy hits, if audible in stems |
| `luna_bala_44s/dev-words` | P2 | the voice-only intro (0–8.6 s) by words, then the voice by phrases where it leads |
| `amour_de_ma_vie_44s/dev-words` | P2 | the vocal line by words, light clear hits (0.2–0.35), long rides on held notes |
| `tiki_tiki_48s/dev-calm` | P3 | the quiet intro and sparse layer as floats into the 10.4 s drop slam |
| `amor_na_praia_46s/dev-calm` | P3 | the beatless intro and the 7.9–9.1 s breath, floating into the 9.1 s drop |
| `amour_de_ma_vie_44s/dev-intense` | P4 | every audible hit in its densest stretch, with speed high |
| `luna_bala_44s/dev-intense` | P4 | the body with audible off-beats added (drum stem), if they are heard |
| `amor_na_praia_46s/dev-restart` | P5 | the off-grid burst, the breath, the drop, the 26.3 s hole and re-drop |
| `luna_bala_44s/dev-breakdown` | P5 | the drop at 8.6 s, the syncopated 36–38 s breakdown, the collapse into silence |
| `amour_de_ma_vie_90s/dev-long` (new excerpt) | P6 | a 75–90 s excerpt (the full 334 s recording is local) read event-first |
| sealed: one more per stratum, on a different song where possible | P1–P6 | the same categories |

**Owner review.** Before freezing, the owner listens to each spec with
clicks in the spec dashboard, about 1–2 min per spec: are these landings
audible and musical? He does not judge the rides. Freeze each spec's hash in
the panel definition before compiling any of them, and keep failing specs as
targets.

### Migration

1. **Add, don't replace.** Add the new panels, variant support and the
   completion-first report with a new evaluator identity. Old runs stay
   loadable under their own plans.
2. **Baseline both.** At one commit, run the legacy dev/confirm panels and the
   new panel.
3. **Report both for a while.** For the next few adopted changes, report the
   legacy panels next to the new one, so every result links to the
   October history.
4. **Then make it the default.** Once the owner agrees, `patterns` becomes
   the decision panel and the legacy panels become history. V6 and parity are
   unaffected.

### Risks

- **Overfitting to 15 specs.** Mitigated by the sealed siblings, fresh seeds
  and the held-out songs. Expect drift anyway; consider re-authoring
  strata yearly.
- **Leaking the held-out songs.** Claude wrote the held-out specs, and the
  categories came from them. Keep the categories coarse, take every time from
  the panel songs' events, and record each landing's source event. Do not
  tune the new specs to the held-out histograms.
- **Unmusical forcing.** A panel song may not contain a pattern; forcing
  landings breaks "land only on sounds you can hear".
- **Measures.** Per-pattern rulers, such as pair legibility, are diagnostics
  until the owner's blind pairs validate them. v3's strength scale remains
  unvalidated.
- **Cost and time.** The authoring workflow per song (Demucs, ADTOF, reading)
  plus about 20–30 min of owner listening. A failing frontier spec spends its
  full budget.
- **Small n.** Completion differences on 6 cells per stratum are only
  indicative.

## Not verified

- Whether each panel song contains each pattern (needs stems and events).
- Current parity and sentinel run times (taken from REWORK and WORKING, not
  re-run).
- Compile time of a ≥ 70 s spec at HEAD (no long spec compiled here).
- Held-out completion figures, taken from `docs/music-authoring.md`.
- Pattern thresholds, which are the auditor's, not the owner's.
- Whether full recordings of Luna, Amor and Tiki exist anywhere (only
  Amour's was found).
- How much the V6-era learned policies (landing/v1/v2) saw the panel songs.
  ARCHITECTURE states that the v3 models exclude them.
