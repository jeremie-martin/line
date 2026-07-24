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

Written down in contract §8.1 with four named alternatives, because it was
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

What it buys is **not CPU — it is budget**: the compiler's ration is denominated
in engine frames and the kernel charges none. Plus a counterfactual the engine
cannot answer without a fork.

Open, unmeasured: cost against a *dense* track, which is the real alternative.
Tracked in `ballistic-goal.md`; the volume is now visible per compile as
`CompileStats.ballistic_micro_sim_frames`.

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

| quantity | value | source |
|---|---|---|
| ballistic boundary error at the next contact | 1.7e-06 px position, 4.5e-06° angle; **exactly 0** for horizons ≥9 frames (128,727 of 202,752 rows) | `generated/analysis/ballistic-v2.json` |
| readiness composite, locked validation | MSE 0.00683, MAE 0.0541, r 0.863 | `generated/analysis/readiness.json` |
| readiness component vs attempt-noise floor | speed 8.7×, impact 5.6×, air 3.6× above the floor | same |
| **airFit is mostly authored context** | a lookup on targets+durations with **no rider state** scores 0.01228 vs the model's 0.01022 | measured |
| catchability is boundary-informed | boundary-only Brier 0.1702 beats per-case 0.1965; model 0.1235 | measured |
| readiness compiler value | turning it off costs **112 headline points** (493.30 → 381.20) | ablation matrix N=3 |
| per-factor value | catchability ≈25, speed ≈13, impact ≈11, air ≈5 | same |
| frame accounting | fwd-eval 18–37%, aim probes 16–27%, pool+rest 37–60% | 3-seed archive |
| pool ordering | the three-layer objective orders **98.5%** of candidates; cost decides ~1.5% | `LR_AIM_STUDY_STATS=1` |

---

## 5. Falsified — do not retry

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

## 6. Working agreements

- No hand-waving. Claims are backed by measurement, and the measurement's
  limits are stated.
- **No parallel paths** — one definition of a quantity, reused everywhere.
- **Real measurements are N=48.** Anything smaller is a screen: it may reject an
  arm, never promote one, and is reported as a screen.
- Distinguish "the failure signature is clear" from "the cause is known".
- Legacy-shaped arms are probes, never fixes (§3.4).
- Falsified ideas are recorded here so they are not retried.
