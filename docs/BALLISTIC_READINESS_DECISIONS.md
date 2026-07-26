# Ballistic / readiness — decisions, model, and settled evidence

Status: **decision record**. The normative interface spec is
[`BALLISTIC_READINESS_CONTRACT.md`](BALLISTIC_READINESS_CONTRACT.md); this
document records *why* it says what it says, what was measured, what was
argued, and what was falsified.

It exists because this area was re-derived from scratch several times, each
time re-litigating the same questions. Read this before proposing a change to
arc generation, candidate cost, the ballistic layer, or readiness.

---

## 1. The model

**A gap runs impact to impact.** `sliceTimeline` (`core/substrate.ts:373`)
produces `gap[i] = [C(i-1), C(i)]`, inclusive at both ends, and consecutive
gaps SHARE their contact frame.

**An arc placed at contact `C` owns exactly three things:**

1. the **impact at `C`** — its own contact;
2. its own **line lengths** (the `grain` axis);
3. the **entire ride from `C` to the next impact** — the arc itself, then the
   exit, then the free flight, all of which is one gap.

**It does not own the interval ENDING at `C`.** That interval's air, speed,
elevation and amplitude were produced by the *previous* arc. This arc can
influence only its final frame or two.

Therefore: **the generator must optimise the gap the arc opens, plus the impact
it delivers.** Anything that aims this arc at the interval ending at its
contact is pointing it at a target it has no lever on.

### 1.1 The terminology trap

The single largest source of confusion in this area:

> In code the arc sits at `gap[i].endFrame` and owns `gap[i+1]`.

So "the current gap" means opposite things depending on who is speaking. When
discussing a *generator*, "current gap" means **the gap the arc opens**. When
reading `gap.targets` inside `evaluateGapFit`, it means the gap ENDING at the
contact. Always say which.

`composeArcProposalTargets` (`optimizer/arc_proposal.ts`) implements the
ownership split and is **correct as written**:

```
impact, grain          <- gap ending at C   ... the arc's own contact and lines
air, speed, elev, amp  <- gap starting at C ... the ride the arc opens
```

---

## 2. Settled decisions, with their evidence

### 2.1 The launch anchor is the confirmed geometric arc exit

The anchor used to be "the last readable airborne frame within four of the
exit, capped by however far the detection window happened to grow". That made
the anchor a sawtooth function of the 4-frame growth schedule — physically
identical candidates got anchors 1–4 frames apart — and the two production call
sites ran different phases of it.

Now: the exit is the first frame that is airborne, past the arc-end plane, and
**still airborne one frame later**; the exit IS the anchor; every acquisition
targets the next authored contact.

**Why one confirming frame and not more, measured not assumed:** across all
202,752 launches in the frozen ballistic corpus (44 canonical V2 cases × 3
seeds), only **12 — 0.0059%** took any collision update strictly after the
anchor, and every one was at exactly anchor+1 on a trailing point (TAIL,
LFOOT/RFOOT). Live production confirms it: `release_exit_reconfirm_broken` is
**0** across 13,876 confirmed exits on 8 cases.

### 2.2 Unauthored axes stay neutral — and this is nearly vacuous

Authoring rates measured over the whole readiness corpus (131,930 contexts):

| axis | incoming gap | outgoing gap |
|---|---:|---:|
| air | 100.0% | 100.0% |
| speed | 100.0% | 100.0% |
| impact | 100.0% | 98.9% |
| amplitude | 25.8% | 25.8% |
| **elevation** | **0%** | **0%** |
| grain | 0% | 0% |

So "unauthored ⇒ neutral, don't aim at a value" has essentially no live case
except elevation, which is authored zero times — `elevationFit = 1` is not an
approximation, it is the only defined value. `grain` is likewise inert; it
matters only as the clean example of an axis belonging to the arc's own
geometry rather than to either interval's motion.

### 2.3 Jitter is zero

`spec.jitter` is hard-enforced to 0 for benchmark documents
(`benchmark_v2/score_model.ts:146`). Verified empirically two ways: replaying
the exact `compileHandoffInternal` target construction over all 44 cases × 3
seeds (12,300 gap rows) gives `gap.targets` **bit-identical** to
`gapAxisTargets`; and 0 of 131,930 corpus contexts show any difference.

Consequence: the `gap.targets` vs `gapAxisTargets` distinction is pure
redundancy on the benchmark. It is a simplification opportunity, not a bug.

### 2.4 Failure policy when no launch can be acquired

Written down in contract §8.4 with four named alternatives, because it was
previously an accident rather than a decision. Current policy: a candidate with
no proposal utility sorts below every candidate that has one, regardless of its
exact cost. Measured mass: 99.33% of acquisitions confirm an exit, 0.06% are
not confirmable in the window, 0.60% are unreadable or acausal.

---

## 3. Pushbacks that changed the outcome

Recorded because each one overturned a conclusion I had already committed to.

### 3.1 "Is the zero ballistic error real, or are we measuring the wrong thing?"

Real. And the reason it looks too good is the reason it is correct:

- the **truth** is a real engine read (`fork.getRider(targetFrame)`, Rust/WASM);
  the **prediction** is `core/ballistic_micro_sim.ts`, independent TypeScript.
  Different code, not a tautology.
- the micro-simulation **is** the engine's airborne solver — Verlet integration,
  six passes over the same 22 constraints, then the three binding joints. With
  no collision to resolve, a faithful reimplementation *must* reproduce the
  engine bit for bit. Zero error certifies faithfulness; it is the expected
  result, not a suspicious one.
- frame alignment was audited separately.

The former 4.53e-02 px was **never model error** — it was contamination from the
old anchor rule capturing states that were not free-flight states.

### 3.2 "Did we reimplement a slow, heavy physics engine?"

Yes, and it is **not cheaper per frame**: 1.92–2.06 µs/frame for the kernel vs
1.47–1.70 µs/frame for the engine on an empty track. A compile can run a
near-complete shadow flight simulation (`river_reentry`: 249,025 kernel frames
against 252,424 engine frames), ~9% of wall clock.

What it bought was **not CPU — it was budget**: the compiler's ration is
denominated in engine frames and the kernel charges none. Plus a counterfactual
the engine cannot answer without a fork.

**CLOSED, and it went the other way** (`673d42f`, 2026-07-25). "Charges no
budget" was not a free lunch, it was an unpriced one: a near-complete shadow
flight simulation ran beside the real one — 31.5% of every frame the compiler
simulated, up to 0.92 unbilled per billed on air-heavy specs — so the budget
axis was not measuring what it claimed to. The default is now an O(1) closed
form at **451 ns per prediction against 19,806**, adopted at 24-seed parity
(headline 494.91 → 494.63, delta −0.28, SE 2.50), with unbilled frames at zero.
The exact kernel survives as the A/B arm behind `LR_BALLISTIC_CLOSED_FORM=0`,
and `CompileStats.ballistic_micro_sim_frames` now reads 0 unless it is selected.

The price, recorded rather than buried: the closed form is a *worse* predictor
(0.58 px against ~1e-5 px) and `frontier_pickup_progression` stalls a little more
often (750k: 3 of 24 against the kernel's 0 of 16), same `terminus:rideStalled`
failure mode in both. That is inside the parity result above.

### 3.3 "Your approach-aim conclusion is wrong"

It was. I claimed `composeArcProposalTargets` had wrongly moved the sampler's
*approach* shaping to the outgoing gap. Wrong on both counts — see §1, and note
that `brakePressure` comparing the arriving speed against the OUTGOING target is
the right question ("how much must this catch brake or carry to deliver the gap
it opens"). Falsified by measurement too; see §5.

### 3.4 The compensation hypothesis

> The old implementation may have worked because several wrong things
> compensated for each other. Correcting part of the chain removed a
> compensation and exposed a deeper issue.

This is the current working frame. Consequence for method: **"what did the old
code do" is a legitimate question, but a legacy-shaped arm is a PROBE, never a
fix.** If restoring an old muddled mechanism recovers the score, that is
evidence about what the correct mechanism must supply — build the principled
version and measure that.

---

## 4. Standing measurements — do not re-derive these

Each row names the ARM it was measured on. The shipped default changed on
2026-07-25 (§3.2), so a kernel-era number is not a statement about production.

| quantity | value | arm | source |
|---|---|---|---|
| ballistic boundary error, **shipped default** | 0.503 px contact position, 0.483 px pre-contact, 0.167° incoming angle, 0.034 px/frame speed | closed form | `generated/analysis/readiness.json`, 2026-07-25 |
| ballistic boundary error, A/B arm | 1.7e-06 px position, 4.5e-06° angle; **exactly 0** for horizons ≥9 frames (128,727 of 202,752 rows) | exact kernel | `generated/analysis/ballistic-v2.json` |
| readiness composite, locked validation | MSE 0.01875, MAE 0.09799, r 0.787, Spearman 0.794, calibration error 0.0746 | closed form | `generated/analysis/readiness.json`, 2026-07-25 |
| readiness composite, superseded | MSE 0.00683, MAE 0.0541, r 0.863 | exact kernel | withdrawn as a production statement |
| catchability | Brier 0.1222, log loss 0.392, AUC 0.898, calibration error 0.0127 | closed form | `generated/analysis/readiness.json` |
| readiness component vs attempt-noise floor | speed 8.7×, impact 5.6×, air 3.6× above the floor | exact kernel | UNREPRODUCED on the closed form |
| **airFit is mostly authored context** | a lookup on targets+durations with **no rider state** scores 0.01228 vs the model's 0.01022 | exact kernel | measured |
| catchability is boundary-informed | boundary-only Brier 0.1702 beats per-case 0.1965; model 0.1235 | exact kernel | measured |
| readiness compiler value | turning it off costs **112 headline points** (493.30 → 381.20) | pre-2026-07-25 | ablation matrix N=3 |
| per-factor value | catchability ≈25, speed ≈13, impact ≈11, air ≈5 | pre-2026-07-25 | same |
| frame accounting | fwd-eval 18–37%, aim probes 16–27%, pool+rest 37–60% | exact kernel — the 31.5% shadow sim is gone, so this split has MOVED | 3-seed archive |
| pool ordering | the three-layer objective orders **98.5%** of candidates; cost decides ~1.5% | pre-2026-07-25 | `LR_AIM_STUDY_STATS=1` |
| **shared future exponent surface** | `futureQualityPower ≠ 1` on **5 of 44** development cases (11.4%) at every budget ≥250k, 0 of 44 at 75k; all five in `representative`. `settledIncomingQualityPower ≠ 1` on 40 of 44. | current tree, 2026-07-26 | `npm run study:objective-powers` |

---

## 5. Falsified — do not retry

Eleven hypotheses have been killed by measurement. Listing them is the point:
each one is an idea that reads well and is wrong, and the cost of re-deriving
any of them is hours.

1. **Approach aim from the incoming gap** — table below.
2. **The deleted catch+8 release fallback** — bail rates are low everywhere.
3. **RMS pooling compressing the projected term** — it is MORE spread on dense.
4. **Truncation** — it rose, and survival failures fell.
5. **Readiness itself** — ablating it makes dense WORSE (34.3 → 29.1), so its
   dominance in the product is earned, not incidental.
6. **The composed aim** — restoring the legacy literal aim recovers nothing.
7. **`cost` scoring the gap the arc did not produce** — a real inconsistency,
   but a wash: the objective orders 98.5% of the pool and forward-eval
   short-circuits cost above 75k.
8. **Per-candidate evaluation cost** ("the rework rides each candidate
   further") — frames per evaluation are FLAT (15.4 vs 15.6 on dense; HEAD is
   cheaper on pickup, 14.8 vs 18.4). HEAD gets MORE looks per frame budget, not
   fewer.
9. **The learned catchability component** — swapping back to the baseline's
   empirical bilinear RATE_GRID over (angle, speed) is decisively worse on every
   spec and seed: `frontier_dense_recovery` stops completing entirely, and
   pickup TTC goes 486k → 986k. This also guts the "the corpus is stale,
   retrain it" lead — whatever the provenance bookkeeping says, the learned
   component beats the hand-fit surface it replaced.
10. **Weighting feasibility in the proposal objective** (`catchability^2`) —
    N=48 delta −25.25 against −15.33. It buys completion exactly as designed
    (lost runs 372 → 298, `frontier_dense_recovery` 8 → 20 of 144 valid,
    capability −164.65 → −117.71) and pays for it in score everywhere else
    (representative +9.93 → −10.29, music −12.61 → −28.83). Over-weighting
    admission makes the search prefer arcs that LAND over arcs that SCORE.
    See §7 for the instrument lesson, which is the more valuable half.
11. **Regrouping the objective by factor role** at neutral exponents — N=48
    delta −29.34 against −15.33, worse than the weighted variant it was meant to
    tidy up. The regrouping is algebraically exact (max relative difference
    8.0e-16 over two million random inputs), so its entire semantic content is
    ~3.6 ulp. Reverted `a7bdf70`. **Do not re-associate `proposalUtility`.**
12. **Down-weighting readiness relative to projected outgoing quality** — the
    accuracy argument in §10. Sweep A measured it across 12 cells and it is
    wrong in SIGN, monotonically. See §10 for the surface and the mechanism.

**Approach aim from the incoming gap** (commit `3aea1b3`, reverted `bd573cf`).
Hypothesis: the sampler's approach shaping should read the incoming gap's
air/speed while the ride-out reads the outgoing gap's. Falsified by argument
(§1, §3.3) and by measurement:

| case | variant | land% | viable% | commits |
|---|---|---:|---:|---:|
| frontier_dense_recovery | baseline | 37.9% | 32.9% | 98 |
| | composed (correct) | 29.8% | 23.8% | 69 |
| | entry-aim | 29.1% | 22.8% | **51** |
| amplitude_tides (control) | baseline | 74.0% | 68.8% | 97 |
| | composed | 73.3% | 68.2% | 97 |
| | entry-aim | 74.2% | 68.9% | 97 |

Headline 491.31 → 487.03, capability −199 → −228.

---

## 6. What the deficit actually is

Every entry above assumed the capability specs could not be compiled. They can.

```
frontier_dense_recovery    first completion   250k   500k   750k
baseline 02c7828                 334k frames    no    yes    yes
HEAD                           1,420k frames    no     no     no
```

HEAD is **4.25× slower to the first complete track**, which drops it below two
of three budget tiers; the stratum scores a non-completing run as invalid, so a
continuous efficiency loss reads as a binary capability cliff.

**The instrument that follows from this** — `first_completion_frame` at a large
fixed budget — is continuous, deterministic per (spec, seed, budget), immune to
CPU contention, and costs ~4 minutes for six numbers. It replaced the benchmark
for iteration and is what produced everything below.

**The loss is cumulative drift, not a wall.** Per-gap landing rate on
`frontier_pickup_progression` at 250k:

| gap band | HEAD | baseline |
|---|---:|---:|
| 0–4 | 44.1 | 45.8 |
| 5–9 | 42.9 | 44.8 |
| 10–19 | 38.6 | 39.9 |
| **20–39** | **28.8** | **41.5** |
| 40+ | 20.3 | 28.7 |

The two agree within ~1.5 points for twenty gaps and then separate. The baseline
holds 41–50% all the way to gap 109 and never decays. There is no single
impassable gap: each committed arc leaves the rider slightly worse placed, and
it compounds with depth. Short specs never accumulate enough drift to show it,
which is exactly why `representative` (+8.69) and `legacy_regression` (+29.59)
are significantly AHEAD at N=48.

---

## 7. The attempted fix, and why it was reverted

**Outcome first: nothing from this section is in the tree.** The objective is
the unsplit `settled^p x projected^q x readiness^q` (contract §8.1). Both arms
below were measured and rejected. The section is kept because the reasoning was
sound and the failure was instructive.

The drift in §6 is an ADMISSION failure, not a grading failure: the search
commits arcs that leave the rider slightly worse placed, and pays for it in
backtracking. The three-layer product could not express that preference,
because `readiness` bundles both kinds of question behind one exponent.

The attempt grouped the factors by the QUESTION they answer rather than by which
model produced them:

```text
proposalUtility =                        <-- REVERTED, a7bdf70. Not the tree.
    settledIncomingQuality ^ 1
  x (projectedOutgoingQuality x speedFit x airFit
     x impactFeasibility x elevationFit) ^ 1
  x catchability ^ 2
```

`catchability` ADMITS the next arc. The other four GRADE it, which is the
question `projectedOutgoingQuality` already asks, so they travel with it. Every
factor appears exactly once and neutral exponents reproduce
`settled x projected x readiness` algebraically.

**What the weighted form bought** (TTC, mean of 3 seeds, 500k, arm vs previous):
`pickup_shifted` 296k vs 2-of-3 seeds never completing; `dense_dialogue_10` 246k
vs 302k; `dense_dialogue` 262k vs 268k; `low_air_endurance_7s` 213k (3/3) vs
2-of-3; and the healthy controls improve 10–14% too — `amplitude_tides` 170k vs
197k, `countercurrent` 194k vs 213k, `high_air_drive` 185k vs 205k,
`loose_pocket` 196k vs 223k. On `pickup_progression` at 1.5M, 330k vs 486k
against a baseline of 342k.

**What it cost, and why the weight was rejected.** `frontier_dense_recovery`,
measured at 3M where both arms can finish: 1557k vs 917k mean frames to first
completion (the 240ms variant went the other way, 3/3 seeds vs 2/3). That was
the visible cost. The decisive one only appeared at N=48: **delta −25.25 against
−15.33**. Completion improved everywhere — lost runs 372 → 298,
`frontier_dense_recovery` 8 → 20 of 144 valid, capability −164.65 → −117.71 —
and score fell everywhere else: representative +9.93 → **−10.29**, music
−12.61 → −28.83, legacy_regression +30.56 → +10.55.

Over-weighting admission makes the search prefer arcs that LAND over arcs that
SCORE, and a completed track that misses its axes is worth less than the axes
are. So the exponent went back to 1 — and then the *grouping* was measured at
that neutral exponent and rejected too: **−29.34 against −15.33**, worse than
the weighted variant it was supposed to clean up. `a7bdf70` restored the unsplit
product exactly, verified bit-for-bit against the tree N=48 #2 measured
(`pickup_progression` TTC 513010/396401/548736, identical).

**The collateral, which matters for what comes next.** `f438c43` had introduced
a third exponent — `objectiveReadinessPower`, default 1, bit-identical — on the
argument that projected quality and readiness answer different questions and
should not share a rate. `f1fef05` replaced it with the role split's feasibility
power, and `a7bdf70` removed that. So readiness collapsed back onto
`futurePower` and **the separate readiness exponent was never swept at any value
other than 1.** It remains an open, untested lever; see contract §8.2 for why
the accuracy asymmetry argues it should not be 1.

### 7.1 The instrument lesson

This is the more valuable half of the result.

`first_completion_frame` ranks how fast a spec finishes. The benchmark scores
how well it finishes. The two agree while a spec is failing to complete at all —
which is why TTC diagnosed the deficit correctly and cheaply — and they diverge
exactly when an arm starts trading quality for completion, which is what this
arm did. Eight specs improving with no downside anywhere looked like an
unambiguous win and was measuring half the objective.

**TTC is a diagnostic, not a selection criterion.** No arm gets promoted on it
again without a paired quality measure.

A second trap found the same night: the role split is **algebraically** neutral
at exponent 1 but not **bitwise** neutral. Regrouping changes multiplication
order, results differ in the last ulp, and the search takes a different path —
`pickup_progression` TTC 319k/305k/345k against 513k/396k/549k before the split.
A "pure refactor" of the objective still needs its own measurement.

### 7.2 LIVE DEFECT: a readiness softening that reaches the ballistic term

Found 2026-07-26, not yet fixed. `handoff.ts`
`objectiveBlendReadinessPowerForSpec` resolves 0.75 for three spec signatures
(M75 high-air-impact, M108 dense-drum, M115 compact) at budgets ≥200k, and
`handoff.ts` passes that value as `futureQualityPower` — which `proposalUtility`
applies to projected outgoing quality AND readiness.

When M75 was accepted (`a3ff6b8`, 2026-07-04) the objective was
`current^p x readiness^q`. There was no projected term, so the softening reached
readiness alone, and that is the arm the acceptance measured. The contact-indexed
pipeline (`6d064b0`, 2026-07-24) introduced projected quality sharing the
exponent, and nobody revalidated the gate.

**Surface, measured statically:** 5 of 44 development cases, 11.4%, at every
budget ≥250k and none at 75k — `meter_exchange`,
`meter_exchange_speed_plus_4`, `split_signal`, `split_signal_impact_relief_12`,
`wide_breaths_air_plus_5`. All five sit in the `representative` stratum, which
is the stratum §6 records as significantly AHEAD. Reproduce with
`npm run study:objective-powers`.

Re-pointing the gate at readiness alone CHANGES behaviour on those five cases,
so per §3.4 and §7.1 it is a measured arm, not a fix. It rides with the exponent
sweep rather than being patched in ahead of it.

---

## 8. Working agreements

- No hand-waving. Claims are backed by measurement, and the measurement's
  limits are stated.
- **No parallel paths** — one definition of a quantity, reused everywhere.
- **Real measurements are N=48.** Anything smaller is a screen: it may reject an
  arm, never promote one, and is reported as a screen.
- Distinguish "the failure signature is clear" from "the cause is known".
- Legacy-shaped arms are probes, never fixes (§3.4).
- Falsified ideas are recorded here so they are not retried.
- **A conclusion in a source comment is a lead, not a fact** (§9).

---

## 9. Source comments are dated evidence, not standing truth

The compiler has moved far enough that a justifying measurement written into a
comment is usually a statement about a compiler that no longer exists. Two of
them were built on in a single day in July 2026, one of which reached a shipped
hypothesis before anyone checked whether the metric it cited still existed.

So comments are read in two kinds:

- **Mechanism** — "this loop excludes the anchor frame", "read once per call
  because `process.env` costs ~268 ns". Checkable against the code in seconds.
  Trust normally.
- **Conclusion** — "this is what damps the oscillation", "+4.1 headline",
  "31.5% of all frames". An experiment result. **Treat as an unreproduced lead.**

The rule: do not delete a conclusion (the number is the record of where somebody
saw signal), and do not act on it either. Stamp it with the commit and date it
was measured at, and mark it unreproduced against the current tree. Anything
load-bearing gets re-measured before it justifies a change.

Currently carrying this stamp, all measured 2026-07-25 on a tree that has since
changed its ballistic default:

| claim | where |
|---|---|
| the recoverability side-weighting damps the dense-spec catch oscillation | `optimizer/objective.ts` `RECOVERABLE_SIDE_WEIGHT` |
| the raw air ask saturates and blinds the RMS on short gaps | `optimizer/objective.ts` `projectedOutgoingTargets` |
| excluding `airFit` improves both strata (dense land 34.3 → 35.0, healthy 75.1 → 76.5) | `optimizer/readiness_scoring.ts` |
| the closed form is at parity with the exact kernel | `core/ballistic_projection.ts` — 24 seeds, and the one measurement here taken ON the current default |

---

## 10. Sweep A: the exponents must not diverge, and why

The open lever from §7's collateral was finally measured. The argument for it
was that projected outgoing quality and readiness are not equally trustworthy —
projected rests on a 0.50 px ballistic boundary, readiness validates at MSE
0.0187 / r 0.787 — so the search should not trade them at a fixed 1:1 rate.

**That argument is wrong in sign.** 12 cells, 16 seeds, 2 budgets, one shared
seed epoch, baseline 484.55 (`generated/benchmark-v2/objective-power-matrices/objective-sweep-a-16s01`):

| future | readiness | delta | SE | 95% CI |
|---:|---:|---:|---:|---|
| 1 | follow | **+0.00** | 0.00 | identical fraction 1.0000 |
| 1 | 1 | +1.95 | 1.17 | [−0.35, +4.24] |
| 1 | 0.75 | −0.33 | 1.22 | [−2.72, +2.07] |
| 1 | 0.5 | −4.17 | 1.05 | [−6.23, −2.11] |
| 1.5 | follow | +0.24 | 1.67 | [−3.04, +3.52] |
| 1.5 | 1 | +1.51 | 1.50 | [−1.43, +4.46] |
| 1.5 | 0.75 | −3.23 | 1.21 | [−5.60, −0.86] |
| 1.5 | 0.5 | −14.83 | 5.35 | [−25.31, −4.35] |
| 2 | follow | +1.72 | 1.51 | [−1.24, +4.67] |
| 2 | 1 | −2.34 | 1.34 | [−4.96, +0.29] |
| 2 | 0.75 | −8.99 | 3.52 | [−15.90, −2.08] |
| 2 | 0.5 | −6.18 | 0.79 | [−7.73, −4.63] |

Within every row, separating the two exponents costs headline, and the cost
grows with the separation. The `follow` column — where readiness always equals
future — is the best column and the only one that never goes significantly
negative. Nothing here is promotable: every CI except the null cell crosses
zero, which is expected of a 16-seed screen.

**The null cell is worth its cost.** `future1--readinessfollow` is the source
default, so its environment is empty and it is the same compiler as the baseline
arm: delta exactly 0.00, SE 0.00, identical fraction 1.0000. The paired
machinery demonstrably reports zero for an identical compiler.

### 10.1 The mechanism: an exponent is a log-domain weight

`proposalUtility` is a PRODUCT, so it orders candidates by a sum of logs, and
each layer's weight in that ordering is its exponent times the spread of its
log — approximately spread/level. Measured per candidate pool with
`npm run study:layer-spread` (reading the pre-existing
`snapshotObjectiveLayerSpread`, no new instrumentation), at 250k seed 0:

| spec | level: settled / projected / readiness | log-weight: s / p / r | read÷proj |
|---|---|---|---:|
| river_reentry | 0.604 / 0.671 / 0.255 | 0.60 / 0.55 / 1.33 | 2.40 |
| countercurrent | 0.693 / 0.716 / 0.331 | 0.53 / 0.56 / 1.01 | 1.82 |
| split_signal | 0.558 / 0.574 / 0.241 | 0.38 / 0.38 / 1.13 | 2.94 |
| meter_exchange | 0.616 / 0.722 / 0.225 | 0.57 / 0.52 / 1.35 | 2.60 |
| dense_dialogue | 0.459 / 0.501 / 0.061 | 0.51 / 0.41 / 1.49 | 3.61 |
| high_air_drive | 0.603 / 0.668 / 0.211 | 0.51 / 0.58 / 1.37 | 2.37 |

**Readiness already carries ~2.6x more of the candidate ordering than projected
does, at equal exponents** — not because it spreads more in absolute terms (it
spreads slightly LESS: raw ratio 1.32 the other way) but because it sits at a
much lower level, 0.06–0.33 against 0.46–0.72. Halving its exponent therefore
removes the ordering's single largest term.

Note the trap, since it cost a wrong conclusion here first: RAW spread says the
two layers are comparable and suggests the exponents could be traded freely.
Only the normalized statistic matches the measured surface. For a product
objective, always normalize.

The mechanism predicts WHICH specs suffer, and that is the check that makes it
an explanation rather than a story. Against `future1.5--readiness0.5`, per-spec
delta correlates with the log-weight ratio at **r = −0.78** (n=6), and
`dense_dialogue` — highest ratio 3.61, readiness level 0.061 — loses **−63.59**,
an order of magnitude worse than any other spec.

### 10.2 What this does NOT settle

The accuracy asymmetry is real; only the proposed remedy is refuted. It remains
true that the layer the compiler trusts least dominates its ranking, and that
this is an accident of level rather than a design decision. Acting on it, if it
should be acted on, has to happen somewhere other than the exponent — a
recalibration of readiness's output range would move the log-weight without
discarding the ordering signal, and is untested.

### 10.3 The live axis Sweep A actually found

Only exponent RATIOS affect ranking: scaling all three by a positive constant
scales `log value` by that constant and preserves order (bitwise it does not,
per §7.1). So the `follow` column is not "more future weight", it is the
settled:future ratio, running 1:1 → 1:1.5 → 1:2 — and it improves monotonically,
0.00 → +0.24 → +1.72. That is the gradient to follow next, and it was not the
axis this sweep was designed to test.

---

## 11. Readiness recalibration: CLOSED, and it closes §10.2

§10.2 left one route open. The exponent had been refuted, but an exponent scales
`log(readiness)` UNIFORMLY, and the level asymmetry it exposed is structural —
readiness is a product of up to five factors while settled and projected are
single axis-quality scores, so multiplying deflates it mechanically. Bounding
only the TAIL is a different intervention with a different possible answer:
`readiness -> floor + (1 - floor) * readiness`, monotone, so readiness's own
ordering of a pool is preserved exactly.

**Decisively worse, monotonically** (`objective-recal-16s01`, 16 seeds, 2
budgets, baseline 485.92 — a different seed epoch from Sweep A, so its baseline
differs and only within-sweep deltas are comparable):

| floor | headline | delta | SE | 95% CI |
|---:|---:|---:|---:|---|
| 0 | 485.92 | **+0.00** | 0.00 | identical fraction 1.0000 |
| 0.05 | 452.42 | **−33.50** | 2.08 | [−37.59, −29.42] |
| 0.15 | 433.73 | **−52.19** | 3.39 | [−58.84, −45.54] |
| 0.30 | 409.05 | **−76.88** | 2.48 | [−81.73, −72.02] |

Not marginal and not ambiguous: the smallest floor tested costs more than twice
the worst exponent cell in Sweep A, and every interval sits far from zero.

### 11.1 What the two sweeps together actually say

**Readiness's near-zero tail is the most valuable signal in the objective, and
its low level is not a defect.**

`catchability` lives inside readiness, so a readiness near zero is the model
saying "this candidate cannot be caught". Because the objective is a product,
that produces an unboundedly negative log — which is precisely the mechanism by
which the search refuses to commit to a dead end. A floor caps that refusal:
at 0.05, a hopeless candidate is penalized no more than `log(0.05)` however
hopeless it is, and the search starts accepting arcs it should reject.

That is why tail-bounding costs so much more than uniform down-weighting. The
exponent at 0.5 halves the penalty on every candidate; the floor removes it
almost entirely from exactly the candidates it was carrying information about.
It also retro-explains Sweep A's worst cell: `dense_dialogue`, readiness level
0.061 — the spec whose pools live closest to the tail — lost −63.59 where no
other spec lost more than −9.

So the observation in §10.2 stands as an observation and is retired as a lead:
the layer the compiler trusts least does dominate its ranking, and that is the
admission mechanism working, not an accident to be corrected. **Both routes for
rebalancing readiness against the other layers are now closed** — uniform (§10)
and tail-bounded (§11). A future attempt needs a genuinely different mechanism
and a reason to expect a different answer.

### 11.2 A measurement error worth recording

Sweep A's `settled1--future1--readiness1` cell was reported as an exponent
result at +1.95. It was not. Under the v1 environment rule every non-default cell
emitted all three power variables, and `handoff.ts` disables its per-spec
exponent gates on the mere PRESENCE of `LR_OBJECTIVE_SETTLED_POWER` or
`LR_OBJECTIVE_FUTURE_POWER`. That cell had the same exponents as the default and
differed only by having both gates off, so +1.95 is the combined price of the
gates, not an exponent measurement.

Caught because the floor axis made it fatal rather than merely untidy: a cell
varying only the floor would have carried a gate change across the 40 of 44 specs
the settled gate touches. Emission is now per-variable and the matrix schema is
v2. The general lesson is the §7.1 one again in a new costume — an env variable
whose PRESENCE is load bearing is a side channel, and a matrix that sets
variables in blocks will find it.
