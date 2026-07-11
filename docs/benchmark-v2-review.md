# Benchmark V2 — Purpose, Assessment, and Target Design

Date: 2026-07-11. Status: **draft RFC** — it becomes the implementation
contract only after the studies are hardened and certified against the
independent reference (Part D, steps 1–2) and that milestone is explicitly
approved. **Parts 0 and C describe the target — what the system
should be. Part A describes what exists today. Part B is the measured
evidence, Part D the path from A to C, Part E the register.** Every
load-bearing number comes from a study artifact in `benchmark/v2/studies/`
with a deterministic reproducing script in `scripts/benchmark/`; hardening
these studies to the full retained-evidence standard and adopting the menu
into the guard is Part D work (steps 2 and 5).

---

## Part 0 — Purpose and usage model (target)

### 0.1 What this is for

Compiler development is driven entirely by this instrument. It answers two
questions with calibrated statistics rather than vibes:

- **Improvement**: "is this change really better by at least θ points?"
- **Simplification**: "does removing this cost at most m points?" (margin m
  declared before any result, always)

Both get accept / reject / inconclusive with calibrated error rates (0.4
states exactly what calibration does and does not promise). The suite is
a frozen, deliberately weighted catalog of what the compiler should do —
including capability cases that do not work yet.

**The working principle**: never spend compute a cheaper stage could have
saved — but always end with evidence you can trust. Everything in the
workflow (the cached first look, waves, futility stops, resolvability
advice) is a mechanism serving that principle. The principle is fixed; any
mechanism can be replaced if analysis shows a better one.

### 0.2 One chain, with early exits

There are not two workflows. There is one command — evaluate this candidate
— that escalates compute only while it stays worth it:

```
bench eval                      # stage 0 only: ~1 min, informational
bench eval --to-verdict [...]   # continue into the formal confirmation
```

- **Stage 0 — cached look** (~1 min, 252 candidate compiles on fixed dev
  seeds against the stored baseline reference): delta, case movers, realized
  pairing, and the advice line — "resolving this at the declared operating
  point would take ~N minutes / is below the futility boundary / is too
  small to resolve at any certified depth." Exit here while exploring; run
  again after every edit — fixed seeds make successive edits directly
  comparable.
- **Confirmation** (`--to-verdict`): declare the operating point (0.3),
  allocate a fresh never-reused seed epoch, run both compiler snapshots in
  ~1-minute waves, checking futility at looks k ∈ {2,3,4,8,16} — clearly
  failing candidates die within minutes; the rest run to the declared depth
  and get the verdict, the evidence, and the exact next command.
- **On accept**: `bench rebaseline` (minutes — the accepted evidence becomes
  the era's record; no re-runs, no new listening review unless the suite
  changed).

Stage 0 never binds; only confirmation waves count as evidence. Choosing the
operating point after seeing stage 0 is fine — predeclaration protects the
*confirmation draw*, which does not exist yet.

**Status today** (Part A): the chain exists as four separate commands with
different flags (`probe` + `decide` for stage 0, `canonical` + `decide` for
confirmation at a fixed depth 8, a heavy `baseline` for promotion), a
one-shot promotion slot, and no waves, futility, or depth choice.

### 0.3 The dials

The **operating point** is declared per attempt, before any confirmation
evidence, and recorded immutably:

| Dial | Values | Notes |
|---|---|---|
| mode | improve / simplify | the question |
| θ (improve) | usually 0 | accept = "really better than θ" |
| m (simplify) | certified menu (C.3) | declared before results |
| depth D | menu rows 32 / 64 / 128 seeds/budget (provisional until guard adoption, C.3) | MDE ≈ 4.4 / 2.8 / 1.9 pts |
| α | 0.01, fixed | changing it is a recalibration event |
| futility | default looks k ∈ {2,3,4,8,16} | early exit on clear failure |

The point evolves with the compiler: coarse early (big wins at depth 32),
finer later (+2..+3 at 64–128; margins tightening 5 → 2). Every choice in
force is recorded in the operating-point history.

### 0.4 The reliance contract

**Enforced by machinery**: calibrated error rates (every offered operating
point is certified by guard-enforced studies on realistically resampled real
data; the guard recomputes every rate from integer counts — and calibration
is empirical: the rates hold under those resampling models within their
Wilson bounds, not as universal guarantees against model misspecification or
future compiler drift, which makes the era α-budget a conservative
calibrated exposure measure rather than an absolute bound); comparability
(incomparable archives refuse to compare — hard fingerprint gates);
integrity (scores recomputed from raw reports at decision time, checksums,
worker failures disqualify); determinism (decision-relevant scores
reproduce on the checked subset; full-output hash check pending, D step 2);
anti-adaptivity (the confirmation epoch is allocated at declaration, never
reused, and both snapshots run fresh after declaration — the judging draw
cannot be tuned against); agent-safety (non-interactive commands, stable
exit codes, machine-readable artifacts with a `nextCommand` field).

**The operator's job**: declare before looking; heed the printed
multiplicity counter (error rates are certified per decision; the running
expected-false-accept sum is visible, and the periodic era audit measures
whether claimed cumulative progress is real — C.2.8); keep the listening
review honest; record intentional compromises.

**Honest limits**: confidence concerns new seeds on the frozen catalog, not
production generalization; effects below the declared MDE usually end
inconclusive (the report says what depth would resolve them); catalog-wide
validity-driven progress has very low formal power but is surfaced in its
own report line; the five qualification references are monitors, never
evidence.

### 0.5 Vocabulary

**Seed block** — one seed shared by every case at one budget; the unit of
inference. **Epoch** — the fresh seed range allocated to one attempt;
ledgered, never reused. **Wave** — one more seed per budget on both arms
(252 compiles ≈ 1 min); after wave k the run has depth k. **Depth D** —
seeds per budget at the final analysis. **Era** — the life of one baseline.
**Operating point** — the declared (mode, θ/m, α, D, futility schedule).

---

## Part A — What exists today

### A.1 In one paragraph

A frozen catalog of 42 development cases (21 authored normative + 21
deterministic variants, as parents in coverage groups in 4 weighted strata)
plus 5 qualification monitors. Scores aggregate as shifted geometric means
(seeds → case → parent → group) and arithmetic weights (groups → stratum →
budget → headline). Two profiles: probe (2 budgets × 3 seeds, 252 compiles,
~58 s at 48 workers) and canonical (3 budgets × 8 seeds × two paired
snapshots + 120 qualification compiles = 2,136, ~10–15 min). Decisions: a
paired catalog-wide seed-block jackknife with Welch–Satterthwaite Student-t
bounds, stress-calibrated on zero-inflated resampled real data; improvement
tests δ > 0, simplification tests non-inferiority against a predeclared
margin. Governance: fingerprints, a one-shot confirmation slot, a seed
ledger, a human listening review, a calibration guard.

### A.2 Verified sound

- **Statistics core** (`decision_model.ts:537-605`): correct delete-1 paired
  block jackknife and Welch–Satterthwaite dof; t/normal/beta functions
  checked against an external oracle to 6+ digits during this review (no
  in-repo fixture yet — E.1 #10); the two independent headline
  implementations cross-check at decide time (`decide.ts:179`).
- **Block design**: the catalog-wide seed block is the right conservative
  unit; the `correlatedSeedAdversary` control proves independent-cell
  resampling would wrongly accept a shared-seed confounder.
- **Seeds/epochs**: per-budget-disjoint schedules; probe/canonical
  disjointness asserted at validation and re-asserted on archives at freeze;
  epochs fresh (≥1e6), never reused (`confirmation.ts:461-472`).
- **Integrity**: stored scores recomputed from raw reports at decide time;
  worker-failure archives ineligible everywhere; snapshot replay scrubs the
  compiler-source boundary (governance-tested); checkpoint resume refuses a
  changed plan, latest success wins.
- **Determinism**: an 84-run subset of the retained reference reproduced
  with identical stored scores (B.2; full-output track-hash equality is a
  cheap pending check — D step 2).
- **Calibration guard**: recomputes every rate/Wilson interval from integer
  counts; outcome counts must partition trials; the numeric bars live in
  `decision-policy.ts`, inside the hashed inference set.
- **Estimand honesty**: seed-confidence on the frozen catalog only;
  bootstraps labeled sensitivity, never posterior; the 99% critical is
  stated in output and docs. All 21+ benchmark tests pass.

### A.3 Governance, accurately

`baseline.json` freezes the compiler snapshot, suite fingerprint, and (v8)
the decision-code and calibration fingerprints. `confirmation-state.json`
holds one attempt slot per baseline: any outcome consumes it; rebaseline is
allowed only after `accept` for the exact current candidate or a suite
change (`confirmation.ts:82-100`). The contract binds the broad 12-file
`DECISION_SOURCE_FILES` (`suite_model.ts:108-121`) — including
`runner-compatibility.json`, whose purpose is to tolerate operational runner
changes — so editing any of them stales the calibration and then mismatches
the baseline. There is no migration command; the contract was migrated once
(`…decision-contract-r2`, unchanged archives) by hand-assembled bundle
surgery bypassing the transition gate. Both canonical arms run on one shared
fresh epoch — pairing is captured and the confirmation draw does not exist
at development time; the target keeps both properties. Depth is frozen into
the suite fingerprint itself (`seeds_per_budget: 8` inside the hashed
manifest) and the decision path hard-requires full scope
(`decision_model.ts:378`): there is no per-attempt depth and no
partial-depth inference — the target requires building both (C.3).

---

## Part B — Measured evidence

| Study | Script | Artifact |
|---|---|---|
| Seed structure | `scripts/benchmark/study_seed_structure.ts` | `benchmark/v2/studies/seed-structure.json` |
| Pairing | `scripts/benchmark/study_pairing.ts` | `benchmark/v2/studies/pairing.json` |
| Power grid | `scripts/benchmark/study_power_grid.ts` | `benchmark/v2/studies/power-grid.json` |
| Probe & futility | `scripts/benchmark/study_probe_coverage.ts` | `benchmark/v2/studies/probe-futility.json` |

### B.1 No detectable common seed shock across cases

Mean pairwise correlation between cases' per-seed scores is zero at every
budget (|r| ≤ 0.011; 630–820 pairs; both archives), and the catalog-mean
variance is not distinguishable from the independent-noise prediction at
this precision (ratios 0.34–1.46 on 8–12 seeds). This rules out any large
common seed effect; it cannot prove exact independence. **Therefore**: seeds
behave as a cheap per-compile power lever on par with cases/variants (which
additionally buy representativeness but cost authoring and review) — and
nothing downstream depends on an independence assumption: the menu rests on
the grid's directly measured cells (B.3), not on a scaling law. The
aggregation nonlinearity — not seed correlation — amplifies headline
variance (1.4–2.4× the plain mean's spread, by budget).

### B.2 Pairing benefit tracks the fraction of compiles a candidate perturbs

Compiles reproduce deterministically (identical stored scores on the 84-run
pre-check subset), so shared-seed comparison is exactly paired. Across three
measured candidates (perturbed compiles keep residual r ≈ 0–0.2):

| Candidate | Score-identical runs | Var(Δ)/[Var(b)+Var(c)] | Headline Δ |
|---|---:|---:|---:|
| Small (`LR_IMPACT_LOCAL_W` +10%) | 99.6% | 0.0002–0.0055 | +0.02..+0.10 |
| Broad (`LR_M75_OBJECTIVE_READINESS_POWER=1.1`) | 0% | 0.78–0.83 | +0.8..+10.2 |
| Invasive (`LR_QUALITY_NCAND=1`) | 0% | ≈1.07 (3-seed noise) | −140..−154 |

("Score-identical" is what the study compares; track-hash equality is the
pending stronger check, D step 2.) **Therefore**: realized resolution is
candidate-dependent and observable (identical-pair fraction, interim SE) —
small-perturbation candidates resolve far below the worst-case envelope; a
frozen baseline reused across attempts would be equally paired at half the
compute (declined for adaptivity reasons, C.1); ~20-second reproduction spot
checks are available whenever environment drift is in question.

### B.3 The power grid

Empirical resampled-block DGP (real raw reports, zero-inflation included),
36,800 simulated decisions, outcomes matching the frozen policy code on all
36,800, run on two disjoint RNG streams that agree within Monte-Carlo noise
(a reproducibility check — not an independent holdout: both streams resample
the same 12 observed seed blocks under the same DGP, so validating against
the independent compile reference is part of certification, D step 2). Accept
rates (%, α=0.01):

| depth\true Δ | 0 | +2 | +3 | +5 | +8 | +12 | MDE(80%) | compiles/arm |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 (today) | 0.6 | 2.3 | 6.5 | 21.0 | 58.6 | 91.0 | 10.6 | 1,008 (~4 min) |
| 16 | 0.6 | 8.3 | 19.6 | 56.3 | 94.9 | 100 | 6.8 | 2,016 (~8 min) |
| 32 | 0.4 | 23.6 | 52.2 | 92.0 | 100 | 100 | 4.4 | 4,032 (~16 min) |
| 64 | 0.7 | 53.0 | 85.7 | 100 | 100 | 100 | 2.8 | 8,064 (~31 min) |
| 128 | 1.0 | 85.0 | 99.3 | 100 | 100 | 100 | 1.9 | 16,128 (~63 min) |

~4.3 compiles/s at 48 workers; a confirmation runs two arms (total 2× the
last column; one wave = 252 compiles ≈ 1 min). **Therefore**: (i) the derate
is load-bearing — α=0.05 would buy one depth tier (MDE 7.4/4.9/3.3/2.2/1.7)
and holds the plain null, but breaches 5% false-accept under zero-inflation
stress (hard-zero 6.5% @ d8, validity flips 5.8% @ d32) while α=0.01 stays
≤2.6%; power comes from depth and pairing, not a looser critical. (ii)
margins are depth-bound — m=5 works from depth 32 (94.2% power / 1.0%
boundary leak), m=2–3 need depth 128, m=1 is beyond the instrument. (iii)
small strides are affordable — +5 at depth 32, +3 at 64, +2 at 128.

### B.4 The probe has low power and no demonstrated enrichment; futility looks dominate for regressions

Probe error rates are nominal (~5% both sides) but its power is tiny:
advance 10.6% at a true +3, 28.1% at +8, 60.1% at +15 — a hard gate on
"advance" would discard most eventual winners. Enrichment was **not
demonstrated**: the two-stage simulation draws probe and canonical
independently at each fixed effect size, so conditional enrichment is zero
by construction there; measuring population-level enrichment would need a
predeclared mixture of candidate effects and pairing structures, and no such
study exists. What is certain: probe compiles never count toward any
decision (probe seeds are disjoint from every epoch by design), so whatever
screening the probe does, interim looks do on compiles that also count.

Futility inside the run: **stop when the interim one-sided upper bound at
α=0.05 falls below the declared threshold**. Winner-kill saturates at 0.99%
by look k=4 and stays flat as looks are added; regression-catching keeps
growing — 30% / 60% / 86% of true −5 regressions stopped by k = 4 / 8 / 16.
Default schedule: k ∈ {2,3,4,8,16} (looks past 4 are free). Menu power
numbers are futility-free; realized ≈ 1 point lower. Estimate-based rules
are not viable (estimate < −4 at k=3 still accepts 8.9% of the time);
stopping true *nulls* early is a priced declared option (estimate < −2 at
k=3: 35% of nulls stopped for 6.3% winner-kill). Cross-check: reproduces the
power grid at the shared cell (d32/+3: 51.4% vs 52.2%).

---

## Part C — Target design

Kept invariants: predeclaration; fresh ledgered epochs, both arms executed
after declaration; guard-certified rules; raw-report rescoring;
worker-failure ineligibility; comparability fingerprints as hard gates.
Removed: the probe verdict, the one-shot lockout, the contract freeze
without a migration path, the over-broad fingerprint binding.

### C.1 A fresh paired epoch per attempt

Every confirmation allocates a fresh ledgered epoch and runs **both**
snapshots on it in isolated worktrees — today's execution model, kept. The
justification is the **unknowable draw** alone (pairing would be equal under
a frozen bank, B.2): the epoch does not exist at development time, so no
process — human or agent with repo read access — can tune a candidate
against the seeds that judge it, and no two attempts share an error
component. The cheap alternative (a frozen depth-128 bank reused as paired
prefixes, plus a small fresh replication tripwire) is declined explicitly: a
committed bank is readable before candidates are written, agents provably
optimize against visible numbers, and a low-depth tripwire detects only
egregious overfitting, after the fact. The premium — one extra arm, ~16–63
min at menu depths — is paid only at confirmation time.

### C.2 `eval` — the chain

One command, fully non-interactive; `--json`; the artifact carries
`nextCommand`. Exit codes are **per mode**: a stage-0 invocation emits only
0 (completed) or 1 (invalid evidence); a `--to-verdict` invocation emits
0 accept, 2 inconclusive, 3 reject, 4 futility-stop, 1 invalid evidence —
automation always knows which contract applies from the flags it passed.

1. **Stage 0 (default)**: 252 candidate compiles on the fixed dev seeds vs
   the stored baseline reference (~1 min). Prints delta, movers, realized
   pairing, and the resolvability advice. Informational only; exit 0 on
   completion (1 on invalid evidence, as everywhere);
   repeatable all day against the same draw.
2. **`--to-verdict`** adds the confirmation. **Declare** (immutable,
   ledgered, before any confirmation compile): candidate fingerprint +
   snapshot, mode, θ or m, α (0.01), depth D, futility schedule. The
   declared row must be **guard-certified** (uncertified refused). The
   default is the **cheapest** certified row for the mode (initially depth
   32); deeper rows are explicit choices, never silent defaults.
3. **Waves**: each adds one seed per budget on both arms (252 compiles
   ≈ 1 min). One depth-D run plan, checkpointed per cell: crashes resume
   with completed cells restored, a changed declaration is refused, a fired
   futility stop is durable.
4. **Interim looks** at each declared k: the same jackknife at depth k (a
   partial-depth inference path — `indexRuns`/`validateArchiveScope`
   parameterized by declared depth; today's code hard-requires full scope
   and must be generalized). Machine-parseable line: interim delta, realized
   SE, identical-pair fraction, bounds. Stop iff UB(α=0.05) < θ (or −m).
5. **Verdict at depth D**: accept iff LB(α=0.01) > θ / −m; reject iff
   UB < it; else inconclusive. The certified inference machinery, unchanged.
6. **Qualification monitor** only after an **accept** (and during era
   audits): running it after every verdict would gradually turn the five
   held-out references into development feedback. The 120-compile sidecar
   runs on acceptance, linked as today, indicative only.
7. **Report**: verdict, delta with bounds, realized SE vs the worst-case
   envelope, per-budget/stratum breakdowns, top movers, the
   capability-stratum validity line, the declared row's MDE, the
   multiplicity counter, artifact path, next command. An inconclusive report
   states, at the point of pain: the certified depth that would likely have
   resolved the observed delta, and that the sanctioned path is an
   acknowledged retry at that depth on a fresh epoch (prior evidence is not
   pooled — the price of independent-error attempts).
8. **Ledger and multiplicity policy**: append (declaration, epoch, archives,
   outcome). New candidates always allowed, each on a fresh epoch;
   same-fingerprint retries require `--acknowledge-retry` and print the
   candidate's compound α. Multiplicity has three distinct layers, and the
   document claims only what each provides. (i) **Within-era control**: a
   capped era α-budget (default 0.05) — each attempt spends its declared
   row's certified **Wilson-upper** null-accept bound (not the point rate);
   the budget resets only on an accept (the era genuinely ends) or a suite
   rollover — **never on a protocol migration or operator transition**, so
   the cap cannot be laundered; exhaustion blocks further attempts until a
   ledgered `--override-era-budget --reason=…`, which extends the budget
   with a recorded reason rather than resetting it. (Online α-investing is
   a viable alternative; the capped budget is chosen for simplicity and era
   alignment.) (ii) **Cross-era exposure** is disclosed, not controlled:
   the permanent ledger accumulates the project-wide expected-false-accept
   sum across eras, printed in every report. (iii) **Retrospective audit**:
   a false accept is not repaired by rebaselining — it persists as claimed
   progress that was noise, an explicitly accepted governance risk kept
   honest by the **era audit**: at each rebaseline (or every N accepts),
   one deep confirmation of the current baseline against the era-start
   snapshot compares measured cumulative delta with the sum of accepted
   deltas. The audit is detection, not error control — it estimates the
   shortfall within its own confidence bounds, cannot attribute it to
   specific decisions (a shortfall may mix false accepts with
   true-but-overestimated effects), and feeds the next operating-point
   choice.

Early *success* stopping and mid-run extension are excluded from v1 — no
retained cell certifies an optional-stopping success boundary. They are the
motivating v2 upgrade (a +8 already accepts 100% by depth 32 and overpays at
64+), certified with the same harness before shipping.

### C.3 Operating points: declared, certified, guard-enforced

A row is **certified** once the guard enforces its grid cell against the
existing policy bars (power Wilson lower ≥ 0.80, false-decision Wilson upper
≤ 0.05). Guard adoption is Part D work (step 5 for depth 32; v2 for deeper
rows), so today every row is **provisional**; `eval --to-verdict` refuses
rows outside the adopted menu once the guard is extended.

Every improve row below tests δ > θ = 0: an accept claims "really better
than zero", never "better by the design target". "Designed to detect X"
states the true effect at which the row has the quoted power. (Rows with
θ > 0 — where the accept itself claims "better by at least X" — are
possible and would be certified from the same grid.)

| Intent | Declaration | Depth | Total cost | Measured performance | Status |
|---|---|---:|---:|---|---|
| Designed to detect +5 (milestone) | improve θ=0 | 32 | ~32 min | 92% at +5, ≤0.4% false-accept | bars met¹ |
| Designed to detect +3 (standard) | improve θ=0 | 64 | ~62 min | 86% at +3, 100% at +5 | needs trials² |
| Designed to detect +2 (fine) | improve θ=0 | 128 | ~2.1 h | 85% at +2, 99% at +3 | needs trials² |
| Ablation, margin 5 | simplify m=5 | 32 | ~32 min | 94% non-inf power, 1% leak | bars met¹ |
| Ablation, margin 3 | simplify m=3 | 128 | ~2.1 h | 100% / 0.7% | needs trials² |
| Ablation, margin 2 | simplify m=2 | 128 | ~2.1 h | 85% / 1.0% | needs trials² |

¹ Meets the numeric bars on today's grid; becomes "certified" when the guard
adopts the menu (D step 5).
² Provisional in the strong sense: at 300 trials the holdout Wilson lower
bounds sit below 0.80 (d64/+3: 78.0%; d128/+2: 74.3%), and deep-depth cells
resample only 12 observed seed blocks. Certification requires more trials
**and** validation against the independent seeds-12–23 compile reference,
which precedes any menu adoption (D step 2) and doubles the empirical block
support. These rows ship in v2.

**Depth must be decoupled from the suite fingerprint** (the main engineering
prerequisite, D step 5): today `seeds_per_budget` is hashed inside the suite
manifest and the decision path requires exactly that scope. Target: the
manifest keeps defaults; declared depth is an execution parameter recorded
in the archive's execution-policy identity; schedule, scope validation,
inference, and the guard's required cells are parameterized by depth.

### C.4 Batch eval for ablation fan-out (screening semantics)

One declaration lists N candidate snapshots and one shared fresh epoch; the
baseline arm runs once, each candidate arm once — (N+1) arms instead of 2N —
each judged by the standard rule. **A batch is a screen, not a promotion
path**: its per-candidate verdicts identify survivors, the artifact states
the family-wise exposure (≤ N·α, plus the shared-baseline-draw correlation),
and promotion always requires an individual confirmation of the survivor on
its own fresh epoch — that individual decision is the only one that binds.
Recommended flow: batch-screen at m=5 / depth 32 (~16 min per extra
candidate), then confirm survivors individually at the fine margin.

### C.5 Governance: bind the semantics, record the rest

- **Two identities, both bound by the baseline.** (1) The **inference
  identity** — today `DECISION_INFERENCE_SOURCE_FILES` (`decision-policy.ts`,
  `decision_model.ts`, `evaluator.ts`, `suite_model.ts`, `score.ts`) — is
  what the calibration and every study stamp: it fixes the mapping from data
  to verdicts, and changing it invalidates the statistical evidence. One
  refinement is required for the separation to hold: `suite_model.ts` mixes
  inference-pure suite logic (manifest model, validation, membership) with
  fingerprint lists and identity machinery, so a governance edit to the file
  would spuriously invalidate the inference identity. The inference-pure
  parts move into a small dedicated module first (D step 3), and the
  inference identity binds that module.
  (2) The **decision-protocol identity** — `decide.ts`, `confirmation.ts`,
  `calibration_guard.ts`, `listening_review.ts`, `runner_compatibility.ts`,
  `runner-compatibility.json`, `freeze_baseline.ts`, `compiler_snapshot.ts`,
  `compiler_identity.ts`, and the CLI dispatch — fixes eligibility, gating,
  snapshot/freezing, and promotion semantics; changing it must not
  invalidate studies, but it must not pass silently either. The baseline
  records both. Runner *execution* is already separately bound (the
  implementation fingerprint, the execution-policy identity, and
  runner-compatibility approvals) and stays that way. Pure CLI/rendering
  churn still moves the protocol identity (file-level hashing); the cost is
  deliberately small — see the next bullet. Comparability fingerprints stay
  hard gates.
- **A migration command with three scopes.** *Protocol scope* (the
  protocol-identity files): requires the governance and decision conformance
  suites to pass, an explicit `--approve --reason=…`, and writes a
  machine-readable migration record (old/new fingerprints, changed file
  list, reason, operator) before re-stamping the era's protocol fingerprint
  — no study regeneration, but an audited, deliberately authorized record
  that promotion semantics changed, never a silent pass. *Calibration scope*
  (the calibration artifact regenerated, same inference code): regenerate
  calibration → guard-verify → re-stamp. *Inference scope* (the 5 inference
  files): regenerate the coverage study **first**, then calibration, then
  re-stamp — a rule change re-earning its certification, and the report says
  so. **Scope is determined by behavior, not only by file**: the file lists
  set the minimum scope, and any change that can affect evidence selection,
  stopping, retries, eligibility, or verdict probability escalates to
  inference scope (full recalibration) regardless of which file it lives in.
  The migration record therefore includes a behavioral assessment ("alters
  decision behavior: yes/no, why"), and the conformance suite replays fixture
  attempts and compares verdicts to catch unattested behavioral drift. Any
  scope only with no attempt in flight; ledgered.
- **Rebaseline is light.** Under fresh-paired attempts the baseline archive
  is never comparison evidence — only the snapshot is. `baseline.json`
  shrinks to: snapshot of record, dev-screen reference (one 252-compile run
  with the new compiler), contract fingerprints, and the accepting
  confirmation's archives as the era's record. Same-suite rebaseline: no new
  listening review, no canonical re-run, minutes. Allowed after an accept,
  via the migration command, or by an explicit ledgered
  `transition --reason=…`. The one-shot slot and its transition gate are
  retired.
- **Suite changes are era rollovers, honestly**: updated listening review
  (human gate), a fresh grid compile reference (1,512 compiles — the
  resampled-block DGP is a compile archive, so grid re-certification after a
  catalog change is *not* simulation-only), coverage + calibration
  regeneration, menu re-certification, new baseline. Hours plus a human
  step, by design; the tooling sequences it as one guided path.

### C.6 Reporting and documentation

Every command ends with the exact next command. One flag vocabulary. Wave
lines during confirmation, compact verdict block, machine artifact. Docs
consolidate to one entry point (`HOW_TO_WORK.md`) with the chain stated
once; generated docs carry a banner; the operating-point history is an
append-only section of the baseline doc; V1 leftovers bannered or removed.

---

## Part D — Migration plan

v1 is the smallest workflow that changes daily practice; everything else in
Part C remains the design target and ships only after v1 has real usage
evidence. Ordered so the system stays operational and no step forces the
manual re-freeze the plan retires.

1. **Identity-neutral fixes** (no fingerprint moves): `sync_catalog --check`
   (check-only — regeneration would move the suite fingerprint); doc fixes;
   in-repo jackknife/Wilson fixture tests.
2. **Evidence hardening + independent reference**: harden the four studies
   to the retained-evidence standard (sidecar/scope/rescoring checks in
   `study_pairing.ts`, compressed retained arms, volatile fields out of
   artifact identity, track-hash comparison); compile the independent
   seeds-12–23 reference (1,512 compiles) and re-validate the depth-32
   cells against it — the prerequisite for any menu adoption, and the
   milestone whose explicit approval turns this RFC into the implementation
   contract.
3. **Two-identity contract + migration command with behavioral escalation**
   (C.5), preceded by extracting the inference-pure suite logic into its own
   module so the inference identity binds it rather than all of
   `suite_model.ts`. Bootstrap: implement the command, then use it to adopt
   its own contract change (one coverage-study regeneration — the extraction
   touches the inference set).
4. **Decision-surface ergonomics + runner fixes** (one protocol-scope
   re-stamp plus one reviewed runner-compatibility record proving unchanged
   successful outputs — `runner.ts` is in the implementation fingerprint,
   `suite_model.ts:92`): next-command prints, `--mode` unification,
   `centralLevel` rename, exit-code contract, inconclusive hint; `runner.ts`
   error-path `terminate()`, failed-archive marking, default-out collision.
5. **`eval` v1**: stage 0 (informational) + waves + the calibrated futility
   schedule + partial-depth inference + depth decoupling, certifying **one
   confirmation point: depth 32, improve θ=0 and simplify m=5**;
   qualification only on accept; ledger + era α-budget; light rebaseline;
   retire the probe verdict and the one-shot slot.
6. **Docs pass** (C.6).

**Deferred to v2** (designed in Part C, gated on v1 usage evidence and the
independent-reference validation): depths 64/128 and margins 2–3 (their
grid cells need more trials and the doubled block support), batch eval
(C.4), era audits, retry-accounting refinements, early-success stopping.

Suite-semantic items (they move the suite fingerprint) are batched with the
next intentional suite change: preroll default unification (E.1 #13), any
`compat/*` regeneration, listening-review signal fixes (E.1 #9).

---

## Part E — Register

### E.1 Defects to fix

| # | Where | Class | Finding | Step |
|---|---|---|---|---|
| 1 | `runner.ts:554-565` | bug | Worker error path releases the pool slot without `terminate()`. | D step 4 |
| 2 | `runner.ts:364-371` | bug | Archive written before the worker-failure gate; failed probe looks complete on disk. | D step 4 |
| 3 | `runner.ts:733-735` | footgun | Concurrent probes share the default `--out`/checkpoint. | D step 4 |
| 4 | `confirmation.ts:461` | latent | Epoch disjointness from probe/calibration seeds rests on the 1e6 floor convention; unasserted. | D step 5 |
| 5 | `decision_model.ts:596` | polish | `centralLevel: 0.95` mislabels the adjacent 99%-critical bounds. | D step 4 |
| 6 | `cli.ts:35`, `benchmark-v2-decisions.md:93` | doc/code | Canonical prints only three unlabeled inner-runner `archive:` lines — no labeled handoff or next command; the doc claims it prints the attempt id and path. | D step 4 |
| 7 | `confirmation.ts:180` vs `decide.ts:228` | ergonomics | `--decision-mode=` vs `--mode=`. | D step 4 |
| 8 | `sync_catalog.ts` | process | No regeneration-equality check for `compat/*.json`. | D step 1 |
| 9 | listening evidence | signal | 9/21 variants byte-identical click audio → no listening signal; single self-attestation. | rollover |
| 10 | tests | coverage | No in-repo numeric fixture for jackknife SE / WS dof / Wilson. | D step 1 |
| 11 | `TOOLING_NOTES.md:84`, `screen.ts` | staleness | `npm run screen` gone; `screen.ts` orphaned. | D step 1 |
| 12 | `benchmark-v2-resources.md` | doc | No wall-clock row for the 2,136-compile confirmation. | D step 1 |
| 13 | `score_model.ts:121` vs `case.ts:113-116` | inconsistency | Preroll default differs by case kind — suite-semantic. | rollover |
| 14 | `policy.ts:51-52` | stale comment | Canonical seeds are 0–23, not "the studied 0..11 range" — `policy.ts` is suite-fingerprinted, so even a comment edit is a rollover event. | rollover |
| 15 | `README.md:27` | trivial | Hardcoded foreign path. | D step 1 |

### E.2 Design debt superseded by Part C

| Where | Was | Superseded by |
|---|---|---|
| `confirmation.ts:82-100` | One-shot slot: any non-accept locks promotion for the suite. | C.2.8 ledger + C.5 light rebaseline. |
| `suite_model.ts:108-121`, `freeze_baseline.ts:83,105` | Broad 12-file contract binding; migration only by manual bundle surgery (done once: `decision-contract-r2`). | C.5 two-identity binding + migration command. |
| probe policy | Verdict framing invites gate use; low power, no demonstrated enrichment, throwaway compiles (B.4). | C.2 stage 0 + futility looks. |
| `decide.ts:160,196` | `--base` impossible on canonical archives; consumed decisions non-replayable. | C.2.8 ledger semantics. |
| `study_decision_coverage.ts:280-285` | Shared-seed zero-variance simplification scenario models no real candidate. | B.3 unpaired cells. |
| suite manifest `seeds_per_budget` | Depth frozen into the suite fingerprint; no per-attempt depth or partial-depth inference. | C.3 depth decoupling (D step 5). |
