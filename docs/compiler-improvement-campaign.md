# Compiler Improvement Campaign

Target: accepted Benchmark V2 development headline 550.

Current accepted baseline:
`readiness-catch-impact`, canonical headline 553.73. Its cache covers 8 seeds per
budget and extends on demand. Qualification monitor 407.20 at 120/120 valid.

| baseline | canonical | evidence |
|---|---:|---|
| `steep-arrival-default` | 507.33 | N=48 +11.29 |
| `dive-span-floor` | 528.69 | N=48 +18.30 |
| `segment-refine` | 532.40 | N=48 +2.01 |
| `paced-forward-eval-width` | 541.57 | N=24 +10.66 [+5.13, +16.19] |
| `paced-aim-lane` | 548.54 | N=8 +6.97, three strata exactly 0.00 |
| **`readiness-catch-impact`** | **553.73** | **N=24 +6.05, promotable, validity 3089→3131** |

### What 570 would now require

Re-pricing on the accepted archive with `study_headline_counterfactual.ts`:

| counterfactual | headline | delta |
|---|---:|---:|
| **every seed scores its cell's BEST** | **572.03** | **+23.50** |
| invalid runs score their cell's MEAN | 560.05 | +11.51 |
| valid runs score their cell's BEST | 560.26 | +11.72 |
| impact rms x0.75 / x0.5 / x0 | 600 / 649 / 706 | +51.4 / +100.7 / +157.1 |
| air rms x0.75 / x0 | 560 / 577 | +11.4 / +28.2 |
| speed rms x0.75 / x0 | 555 / 563 | +6.0 / +14.1 |
| amplitude rms x0.75 / x0 | 554 / 561 | +5.1 / +12.9 (n=288) |

**A compiler as reliable as its own best seed of eight would score 572.** That
prize is now split evenly between validity (+11.51, and every invalid run left is
at 250k on four frontier cells) and quality spread among valid runs (+11.72). The
pacing family took the first half of it; nothing measured this session touches
the second. Every other route needs the impact axis, which this session closed
from three further directions on top of the campaign's twenty.

Accepted this session, both on one mechanism — the steep-arrival dive:

| baseline | canonical | N=48 delta | evidence |
|---|---:|---:|---|
| `accept-2026-07-25T15-30-00Z-closed-form` | 498.91 | — | previous |
| `steep-arrival-default` | 507.33 | **+11.29** [+7.49, +15.09] | dive at every attempt, whole span |
| `dive-span-floor` | **528.69** | **+18.30** [+13.67, +22.94] | ask floor deleted, span floor 0.5 |

Qualification monitor 394.17 → 399.50 → 404.04, at 120/120 valid throughout.

A baseline archive is always EXACTLY 8 canonical seeds per budget - the seed
schedule packs 250k to slots 0-7, 500k to 8-15, 750k to 16-23, leaving the probe
profile 24-26 / 27-29 / 30-32, and anything deeper collides with it. Deeper runs
are evidence, not baselines.

The previous long-form campaign log remains recoverable from repository
history; older material is also under `docs/archive/`. This file now follows
the concise hypothesis/evidence/decision format required by `goal.md`.

## 2026-07-28 — the delivered turn IS the incidence, and the incidence is not for sale

Baseline of record for this entry: `segment-refine`, canonical 532.40, cache
[0,8). The tree at `06b4b6e` replays it bit-identically (N=2, delta +0.00 on
every stratum and case), so the engine-speed commits since the promotion are
behaviourally inert and every arm below is attributable. Those commits DO change
the WASM bytes, and `eval` correctly refuses a comparison until the baseline's
own artifact is restored from
`benchmark/v2/runs/segment-refine-compiler-snapshot.tar.gz`.

### The measurement: what the rider rides inside the scoring window

`scripts/v0/study_impact_branch.ts` walks the contiguous surface ahead of each
scored contact and records the branch's angle profile over the deadline distance
(`IMPACT_WINDOW * speed`, about 60 px — the only surface the metric can see),
the frame the rider separates, and the turn accrued by then. 512 committed
contacts over six specs at 250k:

| rotation to the deadline | > +6 deg | +2..+6 | -2..+2 | rotates up |
|---|---:|---:|---:|---:|
| separation frame | 3.68 | 4.81 | 5.52 | 6.0..6.7 |
| delivered / ask | 0.51 | 0.62 | 0.66 | 0.59 |

The rider leaves because the branch curves DOWN out from under it — 92% of
branches are longer than the deadline distance, so it is not running out of
line. Contacts that never separate have rotated +1.50 degrees where the
population mean is +4.98.

**But the turn does not accrue from support.** Holding the caught angle across
the deadline distance and spending the rotation on the rest of the ride-out
(`IMPACT_DEADLINE_KNEE`) moves support at +6 from 60% to 75% and the per-frame
turn does not change at all: 0.99/1.71/4.35/6.99/9.22/10.73/11.74 against
0.94/1.70/4.76/7.82/10.02/11.11/11.91. The delivered turn simply IS the
incidence — 11.74 degrees against a mean incidence of 10.85, and 4.51 against
2.51 in the mid band. Everything else nets out.

So the mid-band shortfall is an incidence shortfall, and it is arithmetic: a
0.25 ask needs 10.4 degrees at speed 10 and the sampler's offset terms supply
2.5.

### Three arms, and the incidence is refuted in its decoupled form too

The 2026-07-27 incidence floor moved `contactAngleDeg` itself, which is also the
reference for the approach, the ride-out and therefore the launch — so it
flattened the whole arc and the arrival speed fell 10.16 to 8.13. This session
separated them: `contactSurfaceDeg` floors only the surface the rider meets
(final approach segment, contact vertex, post branch), leaving every derived
angle on the unfloored reference.

| arm | headline | delta | SE |
|---|---:|---:|---:|
| deadline knee alone | 521.96 | **−10.44** | 4.83 |
| incidence floor 12 deg, decoupled | 510.90 | **−21.49** | 5.27 |
| both | 464.47 | **−67.93** | 3.11 |

Strongly super-additive in the wrong direction. The geometry probe says why:
mid-band delivered impact does rise exactly as designed (0.119 → 0.183, mid
incidence 2.75 → 10.88) and the arrival speed collapses with it, 10.70 → 9.01
across the whole population. **The coupling was not the obstacle — the energy
was.** Turning the rider costs `sin^2(theta)` of its kinetic energy at every
contact, the compiler is already at the equilibrium its speed asks allow, and
there is nothing to spend.

### And the arrival surplus is a marker, not a lever

Splitting committed contacts by the arrival speed's surplus over the gap's own
authored speed ask is the strongest correlate of delivered impact in the
campaign, and it survives controlling for the ask:

```
mid band (ask 0.31)   surplus -0.58  -0.05  +0.48  +1.34   delivered 0.114 0.140 0.202 0.285
high band (ask 0.63)  surplus -0.67  +0.05  +0.57  +1.27   delivered 0.250 0.383 0.508 0.646
```

The mechanism is explicit in the sampler — `brakePressure` flattens the contact
by 18 degrees times the surplus over 6.6 px/frame, `accelPressure` steepens it
by 16 — so the cross-section reads as causal and prices +1 px/frame of surplus
at +0.10 to +0.20 of delivered impact, which is +70 headline.

It is not. Aiming the compiler's own speed targets at the endpoint the impact
ask needs (`ask / cos(neededTurn)`, resolved once in `resolveImpactTargets`,
compiler aim only — the evaluator resolves its own targets) DOES move the rider:
mean arrival surplus 0.10 → 0.71, contact speed 10.70 → 11.22. Delivered impact
moves 0.366 → 0.367. The pressures re-centre on the lifted target, so the
incidence falls by exactly what the speed buys. Two smaller launch arms agree —
targeting the gap MEAN rather than its endpoint (+0.02 surplus), and adding the
next catch's `1 − cos(theta)` energy cost to the drop target with the descent cap
opened to 3.0 (+0.08) — and the campaign's earlier descent-cap sweep already
said the search will not commit a steeper launch.

**So the surplus split was selection.** Contacts that arrive fast are contacts
whose gap went well. This is the second time this campaign has priced a
mechanism off a cross-section and found nothing there; the first was
"impact accuracy is nearly free" in the 2026-07-26 entry.

### Where the headline actually is, priced on the accepted archive

`scripts/v0/study_headline_counterfactual.ts` replays a retained archive through
`v2HeadlineForDecisionRuns` — the exact promotion aggregation — so it reproduces
532.3973 to four decimals and prices a counterfactual with zero compiles:

| counterfactual | headline | delta |
|---|---:|---:|
| every seed scores its cell's BEST | 567.19 | +34.79 |
| every run scores its cell's MEAN | 555.31 | +22.91 |
| **invalid runs score their cell's MEAN** | **555.18** | **+22.79** |
| valid runs score their cell's BEST | 543.71 | +11.32 |
| impact rms x0.75 / x0.5 / x0 | 582 / 630 / 685 | +49.7 / +97.5 / +152.2 |
| air rms x0.75 / x0 | 542 / 556 | +9.6 / +23.3 |
| speed rms x0.75 / x0 | 538 / 546 | +5.8 / +13.6 |
| amplitude rms x0.75 / x0 | 537 / 545 | +5.0 / +12.9 (n=288) |

**The reliability prize IS the validity prize.** Removing all seed-to-seed
variation is worth +22.91 and removing invalidity alone is worth +22.79 of it;
the spread among valid runs is only +11.32. And it is concentrated: two cells
are 0 of 8 — `frontier_pickup_progression_shifted|250k` and
`frontier_dense_recovery_240ms_figures|250k` — with `frontier_dense_recovery`
1 of 8 at 250k.

Every one of them fails the same way, and it is not what the 2026-07-25 entry
assumed: `terminus rideStalled`, contacts hit 90 of 110, and the emitted TRACK
is 1,941 frames of an authored 2,340. The rider is moving at 8-11 px/frame right
to the end — it simply runs off the end of a track the compile never finished
building. Frame accounting on that cell: 73,803 of 250,000 frames go to forward
rollouts, `fwd_rollout_no_candidate` is 769 of 1,453 calls, and the first
complete traversal arrives at frame 271,068.

### ACCEPTED: forward evaluation only refines the head of an ordering the pool already has

`admittedHandoffPool` hands `rankedOptions` eight candidates already sorted by the
free local cost, of which `HANDOFF_BRANCHING` = 3 are expanded, and every one of
the eight then pays a CHARGED forward rollout. The staged path directly above it
already implements the alternative — score a cheap pre-stage, promote finalists —
but it is gated on `forwardStageTop`, which is 0 outside a post-completion env
override. So the pre-prune the campaign has had on its lever list since the
forward-eval entry ("top-k pre-prune, winner mean q-rank 2.6") was never built.

`HANDOFF_FORWARD_EVAL_TOP` builds it: the pre-sorted head is rolled honestly and
the tail is scored without a rollout and sorted behind it. N=8 against
`segment-refine`:

| top | headline | delta | SE | valid | representative | capability |
|---|---:|---:|---:|---:|---:|---:|
| 6 | 528.90 | −3.50 | 4.42 | | | |
| 4 | 531.11 | −1.28 | 5.39 | | | |
| 3 | 534.20 | +1.80 | 5.95 | 1012→1019 | −3.4 | +32.7 |
| **2** | **542.26** | **+9.86** | **2.38** | 1012→1027 | −10.31 | **+126.56** |
| 1 | 526.66 | −5.74 | 2.42 | 1012→1034 | −26.3 | +112.1 |

**An interior optimum, bracketed on both sides.** Narrowing always buys validity
(1019 → 1027 → 1034) and always costs breadth (−3.4 → −10.3 → −26.3); two is
where the two curves cross. This is a continuous trade between how many
candidates a gap ranks honestly and how far the compile gets, not a threshold at
`HANDOFF_BRANCHING` = 3. It buys the dense frontier and it costs breadth:

```
frontier_dense_recovery_240ms_figures  +253.90  valid  9 -> 16
frontier_dense_recovery                +216.81  valid 13 -> 17
frontier_pickup_progression_shifted    +163.65  valid 13 -> 17
frontier_low_air_endurance_6s           -36.29  valid 24 -> 24
frontier_low_air_endurance              -31.52  valid 24 -> 24
sparse_lowline_air_minus_4              -27.32  valid 24 -> 24
```

Validity 1012 → 1027 with none lost, and 500k and 750k reach 352 of 352. The
losers are the LOW-AIR family, which needs breadth to find a long grounded
ride-out — the same population the incidence arm below hurts, for the same
reason: they have the least energy to spare and the most search to do.

`representative` −10.31 [−11.70, −8.92] and `legacy_regression` −19.12 are
significantly negative, so this is a real capability-for-quality trade rather
than a free win; the headline says the trade is favourable and the validity side
of it is a count rather than a noisy score.

### The width should follow the compile's own pace, and then the trade disappears

The bracket says narrowing buys the frontier and sells breadth, so the question
is whether the compiler can tell the two apart at the moment it chooses. It can:
`traversalBudgetSlack` is a regression on contact count and duration, but
`spent / deepestGap * totalGaps` is the compile's own measured cost to reach the
end. `observedTraversalBudgetSlack` blends them by the share of budget already
spent — exactly the prior when nothing has been observed, the evidence once
there is any, and no threshold. The rolled head then runs full width while the
compile is on course and narrows to two once its own pace says it will not
finish.

| arm | delta | SE | repr | capability | legacy | dev-music | valid |
|---|---:|---:|---:|---:|---:|---:|---:|
| flat top-2 | +9.86 | 2.38 | −10.31 | +126.56 | −19.12 | — | 1027 |
| **paced width** | **+9.17** | 4.86 | **+0.42** | +58.5 | **+1.3** | **+0.2** | 1020 |
| paced + attempt-ramped incidence floor | +8.58 | 5.12 | −1.8 | +66.3 | +3.4 | −9.1 | 1027 |
| flat top-2 + attempt-ramped floor | +6.49 | 2.41 | −11.9 | +110.4 | −16.1 | −2.3 | 1031 |

**Same headline, and the trade is gone.** The paced arm keeps
`frontier_dense_recovery_240ms_figures` +272.7 (9 → 16 valid) and
`frontier_dense_recovery` +134.8 while `representative`, `legacy_regression` and
`development_music` all come back to zero or better — where the flat prune was
significantly negative on two of them. It costs half the capability gain and a
wider interval, because it fires on fewer nodes.

The attempt-ramped incidence floor adds validity on both bases (1020 → 1027,
1027 → 1031) and pays for it: `development_music` −9.1 paced, `representative`
−11.9 flat. Its catching surface is real and the population that wants it is
already served by the width, so it stays retired.

### N=24 — ACCEPTED, +10.66

`npm run benchmark -- eval --seeds=24 --jobs=48`, after extending the baseline
tail by 16 slots (2,112 baseline compiles) — 3,168 candidate compiles:

```
headline 531.29 -> 541.95   delta +10.66   seed-block SE 1.98   95% [+5.13, +16.19]
RESULT: STRONGER THAN BASELINE          promotable
validity 3027/3168 -> 3065/3168  (gained 49, lost 11)
  250k  -0.47
  500k  +10.33
  750k  +18.63
strata
  representative      +0.20
  capability         +70.02
  legacy_regression   +0.16
  development_music   +0.02
```

Every stratum non-negative and one strongly positive, which no arm in this
campaign has managed before; the gain is monotone in budget, which is what a
mechanism that stops wasting a scarce resource should look like — the more
budget there is, the more of it the paced width leaves for depth. The flat
prune's +9.86 is inside this interval and its shape is strictly worse, so the
pacing is what is promoted rather than the prune.

### The same rule on the second lookahead consumer: the aiming lane

The enumerative proposer fits a local response model by SIMULATING a probe
design per base, and it is the compiler's second largest lookahead spend:
measured on `frontier_dense_recovery` at 250k it charges 42,859 of 250,851
frames — 17% of the budget — on a compile that never finishes building its
track. Holding it to the same rule (`AIM_LANE_PACE_SUPPRESS`: the lane runs
while the compile is on course, and not once its own pace says it will not
finish) takes that cell from 78 to **108 of 123 committed contacts**.

N=8 against `paced-forward-eval-width`:

```
headline 541.57 -> 548.54   delta +6.97   SE 4.90
validity 1020/1056 -> 1032/1056
  250k +4.1   500k +12.3   750k +0.1
strata  representative 0.0 | capability +46.5 | legacy_regression 0.0 | development_music 0.0
  frontier_pickup_progression  +119.0  valid 16 -> 21
  frontier_dense_recovery       +98.6
  frontier_low_air_endurance_7s +55.3  valid 23 -> 24
```

**Three strata are exactly zero** — the pace gate never fires on a compile that
finishes, so 85% of the headline weight is byte-identical and the whole movement
is on the frontier that was failing. It reads inconclusive only because
`capability` carries all of the variance.

**Falsified in the same batch: pacing the per-gap SAMPLE COUNT.** Cutting `nCand`
by up to half on the same signal takes `frontier_dense_recovery` back from 108 to
83 committed contacts and drops `river_reentry` from 24 full evaluations to 3 —
the early-compile pace estimate is pessimistic before any gap has been reached,
so a breadth cut fires on healthy compiles too. Lookahead is refundable; the
pool that lookahead ranks is not.

### Two more closures on the improvement phase and the air axis

**The ride-out does not hold because it is short — and holding it straight is
worse.** The air axis inverts into a grounded ride-out LENGTH, and none of the
length controls bind: the reference cap replaced by the detector's physical
landing floor is +0.002 of bias, the blend floor at 0.5 and the blend strength at
0.85 are flat, and raising the 220px clamp to 360 is BYTE-IDENTICAL. Holding the
caught angle for the distance the air ask wants grounded — the same shape that
raised supported-at-+6 from 60% to 75% — makes the capped population WORSE, air
bias +0.110 -> +0.123. The rider on those gaps is bouncing rather than riding, so
a branch that rotates down follows it and re-contacts while a straight one lets
it bounce over. Air is not a length problem.

**The post-completion staged rollout is inert.** `forwardStageTop` has been
present and off since it was written; turning it on at 4 (so only four finalists
pay the full-depth rollout after the first completion, which is where 500k and
750k spend most of their budget) is **+0.10 with SE 0.24** — the cleanest null in
the campaign.

### The fifth closure: supplying the energy directly does not move impact either

Every impact arm this session ended at the same explanation — turning the rider
costs `v^2 sin^2(theta) / 2` of kinetic energy and nothing replaces it, because
the energy-targeted launch only converts the rider's PACE to the gap's ask and is
capped at `LAUNCH_DESCENT_CAP * g * N` besides. Elevation is unauthored in this
distribution, so height is free here exactly as grain was for the segment
refinement, and `netDyToElevation` is the axis's own inverse. Commanding each
gap's drop to be the drop its next contact's turn will cost — resolved through
`elevationToLaunchVy` against the band the speed supports, `min(g*N,
VERTICAL_FRACTION * speed)`, which on a dense gap is 2.2x what the descent cap
allows and reached by a path that cap does not bound — is the direct test of that
explanation.

It arrives and it does not convert: arrival speed 10.62 -> 10.78, surplus 0.10 ->
0.22, delivered impact 0.363 -> 0.360, mid-band incidence 4.19 -> 4.14. Reverted.

So the energy account was the right diagnosis of why the earlier arms failed and
is not itself the lever: paying the bill does not buy the turn, because what
converts speed into incidence is the sampler's `brakePressure` against a target
that moves with the rider. Five independent mechanisms this session — support
through the window, the decoupled incidence floor, the speed-target lift with
un-lifted pressures, the launch turn-loss term, and now the commanded drop — all
land within 1% of the same impact bias.

### Falsified: stratifying the candidate pool's wide tail

With validity nearly spent, the priced prize moved: on the accepted archive
giving every VALID run its own cell's best score is worth **+14.18**, more than
the +8.93 left in validity. That is search variance under a fixed budget, and the
textbook answer is to stop sampling the pool independently. The sampler half
does it already — `ccGuidedRoll` stratifies against the attempt index through
`lowDiscrepancyRoll` — but the guide weight decays as `1/(1+(attempt/4)^2)`, so
the wide tail that supplies most of the pool is drawn independently. Stratifying
that tail costs no draws: the RNG stream is consumed identically.

It is **−11.60**, with `capability` −38.0 and validity 1042 → 1035, and the case
table says exactly what was traded:

```
frontier_low_air_endurance_7s        +107.3  valid 23 -> 24
frontier_pickup_progression_shifted  -115.1
frontier_dense_recovery               -98.1  valid 20 -> 18
dense_dialogue_impact_contrast_10     -79.7  valid 24 -> 21
```

Even coverage helps the case that needs a well-covered knob space and hurts every
case that needs a RARE draw. On the dense frontier a viable catch is a small
region the pool finds by luck, and independence is what buys the lottery tickets;
a covering sequence spends the same draws on the space's middle. The pool's
randomness is not a defect to be averaged out — it is the search's only source of
the improbable.

### The largest un-attacked population: 35% of contacts BOUNCE

`study_impact_branch.ts` now splits scored contacts by whether support goes
supported → airborne → supported inside the window. Over 532 committed contacts:

| population | n | ask | delivered | share | turn | incidence | rotate-to-deadline |
|---|---:|---:|---:|---:|---:|---:|---:|
| bounces in window | 184 (35%) | 0.520 | 0.273 | **53%** | 10.50° | 11.27° | **+5.27** |
| no bounce, separates | 108 (20%) | 0.588 | 0.366 | 62% | 14.00° | 15.06° | +6.92 |
| **no bounce, held** | 240 (45%) | 0.554 | 0.430 | **78%** | 16.72° | 14.97° | **−1.06** |

The held population is the only one whose TURN EXCEEDS ITS INCIDENCE — a concave
branch keeps turning the rider after the impulse — and it rides the only surface
that rotates UP across the deadline. Bouncers deliver 0.8 degrees LESS than their
incidence and leave at frame 3.03 against 4.94 and 7.

Bringing the 184 bouncers to the held population's 78% would be +0.047 of mean
delivered impact, about **+33 headline** at the campaign's 7-points-per-0.01 —
the largest single population left, and the impact axis's error concentrated in
one physically-named failure.

**Not an impulse-granularity problem.** Doubling `IMPACT_SEGMENT_REFINE` to 4
takes bounces only 184 → 170 and their delivery 0.273 → 0.286, with the
population mean unmoved at 0.363.

**And the bounce is removable — removing it does not pay.** The held group's
branch rotates only −1.06 degrees across the deadline, so the shape it needs is a
SHALLOW valley rather than the template's, and building one directly into the
ordinary branch (rise across the window's own share of the ride-out, scaled by
the ask) works far better than any template gate ever did:

| window rise per unit ask | bounces | held | delivered | arrival speed |
|---|---:|---:|---:|---:|
| 0 (shipped) | 184 | 240 | 0.363 | 10.67 |
| 1.5 deg | 68 | — | 0.348 | 10.33 |
| 3 deg | 68 | — | 0.346 | 10.26 |
| 6 deg | **75** | **351** | 0.341 | 10.12 |

**Bounces fall 59% and delivered impact falls with them, at every dose.** The
mechanism saturates immediately — 1.5 degrees removes as many bounces as 6 — and
the cost does not: riding up the valley brakes the rider, and the metric
multiplies the speed it takes. This is the sixth closure of the impact axis this
session and the most complete: the bounce is a real, large, correctly-identified
failure, and the branch shape that fixes it costs more than the turn it recovers.

### The correction the six closures point at: normal forces do no work

Every impact closure this session was explained as "turning the rider costs
kinetic energy nothing replaces". That is true of a COLLISION and false of a
CURVE. A surface exerts only a normal force, and a normal force does no work on a
rider sliding along it — a smooth curve redirects the velocity for free. The
energy account is therefore not a property of turning; it is a property of two
specific things:

1. **discrete impulses**, which kill the normal component and cost
   `v(1 − cos θ)` per vertex — the polyline's price, and why the accepted
   segment refinement paid;
2. **net climb**, which is potential energy — and why the shallow valley above
   brakes: it turns the rider by rising, and pays gravity for the privilege.

That is exactly what the held population's numbers say. Its turn EXCEEDS its
incidence — more rotation than the impulse delivered — because the surface keeps
turning it afterwards, and it does so at the HIGHEST arrival speed of the three
groups (10.72 against 10.55). Free turning is already visible in the data.

So the open question is sharper than "the energy is not there". It is: what
surface turns the rider through the scored window while its height still FALLS?
The arrival is descending and a catch must present a surface no steeper than the
arrival, so the vertex turn is upward by construction — but the rotation AFTER it
need not climb if the branch starts steep enough to keep descending while it
curves. Nothing in this session tried that shape; every valley arm rotated up
from an already-flat contact and paid for it in height.

### THE CEILING, correctly stated at last: there is no descending rotation left

The correction above predicts a specific shape — meet the rider on a surface
closer to its arrival, then curve down to the flattened angle across the window,
so the same heading is reached at the deadline by free curvature instead of a
lossy impulse, while descending the whole way. Measured (`ENTRY_CURVE_SHARE`,
share of the flatten moved from vertex to curve):

| share | delivered | arrival speed | turn | incidence | free rotation past the impulse |
|---|---:|---:|---:|---:|---:|
| 0 (shipped) | 0.363 | 10.67 | 14.02° | 13.71° | **+0.31°** |
| 0.25 | 0.340 | 10.51 | 13.20° | 11.61° | +1.59° |
| 0.50 | 0.340 | **10.74** | 12.86° | 9.61° | **+3.25°** |

**The physics is confirmed and the ceiling is elsewhere.** At share 0.5 the
arrival speed is fully preserved — 10.74 against the shipped 10.67, the first
arm all session to add turn-shaping at no speed cost — bounces fall 184 → 50, and
the branch delivers **ten times** the post-impulse rotation the shipped one does.
Free turning is real and the compiler was not using it.

It still loses, and the reason is geometric rather than energetic. The catch
surface is ALREADY nearly horizontal: the carrier flattens `contactAngleDeg` to
about +2 degrees against a 13-degree descending arrival. Rotation that keeps
descending is rotation between the arrival angle and horizontal, and the vertex
impulse has already spent all of it. Everything past horizontal is climb, which
is what every valley arm paid for. So moving turn from impulse to curve cannot
ADD turn here — it can only re-allocate the same 13 degrees, and it gives up more
at the vertex than the capped window share returns.

**Which names the one lever that remains.** More descending rotation requires a
STEEPER ARRIVAL — more angle between the incoming heading and horizontal. That is
the steep-arrival dive, already accepted twice this campaign, and its cap is the
AIR axis: a deeper dive lengthens the flight (+0.062 air bias at a 30-degree
delta cap). So the impact ceiling on this suite is an AIR ceiling wearing
impact's clothes, and the open question is the one the 2026-07-27 entry left:
buy the arrival with SLOPE instead of flight time.

### The engine-speed commits are behaviourally inert, verified

`eval` refuses a comparison when the WASM bytes differ from the baseline's, so
the four engine commits of 2026-07-27 were disabled all session by restoring the
retained artifact. They cost nothing: compiled against each artifact in turn,
`river_reentry`, `dense_dialogue` and `frontier_dense_recovery` produce identical
line counts, committed gaps, sim-frame totals and durations (951/88/250117,
960/130/254805, 1197/123/260967). They are pure speedups, so the working
artifact can be rebuilt and re-frozen into a baseline whenever convenient with no
score consequence — only the comparison lock requires the swap.

### The branching factor is at its optimum, bracketed both ways

The forward-eval width bracket implied that search width is the live parameter,
so the actual branching factor was bracketed directly: `HANDOFF_BRANCHING` 2 is
**−8.16** (validity 1042 → 1020, `representative` −9.2, 250k −20.1) and 4 is
**−4.32** (`capability` −17.7, `development_music` −17.8). 3 is the peak.

Two brackets in one session then agree on the shape without agreeing on the
parameter: narrowing the ROLLED head to 2 pays +9.86 while narrowing the EXPANDED
tree to 2 costs 8.16. What the accepted mechanism buys is not a narrower search —
it is not paying to rank candidates the search will not expand.

### Two scorer-alignment nulls, and where the ranking actually happens

`axisCost` weights every axis 1 except `impact` at 0.5, while the headline
weights air/speed/impact 0.3 and amplitude 0.1 — so on the 288 amplitude-authored
gaps it valued amplitude error three times what the headline pays. Correcting it
is **byte-identical on every case**, which locates the ranking: `axisCost` is a
tiebreak, and the pool is ordered by `sortCandidatesByQuality`. That also
explains the 2026-07-26 result that moving `LOCAL_IMPACT_COST_WEIGHT` to 1 "moves
nothing" — it was never the deciding function.

The same misalignment IS present where the decision happens.
`scoreProjectedOutgoingAxes` pools axis errors through
`axisQualityFromErrors`, an UNWEIGHTED rms, so on an air+speed+amplitude gap the
search weights amplitude a third against the headline's 14.3%. Scaling each error
by `sqrt(w / mean w)` before the pooling makes that rms the weighted one without
touching `score.ts` or the suite fingerprint — and it is **−0.54 with SE 0.49**.

So the search's equal pooling is not costing the headline anything: the axis it
over-weights is the one whose error it can least change, and correcting the
weights just moves effort onto axes that were already at their limit.

### The pool's two populations cannot be told apart

The flat stratification's case table is a split, not a null, so it was gated
three ways. None separates the populations:

| gate | `low_air_endurance_7s` | `pickup_progression_shifted` | headline |
|---|---:|---:|---:|
| none (flat) | +107.3 | −115.1 | −11.60 |
| air ask below 0.45 | — | — | dense_recovery 108 → 68 commits |
| gap room (`denseContactPressure`) | — | — | dense_recovery 108 → 51 commits |
| attempt index, tail left random | +110.3 | −106.7 | −2.09 |

The air ask fails because both populations author 0.248. Gap length fails
because the per-gap spread is what matters and the mean hides it — and both
gates collapse `frontier_dense_recovery`, which the attempt gate instead takes
to **123 of 123 committed contacts at 250k**, the only configuration all session
to finish that spec at the scarce budget.

The dose is bracketed too — strength 0.25 is −1.95 against 0.5's −2.09, with
`pickup_progression_shifted` at −107.6 either way — so the trade is structural
rather than a matter of degree.

The attempt gate is the right shape and still not enough: coverage is worth +110
to the case whose ride-out lives in a wide continuous range and −107 to the case
whose viable catch is a rare small region, and no quantity measured this session
tells those two apart. They are both `capability` frontier cases with the same
authored air and opposite needs from their pool.

### Repair looks wasteful and is at its optimum

With the pacing accepted twice, the remaining budget question is the repair
phase, and its accounting looks damning. At 500k it spends **43-59% of the whole
budget** — `river_reentry` 252,092 frames on 5 restarts, `open_hook` 295,304 on
4 — for one to three accepts, and full evaluations fall as a result:
`river_reentry` 39 at 250k against 14 at 500k, `open_hook` 59 against 10. At 250k
it is 21-42 restarts for zero or one accept.

Both ways of cheapening it are rejected. Each restart is sized to the measured
cost-to-end, so an early anchor costs nearly a whole recompile; `upstreamOrder`
gives that expensive early anchor first claim. Flipping to `nearest-first` is
**−3.28 (reject)**, every stratum negative. Giving the main search half again as
much before repair begins (`mainMargin` 1.1 → 1.5) is **−1.89 (reject)**, every
stratum negative and every budget.

So the expensive early-anchor restart earns its cost: it can alter the weak gap's
inherited ARRIVAL, which is the one thing a cheap local restart cannot do, and
the comment that shipped that choice was right. Repair is not the pacing family's
next target — it is already paying for what it takes.

### Falsified: rushing the first completion — and it bounds the pacing family

The budget decomposition says where the headline is lost: at 250k the accepted
compiler scores 508 and at 750k it scores **569 on its own**, and the difference
is almost entirely how much budget is left after the first complete track.
Measured on the healthy representative cases at 250k, the first completion costs
**65-82% of the budget** — `river_reentry` 186,796, `dense_dialogue` 204,121,
`open_hook` 162,026 — so only a fifth to a third of the compile is spent
improving. At 750k that same ~180k is a quarter of the budget.

The obvious inference is that lookahead before the first completion is ranking
two speculative futures against nothing, so it should be bought at the narrow
width and opened up afterwards. It does what it says — first completion
186,796 → 167,626 on `river_reentry`, 162,026 → 149,111 on `open_hook` — and it
is **−4.11**, with `representative` −8.7, `legacy_regression` −15.7 and 750k
−12.1.

The reason is visible in the same probe: full evaluations collapse 24 → 5 on
`river_reentry` and 55 → 3 on `countercurrent`. **The pre-completion search is
not speculative — it is choosing the prefix the whole track is built on**, and a
narrow prefix arrives sooner at a path the improvement phase cannot escape.

That bounds the whole pacing family, and explains why the two accepted arms
work: they narrow only where the compile's own pace says it will NOT finish, so
the prefix they degrade is one that was going to score zero. Where a completion
is reachable, breadth in the prefix is worth more than the budget it costs.

### The readiness model was stale after all — well calibrated, badly fit

`SAMPLER_FILES` includes `arc_placement.ts`, so the corpus behind
`optimizer/readiness_model.json` predates the steep-arrival dive, the span
floor and the segment refinement. The 2026-07-25 entry declined to recollect on
the argument that the failure was generation rather than ranking; with the
generation questions closed, the argument no longer holds.

Collecting a fresh canonical corpus is cheap — 132 compiles, 132,647 contexts,
about four minutes — and it first says the incumbent is FINE: catchability
AUC 0.844 development / 0.839 validation, ECE 0.034, composite r 0.646/0.634.
Calibration is not fit, though. Refitting on that corpus improves the
decision-seed composite MSE by **80.9%** and the trainer's own rule adopts it.

N=8 against `paced-aim-lane`:

```
headline 548.54 -> 553.07   delta +4.54   SE 5.78
validity 1032/1056 -> 1048/1056        (only 8 invalid runs left in the suite)
  250k +15.0   500k +3.4   750k -0.5
strata  representative -1.7 | capability +44.4 | legacy_regression -9.6 | development_music +1.0
  frontier_pickup_progression_shifted  +90.1  valid 15 -> 22
  frontier_pickup_progression          +73.3  valid 21 -> 24
  frontier_dense_recovery_240ms_figures +36.3 valid 20 -> 23
  regression_transition_mosaic         -17.1  valid 24 -> 24
```

A better ranker converts almost entirely into validity at the scarce budget
(+15.0 at 250k, −0.5 at 750k) and costs quality where the old model's biases
happened to suit the case.

**N=24 settles it at +2.96 [−3.78, +9.70], not promotable**: validity
3089 → 3136 (gained 52, lost 5) against `representative` −4.21,
`legacy_regression` −9.09 and `development_music` −1.32, with capability +45.87.
Retired, and the model reverted.

**Why the 80.9% did not arrive.** Per component the refit improves `airFit` by
90.2%, `impactFeasibility` by 71.4%, `speedFit` by 51.2% — and `catchability`,
the factor that actually gates whether a catch lands, by 3.1%. The composite the
adoption rule scores is dominated by `airFit`, which
`readiness_scoring.ts` deliberately EXCLUDES from the readiness product on the
argument that it carries no information the incoming boundary can change. So the
trainer adopts on a metric the compiler does not use. The rule should be scored
over the components the product multiplies; that is the fix a future retrain
needs before this lever is worth re-opening, and it is why an 80% model gain is
worth three headline points.

**ACCEPTED, once the components are separated.** Projecting the training dataset
onto the incumbent's own 80 columns makes the refit's components interchangeable
with the shipped ones, and the attribution is clean:

| readiness components refit | delta (N=8) | representative | legacy | capability |
|---|---:|---:|---:|---:|
| all four | −2.87 | −2.6 | −13.1 | +2.2 |
| **catchability + impactFeasibility** | **+5.20** | **−0.7** | **−3.9** | **+41.3** |

`speedFit` carries the entire damage — which is exactly the component the
adoption rule had no business selecting, since the composite it scored was
dominated by the `airFit` the product excludes. N=24 on the retained hybrid:

```
headline 547.48 -> 553.53   delta +6.05   seed-block SE 2.20   promotable
validity 3089/3168 -> 3131/3168  (gained 46, lost 4)
  250k +4.24   500k +10.80   750k -0.67
strata  representative -1.36 | capability +49.70 | legacy_regression -3.92 | development_music -1.26
```

**And the loop converges in one round.** Recollecting under the promoted model —
the shipped hybrid measures composite MSE 0.0182 on its own corpus against the
0.0409 the old model measured on the previous one — and refitting again adopts
(55.6% composite improvement) and is worth **−0.47** on the headline, trading
capability −13.1 for representative +1.6 and legacy +2.8. One refit is the whole
prize; policy iteration on this model does not compound.

**Tooling fix required to get there**: `train_readiness.py` demanded that the
incumbent artifact's feature list EQUAL the corpus's, which is the stale half of
the extractor/model split `readiness_scoring.ts` documents as deliberate — the
incumbent declares 80 of the extractor's 88 columns. The check is now a subset
check with a projection wherever the incumbent is evaluated, exactly as the
TypeScript side already does.

### The incidence floor is a VALIDITY mechanism, not an impact one

Reading the refuted arm's own case table settles what it was actually doing:

```
frontier_dense_recovery_240ms_figures  +220.55  valid  9 -> 23 of 24
frontier_dense_recovery                 +84.86  valid 13 -> 19
dense_dialogue                         -118.56  valid 24 -> 24
frontier_low_air_endurance_6s           -96.15  valid 24 -> 24
```

validity 1012 → 1041, capability +31.48, representative −31.10. A surface
further across the arrival is a surface that CATCHES — it intercepts a rider the
aligned surface passes through — and it costs `1 − cos(incidence)` of the speed
to do it. Where the search is landing its catches that is pure loss; where it is
failing to land any it is the difference between a scored run and a zero.

So the floor belongs where the ordinary sample has already failed, and the
compiler's own measure of that is the ATTEMPT index. Ramping the floor across the
attempt span leaves the guided prefix at the shipped surface and offers the
catching one in the wide tail that a healthy gap never reaches. Not yet measured
at the time of writing.

### Falsified: pacing the forward-eval gate on the compile's own progress

`HANDOFF_LOW_SLACK_BRANCH_THRESHOLD` disables pre-completion forward evaluation
below a slack of 1.5, and `traversalBudgetSlack` is a regression on contact count
and duration that reads 1.52 on the cell it decides — a 1.65x underestimate of
that cell's true cost. Replacing it with a blend of the prediction and the
compile's own measured pace (`spent / deepestGap * totalGaps`, weighted by the
share of budget observed, so it is exactly the prior when nothing is observed)
fires as designed and makes the cell WORSE: rollout frames 73,803 → 39,498 and
committed gaps 110 → 89. Pre-completion forward evaluation is not only a quality
refinement — it is what advances the frontier. Reverted.

## 2026-07-26 — where the headline actually is: impact, and it is steering

Every entry before this one attacks the SEARCH. This one starts from the
scorer's own error budget and arrives somewhere else.

### The instrument: exact counterfactual re-scoring, zero compiles

`weightedAxisRms` is `sqrt(sum(w * rms_axis^2) / sum(w))` and the run score is
`1000 * exp(-rms / 0.25)`, so a per-gap axis archive can be re-scored under any
counterfactual and re-aggregated through the exact hierarchy. Replaying the
accepted baseline archive unchanged reproduces `498.9141` to four decimals, so
the tool is the evaluator, not a model of it.

Where the squared weighted error sits (974 valid runs, 87,453 scored contacts):

| axis | rms | mean signed | share of weighted SSE |
|---|---:|---:|---:|
| **impact** | **0.2223** | **−0.1713** | **54%** |
| amplitude | 0.2373 | −0.1275 | 19% |
| speed | 0.1142 | −0.0446 | 14% |
| air | 0.1090 | +0.0476 | 13% |

Every axis is biased the same way — too much air, too little speed, impact and
amplitude — but impact is the only one that pays: removing its bias alone is
worth **+66.8 headline** (498.91 → 565.72), against +2.9 for amplitude, +1.8 for
speed and +1.8 for air. Bias is 58% of impact's MSE. The conversion is roughly
**7 headline points per 0.01 of mean impact**, priced directly:

```
uniform lift of achieved impact   +0.02  +0.04  +0.06  +0.08  +0.10  +0.12
headline delta                   +14.2  +27.4  +39.4  +49.7  +58.1  +64.1
```

### The diagnosis: the undershoot is on the EASY asks

Splitting by whether the authored ask is inside the ballistic feasibility bound
(`substrate.ts impactFeasibilityBound`, a diagnostic that never touches the
target) settles what kind of failure this is:

| population | n | ask | bound | achieved | delivered |
|---|---:|---:|---:|---:|---:|
| ask ≤ bound | 13,178 | 0.250 | 0.591 | 0.136 | **55% of ask** |
| ask ≤ bound | 23,633 | 0.360 | 0.570 | 0.190 | **53% of ask** |
| ask ≤ bound | 6,064 | 0.590 | 0.703 | 0.514 | 87% of ask |
| ask ≤ bound | 3,527 | 0.792 | 0.914 | 0.705 | 89% of ask |
| ask > bound | 15,972 | 0.620 | 0.511 | 0.447 | 88% of BOUND |
| ask > bound | 20,570 | 0.786 | 0.539 | 0.555 | 103% of BOUND |

**The compiler is at the physical limit whenever the ask is hard and leaves half
of an easy ask on the table** — on contacts carrying 0.21–0.34 of bound
headroom. It is not a capability ceiling and not a budget question: the bias is
−0.170 / −0.174 / −0.169 at 250k / 500k / 750k.

Two more measurements make it steering rather than ranking:

- **No axis trade.** Within one (spec, gap) across seeds, a larger delivered
  impact correlates −0.14 with |speed error| and −0.03 with |air error|. Impact
  accuracy is very nearly free, and across seeds a lower impact rms goes with a
  HIGHER run score (r = −0.71).
- **The pool already contains it.** Per contact, the best of 24 runs delivers
  +0.144 more impact than the mean run; 41.5% of contacts are hit by at least
  one run and 3.4% on average. Replacing each contact by its own best-across-runs
  value takes impact rms 0.212 → 0.104.

### The reframing this forces: validity is an +11 prize, impact is a +67 one

Priced on the same instrument, giving **every** invalid run the mean score of
its own (spec, budget) valid runs is worth **+11.3** headline (498.91 → 510.21).
That is the whole of the `frontier_dense_recovery` capability debt that the
previous entry names as "the largest single prize left", plus every other
invalid run in the suite, and it is a sixth of what the impact bias costs.

The arithmetic is the aggregation's: `capability` is 15% of the headline and its
`dense_recovery_frontier` group is one of three, while impact is 30% of the axis
weight on all 44 cases at all three budgets. Nothing about the earlier
diagnosis was wrong — the deficit is real and its shape was correctly
identified — but it is not where the headline is.

### The mechanism: a hand-placed onset in the carrier's ask ramp

`arc_placement.ts impactCurvePressure` is
`smoothstep((ask − 0.25)/0.40) * smoothstep((speed − 6)/4)`. Observed speeds are
9–11.4 px/frame, so the speed factor is 0.94–1.00 and inert; the ask factor is
**0.04 at a 0.30 ask and 0.32 at 0.40**, reaching 1 only at 0.65. That pressure
scales the whole carrier: the contact-angle flatten (18°), the front-loaded
post-contact curvature (−1.6), the post-turn sampler and the template lane.

The delivered share of the ask tracks that pressure, not the ask:

```
ask 0.62-0.75   P=0.0 -> 0.195   P=0.6 -> 0.474   P=0.8 -> 0.673   P=1.0 -> 0.766
ask 0.50-0.62                    P=0.4 -> 0.555   P=0.6 -> 0.688   P=0.8 -> 0.789
d(achieved)/d(ask)  = 0.25 inside the dead zone, > 1.0 across the ramp
```

Hypothesis: the ask→pressure map, not the carrier's authority, is what leaves
the reachable asks unserved. Boundary: one continuous map from an authored input;
no case identity, no budget or failure keying.

### Falsified first, cheaply

`LOCAL_IMPACT_COST_WEIGHT` (`LR_IMPACT_LOCAL_W`, flat 0.5) is a documented,
deliberate 2:1 divergence from the scorer's equal axis weighting. Setting it to
1 at N=8 (1,056 candidate compiles, 7m17s) moves **nothing**: delta −0.02,
validity identical 974/1056, and the impact bias is unchanged to four decimals
(−0.1713). It survives only as a tiebreak, exactly as §5.7 of
`BALLISTIC_READINESS_DECISIONS.md` predicted. Retired.

The same run established the reference point: the tree at `85e9d96` is
**bit-identical** to the accepted baseline (delta +0.00 on every budget, stratum
and case, validity 974/1056 → 974/1056), so the `arc_model.ts` /
`arc_vector_model.ts` drift noted in §13 of the decisions doc is behaviourally
inert and every arm below is attributable.

### Batch 1 — the carrier's ask pressure is refuted, monotonically

Five arms at N=8 (1,056 candidate compiles each, ~7m15s each, ~37min total),
all env-configured against the same cached baseline prefix. The carrier arms
move the ask→pressure map's onset to 0 and vary where it reaches full pressure.

| arm | headline | delta | valid | representative | capability |
|---|---:|---:|---:|---:|---:|
| onset 0, full at 0.65 | 498.08 | −0.83 | 974→1007 | −11.94 | +57.29 |
| onset 0, full at 0.45 | 478.23 | −20.68 | 974→1011 | −36.32 | +50.58 |
| onset 0, full at 0.30 | 460.15 | −38.77 | 974→1012 | −54.01 | +28.38 |
| pop-arrival on at every budget | 488.32 | −10.59 | 974→971 | −8.85 | −24.29 |
| steep-arrival band 0.6→0.25 | 498.91 | **+0.00** | 974→974 | +0.00 | +0.00 |

**The mechanism is confirmed and the lever is refuted.** Paired on the 969 cells
valid in both arms, the first carrier arm does exactly what the hypothesis
predicted in the band it targets — delivered impact at a 0.25 ask +0.014, at a
0.36 ask +0.019, band rms −0.005 and −0.014 — and then loses more elsewhere:

```
                     ask 0.25   ask 0.36   ask 0.61   ask 0.79   speed bias
onset 0 / full 0.65   +0.0136    +0.0185    -0.0434    -0.0274     -0.0257
onset 0 / full 0.45   +0.0238    +0.0338    -0.069     -0.056      -0.0604
onset 0 / full 0.30   +0.049     +0.043     -0.076     -0.074      -0.0802
```

Priced on the counterfactual instrument, the first arm decomposes as mid-band
gain **+5.3**, speed cost **−5.3**, high-band impact cost **−18.9**, validity
gain ~+18. So the carrier's scoop is not free: it brakes the rider, and it
flattens the launch that the NEXT contact has to arrive on. Turning at a contact
costs the speed axis and costs the following contact its arrival angle, and both
costs scale with the pressure while the gain saturates.

Two corrections this forces on the earlier reasoning:

- **"Impact accuracy is nearly free" was an artefact of the comparison.** The
  within-contact correlation of −0.14 against |speed error| is across SEEDS of
  one compiler — selection variation, where the pool's higher-impact members
  happen to be its better-behaved ones. A geometry change that manufactures
  impact pays for it. Selection variation does not price a mechanism.
- **The high band is worth 4x the mid band per unit of impact.** A 0.043 loss
  above a 0.5 ask costs 18.9 headline; the whole mid-band gain was 5.3. Any arm
  that touches impact must be read on both bands.

**Retired**: the carrier ask-ramp onset, in the direction of more pressure.
Also retired: forcing the impact-arrival pop arc on at benchmark budgets
(−10.59, and the impact bias does not move at all, −0.1713 → −0.1738), so the
V1-era dilution finding that set its fade still holds.

**Instrument defect found and fixed**: the steep-arrival arm was bit-identical
because `steepArrivalMatureZeroBand` returns `HARD_IMPACT_ZERO_BAND` (0.5) for
any spec whose authored max impact is ≥ 0.68, which is all 44 development cases.
The 0.6 constant the arm moved is unreachable on this suite. Both bands are now
env-tunable so a shadowed arm reports as a change of nothing rather than as
evidence.

### Batch 2 — the carrier is at a true optimum, and the arrival is the lever

| arm | headline | delta | valid | representative | impact bias | speed bias |
|---|---:|---:|---:|---:|---:|---:|
| carrier onset 0.35 (less scoop) | 492.22 | −6.69 | 974→969 | −0.74 | −0.1717 | −0.0226 |
| carrier onset 0.45 | 486.41 | −12.50 | 974→983 | −11.43 | −0.1830 | **+0.0016** |
| carrier OFF (onset 2) | 429.37 | **−69.55** | 974→1025 | −89.95 | −0.2267 | +0.0499 |
| post-turn onset 0.60→0.15, carrier gate off | 476.99 | −21.93 | 974→957 | −16.57 | −0.1755 | −0.0505 |
| **steep-arrival mature band 0.5→0.15** | **506.05** | **+7.13** | 974→980 | **+4.77** | −0.1696 | −0.0398 |

**The carrier's ask onset is a genuine local optimum**: 0.25 beats 0, 0.35, 0.45
and off, and the ablation prices the whole mechanism at **+69.5**. Two facts fall
out of the ablation that are worth more than the arm:

- **The speed undershoot IS the carrier.** Weaken it and the speed bias goes to
  zero (+0.0016 at onset 0.45, +0.0499 with it off) — so −0.045 of speed is the
  price the suite currently pays for its impact, knowingly or not.
- **The carrier's scoop is what kills `frontier_dense_recovery`.** With it off,
  that case goes 0→14 of 24 valid, its 240ms variant 1→14, `dense_dialogue`
  18→23, and total validity 974→1025. The documented capability debt is a side
  effect of impact steering, not of the contact-indexed refactor alone.

**Falsified: widening the post-contact launch angle.** Opening
`impactPostTurnExtraDeg` to mid-band asks and removing its carrier gate moves the
impact bias by 0.004 and costs 21.9 headline with 20 lost valid runs. The reason
is physical and settles a whole family of ideas: after the catch the rider LEAVES
the surface, so a wider post-contact angle just drops the line away beneath it.
Redirection can only come from velocity the surface can still turn — which means
it has to come from the ARRIVAL.

**The live mechanism: arrival vertical velocity.** Reading the feasibility bound
under a flat launch instead of a symmetric pop — fall for the whole airborne
share of the gap rather than rise and return — raises the mean reachable impact
from 0.575 to **0.650** against an achieved 0.374, and takes the reachable share
of asks from 54% to **66%**. Elevation is unauthored in this suite, so altitude
is a free axis and a dive is nearly free on the scored ones; air OVERSHOOTS by
+0.048, so spending airtime on falling rather than rising helps that axis too.
`STEEP_ARRIVAL` already inverts the metric properly (it computes the arrival
angle the next ask needs and pitches the launch down by the deficit), but it is
gated to attempt > 0, asks ≥ 0.30, a 15° cap, and half the attempt span. Opening
only the span is +7.13 with representative +4.77 [+2.34, +7.20] and
development_music +7.64 [+1.90, +13.38] — every stratum positive, six valid runs
gained, and both the impact and speed biases improved together for the first
time in the campaign.

### Batch 3 — the candidate: the dive is the default shape, not a late variant

| arm | headline | delta | valid | representative | impact | speed |
|---|---:|---:|---:|---:|---:|---:|
| objective axis pooling rms→mse | 484.32 | −14.60 | 974→962 | −7.88 | −0.1683 | −0.0486 |
| mature span reserve 0.5→0 | 504.78 | +5.87 | 974→983 | +4.62 | −0.1692 | −0.0387 |
| span reserve 0.15 + 30° cap | 494.58 | −4.33 | 974→986 | −1.05 | −0.1709 | −0.0373 |
| span reserve 0 + 30° cap | 502.81 | +3.90 | 974→1000 | −0.27 | −0.1733 | −0.0357 |
| **span reserve 0 + every attempt** | **507.33** | **+8.42** | 974→984 | **+10.64** | **−0.1660** | **−0.0370** |

The winner is the only arm in the campaign with three of four strata
significantly positive: representative +10.64 [+8.14, +13.14],
legacy_regression +12.71 [+6.33, +19.08], development_music +10.76
[+5.81, +15.72]. `capability` reads −5.59 with a ±104 interval, which is the
stratum §7.1 of the decisions doc already records as unable to rank arms at these
seed counts. Impact bias −0.1713 → −0.1660 and speed −0.0446 → −0.0370 move
together, which no scoop arm managed.

Two brackets close the mechanism rather than leaving it open: raising the 15°
delta cap to 30° is negative at both span settings (−4.33, +3.90 against +7.13,
+5.87) because a bigger dive buys the arrival with air (+0.062 air bias), and
attempt-0 exemption costs 2.5 points, so the dive belongs in every pool member
rather than in the late attempts only.

**Also falsified: aligning the search's axis pooling with the scorer's.**
`proposalUtility` multiplies per-gap `exp(-rms/T)`, so the search orders
candidates by a sum of square ROOTS while the scorer orders a run by a sum of
SQUARES; the root form is concave, prefers concentrating error in one gap, and
its per-axis gradient saturates at `1/sqrt(k)` once one axis dominates — which is
impact on 54% of the weighted error. Replacing it with `exp(-mse/T^2)` (same
value at `rms = T`, same ordering within one gap, different trade between gaps)
does move the axes in the predicted direction: impact bias −0.1683, high-band
0.79-ask bias −0.2029 against −0.2096, best of any non-arrival arm. It costs
14.60 headline anyway, through 15 lost valid runs concentrated on
`frontier_pickup_progression` (−271.94). The argument survives; the form does
not, and `score.ts` was never touched so the suite identity is intact.

### The candidate, as a source default

Baked into `arc_placement.ts` rather than left as a knob:

- the steep-arrival dive applies at **every attempt**, not only after the first;
- the mature share of the attempt span reserved for undived launches is **0**,
  which deleted `steepArrivalMatureZeroBand`, its two hard-impact constants, the
  unreachable general band, and the `setSteepArrivalSpecMaxImpact` plumbing in
  `handoff.ts` — the branch was dead, since all 44 development cases author a max
  impact of at least 0.86 against its 0.68 threshold;
- scarce budgets keep their own 0.25 reserve, which the canonical suite never
  exercises (lowest tier 250k) and which protects completion where the search has
  no room to recover.

Every refuted knob was reverted to its shipped constant with the measurement
recorded in its comment, so the diff is the mechanism plus evidence and nothing
else. Full test suite: 864 passing. `verify:optimizer` now differs from its
recorded baseline by design.

### N=48 — ACCEPTED, +11.29

`npm run benchmark -- eval --seeds=48 --jobs=48`, 6,336 candidate compiles,
42m54s, zero baseline compiles:

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
  development_music   +8.26  [ +6.19, +10.33]
  capability         +11.46  [-12.40, +35.32]
largest improvements  low_air_endurance_7s +56.75 (valid 140->143),
                      low_air_endurance +36.49, pickup_progression +33.04
                      (valid 85->91), _4s +31.79, _6s +22.04
largest regression    pickup_progression_shifted -11.59 (valid 78->79)
```

Everything a promotion should check is coherent. All four strata positive and
three of them significantly so; all three budgets positive; the effect is
monotone in scarcity (+14.78 at 250k to +7.65 at 750k) which is what a mechanism
that supplies a physically missing quantity should look like — it helps most
where the search has least room to find the shape by luck. Nothing is traded:
the single regression is −11.59 against improvements up to +56.75, and
`frontier_dense_recovery` goes 6→20 of 144 valid with its 240ms variant 7→16, so
the documented capability debt moved in the right direction as a side effect
rather than being paid for.

Promoted with `rebaseline --label=steep-arrival-default`.

## 2026-07-27 — the arrival vein pays again: the ask floor is not a limit

Every dial on the steep-arrival lever is positive against the new baseline
(N=8, 1,056 candidate compiles each):

| arm | headline | delta | valid | representative | capability |
|---|---:|---:|---:|---:|---:|
| ask floor 0.30 → 0.15 | 526.33 | **+19.00** | 984→1005 | +11.50 [+9.54, +13.47] | +71.91 |
| ask floor 0.30 → 0 | 526.43 | **+19.09** | 984→1005 | +11.63 [+9.72, +13.55] | +71.91 |
| delta cap 15° → 18° | 515.91 | +8.58 | 984→986 | +0.66 | +51.72 |
| delivery efficiency 0.68 → 0.5 | 514.87 | +7.54 | 984→992 | +1.58 | +45.79 |
| ride-out span floor 0.5 | 512.33 | +5.00 | 984→982 | +2.27 [+0.29, +4.24] | +23.43 |
| ride-out blend strength 1 | 505.32 | −2.02 | 984→979 | +0.79 | −4.65 |
| ask floor 0 + delta 18° | 528.31 | **+20.98** | 984→1011 | +13.46 [+10.92, +16.00] | +73.43 |
| ask floor 0 + efficiency 0.5 | 531.26 | **+23.93** | 984→1009 | +12.50 [+10.57, +14.43] | **+101.41 [+36.53, +166.30]** |
| ask floor 0 + ride-out floor 0.5 | 522.13 | +14.79 | 984→1000 | +12.24 | +39.55 |

**The 0.30 ask floor was pure cost.** Removing it entirely is the same as
lowering it to 0.15 (+19.09 vs +19.00), which is what should happen if the floor
was never doing anything but suppression: the dive is computed as
`needed arrival angle − predicted arrival angle`, and that difference already
goes to zero on its own for a small ask. The constant only stopped the formula
from being consulted.

**And the gain is not (only) impact.** The impact bias barely moves (−0.1660 →
−0.1673) while `dense_dialogue` gains +112.19 and goes 20→24 of 24 valid, its
contrast variant +108.83 and 18→24, `frontier_pickup_progression` +167.13 and
16→19. On a short gap a flat or rising launch flies past the beat and the catch
misses; a small downward pitch lands the rider on time. So the same lever that
supplies redirection on a long gap supplies TIMING on a short one, which is why
the dense specs — the standing capability debt of this campaign — move first.

### Batch 6 — four ways to deepen the same dive, and why the headline cannot rank them

All on top of the removed ask floor, N=8:

| arm | delta | representative | capability | valid |
|---|---:|---:|---:|---:|
| delivery efficiency 0.4 | +24.67 | +12.97 [+10.50, +15.45] | +103.26 [+46.37, +160.15] | 984→1016 |
| delivery efficiency 0.5 | +23.93 | +12.50 [+10.57, +14.43] | +101.41 [+36.53, +166.30] | 984→1009 |
| **span floor 0.5** | **+21.36** | **+18.08 [+15.43, +20.73]** | +50.64 [−33.24, +134.51] | 984→1012 |
| efficiency 0.5 + span floor 0.5 | +20.50 | +11.58 [−3.63, +26.79] | +79.03 | 984→1021 |
| efficiency 0.6 | +13.29 | +12.66 [+11.34, +13.98] | +29.37 | 984→999 |

Every one of these deepens the average dive and they are **substitutes, not
complements** — combining efficiency 0.5 with the span floor is worse than
either alone. Their headline deltas sit inside one standard error of each other,
which is exactly the situation §12.2 of the decisions doc says a small screen
cannot resolve.

So the choice is made on `representative`, which is 70% of the headline and the
stratum with an interval narrow enough to mean something: **the span floor is
+18.08 against +11.6 to +13.0 for the others**, and the arms that beat it on the
headline do so entirely through `capability`, whose interval spans ±100 here.
The span floor also has the cleanest statement — the pool's mean member should
carry the dive the ask needs, not half of it — and it is bracketed on both sides
(efficiency 0.6 +13.29, the ride-out analogue at full strength −2.02).

### Batches 7-9 — the vein is now bracketed on every side

Re-measured against `dive-span-floor`, all N=8:

| arm | delta | representative | verdict |
|---|---:|---:|---|
| carrier onset 0.15 | −0.23 | −10.66 | the ramp's optimum did NOT move |
| carrier onset 0, full at 0.65 | +0.54 | −13.20 | idem |
| dive span floor 0.75 | −10.42 | −5.10 | 0.5 is bracketed above |
| dive span floor 1.0 | −14.34 | −12.97 | idem |
| delivery efficiency 0.5 | −0.86 | −6.50 | substitutes with the span floor |
| template arrival angle 8°→4° | −5.50 | −0.63 | closed |
| template lane rate ⅓→0.66 | −4.06 | −6.14 | closed |
| template attempt ramp 6→2 | −6.63 | −0.00 | closed |
| template pressure gate 0.35→0.2 | +0.34 (SE 0.38) | +0.61 | inert |
| all three template gates open | −17.47 | −12.80 | closed |
| carrier front-load 1.6→2.0 | +1.75 | +0.29 | noise |

Two of these were worth running for what they rule out rather than what they
find. The **carrier re-sweep** was justified — the scoop's cost is
arrival-dependent, so its optimum could have moved once every arrival carried a
dive — and it did not move at all, which closes that ramp for good. The
**template gates** are the converting half of the mechanism (the dive supplies
the vertical velocity, the valley is the surface that turns it), so steeper
arrivals should have wanted more of them; every gate is at or past its optimum
instead.

### 2026-07-27 — what the impact metric actually measures, and the measurement that follows

The campaign has been reasoning about impact from the doc comment. The
implementation says something narrower (`substrate.ts redirArcPxAtLanding`):

```ts
v0 = velocityAt(landing - 1);  aIn = atan2(v0.y, v0.x)
for (f = landing; f <= landing + W; f++) turn = |wrapPi(angle(v(f)) - aIn)|   // ASSIGNED
return |v0| * turn
```

`turn` is assigned, not accumulated, so the scored quantity is **endpoint to
endpoint**: the CoM heading at exactly `landing + 6` against the heading one
frame before the contact, scaled by the arrival speed. Four consequences, two of
which contradict things this campaign has assumed:

1. **The path inside the window is invisible.** A turn achieved and given back
   scores what remains at the deadline; a gradual turn and a snapped one score
   the same. So "sharpness" is not rewarded — which is why the front-load arms
   are flat (+1.75, −2.13). That lever redistributes rotation *within* a window
   the metric cannot see inside.
2. **The window is a deadline.** A turn still in progress at +6 is counted
   partially.
3. **Only the arrival SPEED enters as the multiplier**, not the arrival angle.
   The angle enters only as the "from" end of the difference.
4. It is absolute and wrapped, and CoM-only.

**The measurement.** `npm run study:impact-window` re-simulates committed tracks
and records the turn at every frame of the window, the maximum reached, and
whether the rider is supported. 417 contacts, six specs, 250k:

```
frame   +0     +1     +2     +3     +4     +5     +6
turn   0.91°  1.98°  6.10°  9.81° 12.89° 14.61° 15.83°     still climbing at the deadline
air     0%     3%     6%     7%    18%    25%    32%       separation begins at +4
```

- **give-back is 0.002 impact units** and the peak is AT the deadline on 89% of
  contacts. The shortfall is a truncation, not a loss.
- Split by whether the rider held contact through the window, at an identical
  mean ask (0.539 vs 0.540): supported delivers **0.449**, separating delivers
  **0.358** — 25% more impact for the same request. Per spec the ordering
  follows: `believer_impact_56s` is 3% airborne and delivers 98% of its ask;
  `dense_dialogue` and `frontier_pickup_progression` are 18-23% airborne and
  deliver 52-53%.

So impact accrues at ~2-3°/frame **only while the rider is supported**, and the
compiler separates two frames before the measurement is taken.

**Why it separates, and the ceiling that follows.** Separation distance
discriminates the two candidate causes, because the sampled ride-out is 28-220px:

```
separates at   +1     +2     +3     +4     +5     +6    never
distance      9.7px  20.9   31.1   41.6   53.2   63.3     -
delivered/ask  36%    49%    46%    59%    61%    68%     82%
```

Every extra supported frame is worth 0.05-0.08 of delivered impact, and the
median separation is at **43px**. Forcing a hard 60px floor on the ride-out —
`IMPACT_WINDOW * speed`, the length that would hold the rider to the deadline —
changes the distribution by **nothing**:

| support floor | p50 separation | airborne at +6 | achieved |
|---|---:|---:|---:|
| off | 43px | 50% | 0.283 |
| ask-scaled | 42px | 50% | 0.289 |
| hard 60px | **43px** | **52%** | 0.291 |

So the rider is not running out of line — it leaves a surface that is still
there.

**And the metric does not require contact at any frame**, which is where a
tempting conclusion has to be resisted. `impact` is `∠v(+6)` against `∠v(-1)`;
a turn delivered in two frames and then coasted loses only what gravity unwinds,
`g/|v| ≈ 1.0°` per airborne frame. So "the window and the flight compete for the
same frames" does NOT follow from separation alone, and was written here before
it was checked.

Checking it splits the population in two. Turn AFTER the rider leaves, by the
frame it left:

```
left at +1 (n=22):   1.5° -> 5.5°     +0.81 deg/frame after leaving
left at +2 (n=27):   4.7° -> 8.9°     +1.05
left at +3 (n=36):   3.8° -> 6.3°     +0.83
left at +4 (n=59):  12.1° -> 13.4°    +0.64
left at +5 (n=63):  15.1° -> 15.6°    +0.55
```

`g/|v|` is ~1.0°/frame, and for the early-separating groups it accounts for the
ENTIRE measured turn: `1.5 + 5 × 0.81 = 5.5`. Gravity steepens a free-falling
rider's heading away from its arrival heading, and the absolute-value metric
reads that as redirection.

### The frontier: `v · dtheta` is near-conserved, and that explains eleven batches

Incidence — the angle between the touched surface and the arrival heading — is
what separates the two populations, and it survives controlling for the ask:

```
ask band       glancing incidence -> achieved      engaged incidence -> achieved
0.20-0.35            1.53 deg -> 0.107                  5.26 deg -> 0.154
0.35-0.50            0.96 deg -> 0.117                 11.50 deg -> 0.262
0.50-0.70           18.39 deg -> 0.339                 19.21 deg -> 0.491
0.70-1.01           16.51 deg -> 0.357                 21.56 deg -> 0.596
```

Delivered impact tracks incidence across bands, which is what the physics
demands: the rider leaves along the surface it met, so `dtheta` is about the
angle that surface makes across the arrival. That gives the metric's inverse
directly — to deliver `X` at speed `v` the surface must sit `X * 7.29 / v`
radians across the arrival, 14.6 degrees for a 0.35 ask at speed 10, against the
5.3 the mid band gets.

The compiler cannot express that today: `contactAngleDeg` is a WORLD-frame angle
nudged by `impactCurveP * 18`, while the quantity that turns the rider is
`contactAngle - arrivalHeading`. So an incidence-targeted contact angle was
implemented and measured:

| incidence aim | engaged incidence | turn at +6 | speed at contact | achieved |
|---|---:|---:|---:|---:|
| 0 (shipped) | 13.26° | 11.1° | 10.16 | 0.283 |
| 0.5 | 14.98° | 13.1° | **8.13** | 0.275 |
| 1.0 | 21.73° | 17.9° | **7.46** | 41 of 240 contacts still land |

**It works and it does not pay.** The turn rises 18%, the contact speed falls
20%, and the score is their PRODUCT. Bending the trajectory costs speed at close
to the rate it buys angle, so `redirArc` is near-conserved along this axis — one
frontier, found eleven times. The carrier ramp in both directions and twice, the
flatten, the front-load, the post-turn widening, the template gates and this are
not eleven independent failures.

**The other factor, tested, and the frontier closes from both sides.** `v` in the
metric is the speed ONE FRAME BEFORE the contact while the speed AXIS scores the
MEAN over the gap, so arriving above one's own gap mean is impact the speed axis
cannot see. Aiming the energy-targeted launch above the gap's speed ask in
proportion to the next contact's impact ask is **byte-identical** at gains of
0.15 and 0.30 — because the launch is already saturated at its descent clamp:
`vyClamped = clamp(vyTarget, -0.92gN, 0.45gN)`, and on a dense gap the energy
target wants 1.46 against a cap of 0.79.

That cap is the real lever, and it bounds both factors at once — a harder dive
arrives faster AND steeper. Opening it does nothing either:

| descent cap | delivered impact | speed one frame before contact |
|---|---:|---:|
| 0.45 (shipped) | 0.283 | 10.55 |
| 0.7 | 0.284 | 10.54 |
| 1.0 | 0.289 | 10.49 |

The pool gains steeper-launch candidates and **the search does not commit them**.

### The way through the frontier: stop paying for the turn

If turn and speed trade at 1:1, the question is not how much to turn but what the
turn COSTS — and the cost is discrete. The redirection is delivered by a
POLYLINE, and every vertex is a collision impulse. `segmentLength` is sampled
12-40px, so the six-frame window — about 60px — spans only two or three
vertices: the turn arrives as a few slams rather than a curve.

Grain is UNAUTHORED in the canonical distribution, so line length is a free axis
exactly as elevation is, and spending a free axis is what both accepted changes
of this session did. Subdividing the post-contact branch in proportion to the
contact's ask:

| refinement | headline | representative | development_music | capability | speed rms |
|---|---:|---:|---:|---:|---:|
| 0 (shipped) | — | — | — | — | 0.0985 |
| 1 | **+6.42** | +1.33 [−8.62, +11.27] | +5.00 | +36.05 | 0.0858 |
| **2** | **+3.70** | **+3.83 [+1.75, +5.90]** | **+8.09 [+0.65, +15.54]** | +3.62 | **0.0841** |
| 3 | +0.82 | +5.09 [+2.82, +7.37] | +9.06 [+4.01, +14.11] | −23.84 | 0.0812 |

The ladder separates by SHAPE, not by headline: `representative` and
`development_music` rise monotonically with refinement while `capability` — the
stratum whose interval spans ±90 here — falls and carries the headline with it.
Rung 2 is the only one with no stratum negative and two significantly positive.

**It is the only arm in the campaign that moves every axis the same way.** Speed
bias −0.0226 → −0.0124 and its rms 0.0985 → 0.0841, air, impact and amplitude all
better; and on the window instrument the contact speed rises 10.55 → 10.72 while
the turn holds. That is precisely what the frontier predicts a smoother turn does
— it buys back the speed the impulses were spending — which is why this lever is
not the eleven that preceded it. `sparse_lowline` also recovers (+21.26, +27.46),
the group the accepted dive had cost.

### The glancing 22% cannot be commanded either

The one population left unattacked was the 22% of contacts that meet their
surface at about one degree and are never turned. Aiming every contact at the
incidence its ask needs fails by paying the speed cost everywhere, but a
one-sided FLOOR binds only on that population and leaves the rest untouched.

The floor has to be the incidence the ask NEEDS, capped — scaling a cap by the ask
defeats it exactly where the glancing contacts live, since at a 0.25 ask a
6-degree cap becomes 1.5 degrees. With `neededTurnDegForImpact` as the floor and
a cap swept off / 5 / 8 / 12 degrees:

| cap | mid-band incidence | delivered (all) | turn at +6 | give-back | peak-at-deadline |
|---|---:|---:|---:|---:|---:|
| off | 1.78° | 0.291 | 11.3° | 0.002 | 90% |
| 5° | 3.07° | 0.260 | 10.4° | 0.003 | 84% |
| 8° | 6.61° | 0.247 | 10.2° | 0.009 | 71% |
| 12° | 10.29° | 0.234 | 10.4° | 0.012 | 63% |

**Incidence rises and the measured turn FALLS**, while give-back climbs sixfold
and the peak stops arriving at the deadline. Forcing a surface across the arrival
makes those contacts EJECT rather than redirect: the rider is thrown, and
free-flight rotation unwinds the turn before it is read. So the one degree is
what those contacts can sustain, not a command the compiler failed to give — and
the give-back mechanism this campaign hypothesised early and could not find does
exist, but only when the geometry is forced past what it can carry.

### The search's own reasons are earned, not obstacles

The frontier's second half is that the search DECLINES the aggressive shapes, so
the natural follow-up is whether the factor doing the declining is informative.
`airFit` was already excluded from the readiness product on exactly that argument
and measured better, so there is precedent and an existing mechanism
(`LR_READINESS_STUDY_ABLATION`, no source change needed). Both remaining
candidates are load-bearing:

| ablation | headline | representative | legacy_regression |
|---|---:|---:|---:|
| without `impactFeasibility` | −7.98 | −8.72 [−10.71, −6.74] | −13.42 [−18.27, −8.58] |
| without `speedFit` | −17.28 | −14.84 [−17.59, −12.09] | −14.06 [−20.48, −7.63] |

So the readiness product is not over-constraining the search out of ignorance —
`impactFeasibility` in particular is the factor that would have to be wrong for
"the search declines faster arrivals" to be a modelling error, and removing it
costs 8 points with two strata significantly negative. `airFit` was the one
uninformative factor and it is already gone.

### The reservation pattern was the LEVER, not a principle

With the impact bias fixed (below), the remaining priced headroom is air, speed,
amplitude and validity — and amplitude had never been touched. It carries exactly
the double reservation the steep-arrival dive did: a hand-placed 0.30 onset below
which the pop-arc shaping is not commanded at all (roughly two thirds of authored
amplitude sits at or under it) and an attempt span whose mean member takes half.

Deleting the dive's ask floor was +19.09 and lifting its span to 0.5..1 was
+21.36. The same two moves on amplitude are **-1.16 and -0.85**, with
`development_music` significantly negative in both (-3.93, -4.69), even though the
amplitude bias does improve slightly (-0.1251 -> -0.1207). The ride-out length's
analogue behaved the same way earlier (+5.00 at a 0.5 span floor, -2.02 at full
blend strength).

So "a physically-derived shape is reserved to part of the attempt span and should
not be" is **not a general principle of this sampler**. Only the arrival carried
it — consistent with the arrival being the one input the scored impact reads
directly. (The combined amplitude arm is void: the source was edited while it was
running. The two single arms agree, so it was not re-run.)

**A workflow note worth keeping.** Mid-session the WASM artifact was rebuilt by
something in the toolchain, and `eval` correctly refused every comparison with
`engine artifact differs from the retained baseline`. Behaviour was unaffected —
`verify:optimizer` and the full suite passed on the rebuilt binary — so this was
build reproducibility, not drift. The recorded bytes are retained inside the
baseline's own compiler snapshot (`benchmark/v2/runs/<label>-compiler-snapshot.tar.gz`
contains `engine-rs/target/.../lr_engine.wasm`), and restoring them from there
returns the fingerprint exactly and unblocks comparisons.

### The impact bias is a FIXED POINT of this geometry

The strongest form of the result, and it reframes the +67 the pricing instrument
found. Mean impact bias across every arm measured this session:

```
arm                        impact bias   speed bias   speed rms   headline
segment-refine (accepted)     -0.1661      -0.0124      0.0841      532.40
carrier onset 0 / full 0.65   -0.1804      -0.0486      0.1055      529.23
carrier onset 0.15            -0.1750      -0.0454      0.1036      528.46
dive span floor 0.75          -0.1671      -0.0186      0.0990      518.27
dive span floor 1.0           -0.1675      -0.0162      0.1037      514.35
steep efficiency 0.5          -0.1697      -0.0234      0.0988      527.83
global segment refine 1.5     -0.1661      -0.0121      0.0843      530.51
global segment refine 3       -0.1661      -0.0124      0.0844      531.61
post segment refine 1         -0.1647      -0.0139      0.0858      535.11
post segment refine 3         -0.1649      -0.0093      0.0812      529.51
```

**The impact bias spans -0.1647 to -0.1804 — at most 1% — across the entire
lever family**, including the arms that were accepted. The headline moves 514 to
535 across the same set, entirely through validity and the OTHER axes. The best
impact bias any arm produced is 0.0014 better than the baseline's.

So the +67 that debiasing impact prices is **not available to arc shaping**. The
counterfactual instrument was correct about where the error IS and silent about
whether it is reachable; twenty arms answer that question. This is why every
mid-band lever measured flat: not eleven coincidences, and not even one trade —
a fixed point.

**What that makes reachable.** With the impact bias fixed, the remaining priced
headroom is air +1.7, speed +0.2, amplitude +3.1 and validity's +11 ceiling —
about +16, so roughly **548** as this compiler family's realistic ceiling on this
suite. That is a falsifiable prediction, not a resignation: any candidate that
takes the headline materially past it must move the impact bias, and nothing in
this vocabulary does.

### The frontier, stated

So both factors of `v * dtheta` are closed from opposite directions: pushing
the angle is cancelled by braking, pushing the speed is cancelled by selection.
The compiler is on the efficient frontier of this metric at this operating point,
and the remaining impact headroom is not reachable by a stronger single-axis
command. What would move it is a change to what the SEARCH is willing to commit —
the same admission-versus-score trade §5.10 of the decisions doc priced at −25
when it was pushed the other way — or a geometry family that produces incidence
without braking, which is not in the current arc vocabulary.

**So 22% of scored contacts — 85 of 383 — are GLANCING.** They touch, are not
turned at all, free-fall through the rest of the window, and deliver ~0.15
against asks of ~0.3-0.4. The contacts that stay supported past +4 have genuine
12-17° turns. The mid-band shortfall that resisted every lever in batches 1-11 is
two pooled populations: real catches that under-turn, and catches that never
engage. Nothing measured so far distinguishes the second geometrically; the
candidate quantity is the arrival heading against the contact surface angle at
the landing point, which is what the carrier's flatten is supposed to control.

At full strength the support floor did measure +6.85 headline at N=8 (+6.60 with
the flight knee), but entirely through `capability` — interval ±110 at that seed
count — with `representative` +0.81 and the impact bias unmoved. An unexplained
gain on the one stratum that cannot rank arms is the shape §7.1 of the decisions
doc warns about, so it is recorded and reverted rather than promoted.

**Also measured, and left as a lead.** The one group the accepted dive regressed
is `sparse_transition` (−14.26), and conditioning the dive on the gap's flight
share recovers it exactly (`sparse_lowline` +23.80, its variant +23.81) while
costing more elsewhere, monotonically: exponent 0.5 → −10.08, 1 → −26.97, 2 →
−53.09. A knee form that binds only where there is no flight is the right shape;
at 0.3 it is inert (−0.04) because almost every flight share is above it. The
binding knee is worth at most the ~+2 that group carries.

### What is left, priced on the new operating point

Re-scoring the `dive-span-floor` archive under counterfactuals:

```
debias impact  (-0.166)   598.82  (+70.13)      impact -> min(ask, bound)  605.19 (+76.50)
debias air     (+0.056)   530.45   (+1.75)      debias ALL axes            606.64 (+77.95)
debias speed   (-0.023)   528.88   (+0.19)      speed is nearly SOLVED - the dive
debias amplitude(-0.125)  531.80   (+3.10)      took its bias -0.045 -> -0.023
```

**Impact still holds every remaining point, and it is all in one place.** By ask
band, delivered share of the ask: 0.25 → 53%, 0.36 → 53%, 0.61 → 79%, 0.79 →
74%, 0.93 → 68%. The mid band is **immovable by every arrival lever measured** —
all three best arms leave it at 0.134-0.135 on a 0.25 ask and 0.188-0.189 on a
0.36 ask, to three decimals — while carrying 0.21-0.34 of feasibility-bound
headroom.

The one mechanism that does move it is the carrier's scoop, and that is priced:
it buys mid-band impact at +0.014 to +0.053 and pays −0.026 to −0.080 of speed
bias plus −0.043 to −0.076 of the NEXT contact's impact. Its optimum has now been
confirmed twice, before and after the arrival change.

So the next attempt needs a way to turn the rider sharply INSIDE the six-frame
scoring window without dragging it around a curve. The front-load lever is
exactly that idea and it is flat here, which suggests the limit is not how the
existing rotation is distributed but that the rotation is not there to
redistribute. A geometry that ends the approach and starts the departure at
different angles — a corner rather than an arc — is the untested shape.

**Next**: the arrival vein is open and the brackets say where. The 15° delta cap
binds on high asks (the deficit is typically 24°) and 30° fails because it buys
the arrival with AIR (+0.062 bias) — the rider must stay aloft until the beat, so
a deeper dive lengthens the flight. The physical way out is to buy the arrival
with SLOPE instead of flight time: pair the dive with a LONGER grounded ride-out
so the same vertical velocity is reached in fewer airborne frames.
`blendPostTowardPopArc` currently does the opposite (it shortens the ride-out to
give the flight room), and `postLength` is a sampled distribution modulated by
the air ask rather than an inversion of it — `grounded_frames = (1 - air) * N`
is available in closed form and untested.

## Current mechanism: ballistic launch read

Hypothesis: the short-probe launch read uses the correct discrete free-fall
law, but its constant vertical correction may be slightly miscalibrated for
the six-body-point rider aggregate. The source-default candidate changes
`LAUNCH_VY_OFFSET_PX` from `0.0345` to `0.043`. Boundary: the shared launch
state read only; no case identity or failure-specific behavior.

Mechanism evidence:

- The equal ten-point body+sled aggregate follows the engine's discrete
  ballistic law to floating-point precision in collision-free flight.
- The public six-body aggregate oscillates around that conserved center due
  to articulation.
- Assembly-center and rotation corrections reduced clean-flight coordinate
  error but worsened fitted next-state prediction through the production
  response model.
- Cross-seed state-dependent corrections were unstable and were retired.
- Focused launch-read/ballistic tests pass (37/37).

Retired probe screen:

- baseline 506.24, candidate 500.51;
- delta -5.72, seed-block SE 10.19;
- validity gained 1, lost 2;
- largest loss: shifted pickup progression -249.43.

Canonical cached N=100 comparison (13,200 candidate compiles, zero baseline
compiles):

- headline 512.82 -> 513.79, delta +0.97, seed-block SE 1.03;
- interval [-1.71, +3.65], result inconclusive;
- budgets: 250k +4.81, 500k -0.86, 750k +1.46;
- validity gained 118, lost 100;
- capability -2.74; largest regression was 7s low-air endurance -29.54.

Decision: retire `0.043` and restore `0.0345`. The point estimate was slightly
positive, but not resolved, not uniformly coherent, and came with a material
capability regression. It is not convincing evidence for promotion.

Workflow changes:

- comparisons are arbitrary-N, cache-backed, stateless, and candidate-only;
- the old accounting/certification workflow was removed;
- a cache-prefix validation bug found by N=2 smoke was fixed without
  recompiling candidate rows;
- the separate probe screen was removed: it cost the same 264 candidate
  compiles as canonical N=2, omitted 750k, used a different seed schedule, and
  was directionally misleading here;
- live progress now reports row counts only; canonical scores appear only
  after hierarchical aggregation.

Ballistic-predictor research now has its own objective and frozen-corpus
workflow in `ballistic-goal.md`. Keep direct prediction evidence there; return
to this campaign only when evaluating an integrated compiler candidate.

## 2026-07-25 — the contact-indexed pipeline is 26.6 behind, and why

The ballistic/readiness rework (`6d064b0`, `9ce9430`) is complete and internally
correct, but does not clear the accepted baseline. This entry records what the
deficit actually is, so the next attempt does not re-derive it.

### Where it stands

`npm run benchmark -- eval --seeds=3`, base `accept-2026-07-22T18-26-42Z-8565eddc`:

| | headline | delta | valid |
|---|---:|---:|---:|
| baseline | 517.92 | — | 391/396 |
| pipeline before the anchor work | 493.30 | −24.62 | 368/396 |
| pipeline at `9ce9430` | 491.31 | −26.62 | 364/396 |

The anchor work is −2.0 against a seed-block SE of 3.73 — noise — and is not
uniformly negative: `frontier_low_air_endurance_7s` improved by 101 points
(−137.1 → −35.6) and gained a valid run, because it corrected a runway gate
that had been measuring from an anchor up to three frames past the exit.

The deficit is not spread out. By stratum: `representative` +3.07,
`legacy_regression` +22.20, `capability` **−199.13**. On most of the suite the
new pipeline is fine or better.

### What the failure is

Four long/dense specs never finish a track. Every failing run:

```
budget_exhausted true    sim_frames 250508 / 250000
terminus rideStalled     reported_contacts 88/123
missing 55  -> always a CONTIGUOUS TAIL [68..122]
full_evaluations 0       first_completion_frame never
gap_backtracks 0         handoff_skips 0
```

`handoff_deepest_seen_gap` equals `gap_commits`, so the search reaches a gap it
cannot place a catch at and stops advancing; it then spends the remaining
budget on rescue attempts (57 on dense_recovery vs 0 on healthy cases). Zero
full evaluations means it never once scored a complete track — the entire
compile runs on partial estimates. Tripling the budget moves completion from 88
to 98 of 123 contacts, so this is not "slightly short of budget".

Frame accounting rules out the ballistic layer as the drain: the failing cases
spend LESS on forward-eval (18-23% vs 28-37%) and aim probes (16-17% vs 20-27%)
than healthy ones, and `frontier_dense_recovery` runs the least collision-free
work of any case measured (40,806 kernel frames against 250,508 engine frames;
`river_reentry`, which is healthy, runs 249,025).

### The proximate cause: candidate viability

At 250k, mean over seeds:

| case | baseline viable | now | commits | deepest |
|---|---:|---:|---:|---:|
| frontier_dense_recovery | 32.9% | **23.8%** | 98 → 69 | 102 → 71 |
| frontier_dense_recovery_240ms | 34.8% | 23.5% | 103 → 59 | 108 → 61 |
| frontier_pickup_progression | 42.8% | 26.0% | 106 → 71 | 106 → 71 |
| frontier_pickup_progression_shifted | 41.1% | 27.3% | 102 → 81 | 102 → 82 |
| dense_dialogue_impact_contrast_10 | 57.0% | 36.6% | 130 → 108 | 130 → 110 |
| amplitude_tides (control) | 68.8% | 68.2% | 97 → 97 | 97 → 97 |
| countercurrent (control) | 76.5% | 79.8% | 79 → 79 | 79 → 79 |

Committed depth tracks viability exactly, and healthy specs are untouched. It
is the LANDING gate specifically: `direct_landed` as a share of attempts falls
47.0% → 31.4% on pickup_progression while survival failures FALL (2.0% → 1.2%)
and off-beat is flat. Split across the two changes, baseline → pre-anchor →
now: 47.0 → 36.6 → 31.4 (pickup), 62.1 → 46.5 → 45.4 (dense_dialogue). Roughly
two-thirds arrived with the contact-indexed refactor.

### Falsified: approach aim

Hypothesis: `composeArcProposalTargets` moved the geometry sampler's APPROACH
shaping to the outgoing gap along with its ride-out shaping, and the approach
should read the incoming gap. Implemented in `3aea1b3`, reverted in `bd573cf`.

Wrong on both counts. The arc placed at a contact controls its own impact, its
own line lengths, and the entire ride from that contact to the next — the arc,
the exit, and the flight, all one gap. The interval ENDING at the contact was
shaped by the previous arc. So the composed bag is correct as written, and
`brakePressure` comparing the arriving speed against the OUTGOING target is the
right question ("how much must this catch brake or carry to deliver the gap it
opens"). The measurement agreed: landing rate did not recover (29.8% → 29.1%
on dense_recovery), committed depth got worse (69 → 51), headline 491.31 →
487.03.

### Open: `cost` scores the wrong gap

For an arc placed at a contact, the gap it OWNS is the one starting there.

| stage | aims at the owned gap? |
|---|---|
| geometry sampling | yes — motion from the owned gap, impact/grain from its own contact |
| pool objective | yes — settled(previous) x projected(owned) x readiness(next arc) |
| **`cost`** | **no** — `axisCost(previous gap targets, axes over the previous gap)` |

At the baseline, `cost` was computed over the lookahead window completed with a
ballistic suffix, so it could see the arc's ride-out. That window is active on
64%, 64% and 77% of gaps on the three worst-regressing frontier cases, so the
refactor removed a real signal there. `cost` still drives branch selection
(`handoff.ts:5122` `localScore`, sorted at `:3334/:3582/:3597`),
`pickLowestCost`, `cumulativeCost`, and the pool-sort tiebreak.

How much it matters is bounded by measurement, with `LR_AIM_STUDY_STATS=1`:

| case | objective defined | bail | top-1 disagreement vs cost |
|---|---:|---:|---:|
| frontier_dense_recovery | 98.5% | 1.5% | **23.0%** |
| frontier_dense_recovery_240ms | 98.4% | 1.6% | 22.0% |
| amplitude_tides | 98.7% | 1.3% | 8.8% |
| high_air_drive | 99.6% | 0.5% | 8.4% |

So the correct objective already orders 98.5% of the pool — `cost` decides only
the remainder there. But it is unconditional in branch selection and cumulative
path cost, and it disagrees with the objective about the best candidate nearly
3x more often on the failing specs.

Next step is to align `cost` with generation and the objective rather than to
keep a second definition, and to measure landing rate, viability and committed
depth on the five dense cases before any headline claim. Deferred until that
change is designed rather than guessed: today's falsified attempt cost a full
comparison run.

### Deliberately not done

- readiness corpus recollect + retrain. The guard correctly refuses the stale
  corpus (`readiness corpus sampler policy is stale`). Retraining ranks
  candidates; the failure is that viable candidates are not generated, so it
  would bake the current search behaviour into a new corpus for no gain.
- `verify:optimizer` re-baselining. Left diverged deliberately; re-baselining
  records acceptance and the compiler score is not yet acceptable.
- `EVALUATOR_FINGERPRINT` refresh. Live is `6d58e529b802`, the committed
  constant is `6f760d9c1cc9`, and it was ALREADY stale at `HEAD~1`
  (`31c8c167c6bf`). Golden-harness tripwire only; benchmark-v2 is unaffected.

### 2026-07-25 — bisect: the deficit is `cdba2d7`, and the ballistic work is exonerated

Hypothesis-free localisation. A Tier-0 screen (5 dense + 3 healthy cases, 250k,
2 seeds, ~2 min per state) run in a detached worktree at each buildable commit
between the accepted baseline and HEAD. `engine-rs` is unchanged across the
whole range, so one shared WASM binary keeps the comparison fair.

| commit | dense land% | dense viab% | **completions** | healthy land% | healthy viab% |
|---|---:|---:|---:|---:|---:|
| `02c7828` accepted baseline | 46.9 | 41.9 | **6/10** | 73.3 | 68.3 |
| `2d66844` articulated predictor | 45.8 | 40.6 | **8/10** | 73.6 | 68.8 |
| `8f73527` constraint predictor | 48.6 | 43.8 | **9/10** | 71.1 | 65.7 |
| **`cdba2d7` refactor pipeline** | **39.5** | **33.4** | **1/10** | 73.4 | 68.6 |
| `6d064b0` contact-indexed | 33.9 | 27.6 | **0/10** | 75.5 | 71.0 |
| `9ce9430` anchor = exit (HEAD) | 33.5 | 27.0 | 0/10 | 75.3 | 70.8 |

Healthy controls are flat across the entire range (71–76%), which is exactly the
control behaviour the screen needs to be trusted.

Three conclusions, none of which required a hypothesis:

1. **The ballistic predictor work is exonerated.** `2d66844` and `8f73527` are
   at or ABOVE the baseline on every column — 8/10 and 9/10 completions against
   the baseline's 6/10. Whatever costs the deficit, it is not the predictor.
2. **`cdba2d7` is the primary culprit**: 48.6 → 39.5 land, 43.8 → 33.4 viable,
   and completions collapse 9/10 → 1/10. That single commit carries most of it.
3. **`6d064b0` is a real but secondary second drop** (39.5 → 33.9), and
   `9ce9430` is noise (39.5 → 33.5 is within the 6d064b0 step).

Critically, **`cdba2d7` predates `arc_proposal.ts`** — it still aims the
geometry sampler at the literal `gap.targets`. So the composed-target aim, which
had been the leading suspect all evening, belongs to the SMALLER second drop and
cannot explain the big one.

File-level bisection inside `cdba2d7` does not work: it is one entangled
refactor, and reverting subsets produces chimeras that fail to compile
(`measure.ts` back to `8f73527` breaks `polish.ts`'s `measureGrainFromLines`
import; `aim.ts` back breaks on `OBJECTIVE_AIR_DEADBAND`). A revert of the whole
candidate-evaluation group (candidate + measure + substrate + polish) gave dense
land 33.0% — worse than `cdba2d7` itself, i.e. an incoherent mixed state rather
than evidence.

Next: mechanism-level measurement rather than file reverts. `cdba2d7` changed
the arc-exit detector (`firstAirborneExitFrame` → `firstCleanAirborneExitFrame`,
horizon-relative and much stricter), which changes how often the short-horizon
gap fit TRUNCATES. That matters for the gates, because a truncated fit clamps
the survival gate to the truncated horizon (`min(horizon, …)`) and narrows the
off-beat window, while a full-horizon fallback applies both at full width. The
screen now reports `trunc%` alongside the per-gate failure split so the bisect
can show it directly.

### 2026-07-25 — trajectory, not generation; three falsifications and two keeps

**The discriminator.** Per-gap viability, `8f73527` (healthy, 9/10 completions)
vs `cdba2d7` (broken, 1/10), same spec and seed, on two dense cases. At gap 0
both compilers start from an identical engine state, so the candidate SET is
generator-determined.

| band | 8f73527 | cdba2d7 | | 8f73527 | cdba2d7 |
|---|---:|---:|---|---:|---:|
| | *dense_recovery* | | | *pickup_progression* | |
| gaps 0–4 | 45.5% | **44.4%** | | 45.7% | **45.5%** |
| gaps 5–9 | 42.7% | **43.2%** | | 45.0% | **43.4%** |
| gaps 10–19 | 41.7% | 23.6% | | 41.9% | 31.5% |
| gaps 40+ | 28.2% | 17.9% | | 34.3% | 25.7% |

Early gaps are **identical**; divergence begins only once the trajectories
separate. **The generator is fine. The search commits worse catches.** This is
why the approach-aim arm failed — it changed generation, which was never the
problem.

**Falsified this session, with the measurement that killed each:**

1. *Approach aim from the incoming gap* — see the previous entry. Landing rate
   did not recover, depth got worse, headline 491.31 → 487.03.
2. *The deleted catch+8 release fallback dumps candidates to the bottom of the
   pool.* Measured objective-bail rates: `8f73527` 3.7% / 14.0% / 6.7% vs
   `cdba2d7` 4.0% / 2.0% / 9.0% on dense_recovery / pickup / amplitude_tides.
   `cdba2d7` is not systematically worse and is much better on pickup. Nearly
   all candidates ARE scored, so ranking blindness is not the mechanism.
3. *The scorer's RMS axis pooling compresses the projected term on short gaps.*
   Measured per-pool spread of each objective layer: the projected layer is
   MORE spread on dense specs (0.406, 0.419) than on healthy ones (0.267,
   0.469). Not compressed.

Also ruled out by the gate breakdown across the bisect: truncation rate ROSE at
`cdba2d7` (95.0% → 97.6%) rather than falling, and survival failures FELL
(2.8% → 1.4%). Only landing failures track the deficit: 39.0 → 42.7 → 46.6.

**Kept, both principled and measured, neither closing the deficit:**

- *Projected outgoing air is scored against the deliverable ask* (`e142a44`).
  Restores a physical constraint the pre-refactor readiness encoded as
  `effectiveAirAsk` and which survives as `airDeliverabilityAsk`, applied where
  ranking scores air. Binds on 47%/46% of dense gaps and 0% of healthy — the
  discriminating pattern the mechanism predicts. Dense land 33.5 → 34.5, depth
  better on three cases and worse on none, healthy bit-identical.
- *The next-arc air factor is excluded from the readiness product.* It carries
  no boundary information (a no-physics lookup scores 0.01228 against the
  model's 0.01022; boundary-only 0.03843 against a global mean of 0.03925), and
  removing it is better on BOTH strata. The compiler ablation independently
  prices it lowest of the four factors (~5 points against catchability's ~25).

**The open structural fact, not yet acted on.** Per-pool spread shows that on
dense specs `readiness` sits at a mean level of **0.089–0.095** with ~118%
relative spread, against 0.288–0.300 and ~80% on healthy specs. So the ranking
of a real arc is dominated by a prediction about an arc that does not exist
yet, and the domination gets stronger exactly as catchability falls — a
feedback loop: hard spec → low catchability → readiness dominates → ranking
driven by next-arc prediction → worse commits → harder spec. `settled` and
`projected` are qualities on ~0.5; multiplying them by a probability-like
product on ~0.09 is a scale mismatch, not a search-policy choice anyone made.

Sweeping `LR_OBJECTIVE_FUTURE_POWER` to 0.5 and 2.0 both improved dense landing
slightly (35.4 and 36.5 against 34.3), which is knob noise at 2 seeds rather
than a mechanism, and is recorded here only so it is not mistaken for a lead.

**Falsification 5 — the composed aim is not responsible for the second drop
either.** The `6d064b0` step (dense landing 39.5% → 33.9%) introduced
`arc_proposal.ts` and the contact-owned target composition. Probed by aiming the
sampler at the literal `gap.targets` exactly as every commit up to `cdba2d7`
did:

  legacy literal aim   dense 34.5 / 27.8, 0/10   healthy 76.8 / 72.8
  composed (current)   dense 34.3 / 27.8, 1/10   healthy 76.4 / 72.0

Identical on dense. So the composition costs nothing, which is consistent with
it being the correct ownership: an arc owns the impact at its own contact and
the motion of the gap it OPENS. The probe flag was removed rather than left in
the tree as a parallel path.

What remains unexplained in `6d064b0` is therefore the exit-detector change and
the replacement of the hand-built readiness estimators with the trained
artifact — the latter being a model fitted on a corpus collected under a
DIFFERENT compiler, replacing estimators that had co-evolved with the search.

**Falsification 6 — `cost` scoring the wrong gap is a real inconsistency but
not the deficit.** Implemented the principled version: `cost` measures what the
arc owns, using the SAME ownership split as `composeArcProposalTargets` — the
impact and grain it delivers at its own contact (from the exact measurement the
fit already carries) plus the motion of the gap it opens (from the memoized
outgoing projection, zero engine frames).

  owned-gap cost   dense 34.7 / 28.2, 0/10   healthy 76.4 / 72.0
  current          dense 34.3 / 27.8, 1/10   healthy 76.4 / 72.0

A wash: +0.4 on dense landing, one completion lost, healthy identical, per-case
depth better on three and worse on two. Reverted rather than kept behind a
default-off flag, which would be another parallel path.

The reason it cannot matter is measurable and was already in hand: at the
benchmark's budgets the three-layer objective orders **98.5%** of the pool, and
`localScore` — the only branch-selection consumer of `cost` — is short-circuited
by forward-eval above 75k. So `cost` survives mainly as a tiebreak. The design
inconsistency is real and worth fixing eventually for coherence; it is not worth
attributing the deficit to.

### 2026-07-25 — the failure is an oscillation the search stops damping

Per-gap landing rate at the deepest gaps of `frontier_dense_recovery` — the
wall, where `deepest_seen_gap == gap_commits` and the compile stops advancing:

```
HEAD      gap 59..70:  29.5  3.5  41.0  12.4  42.2  18.4  42.7  15.0  40.1  2.7  0.9  0.0
          attempts:     234  173   178   161   256   267   525   594   973 2370 1160  168
8f73527   gap 58..64:    2.8 45.6   1.5  44.3   8.9  50.0  17.0   ... then 27-50% through gap 75
          attempts:      71   68    67    61    45    78    53   ... 59-138
```

The landing rate ALTERNATES with period two: a catch that is good locally
leaves the rider unable to make the next one, the search barely recovers, and
it repeats.

**Both compilers meet the oscillation, so it is a property of the spec.** The
one that completes the track DAMPS it — amplitude falls and the rate settles at
27–50% through the end. The one that does not AMPLIFIES it — 2.7, 0.9, 0.0 —
and dies, while throwing ten to forty times more candidates at the wall gaps
(2370 attempts against 65) as the rescue machinery burns the remaining budget.

Efficiency confirms the same shape, and cleanly exonerates everything global:

| case | frames per committed contact | | | candidates sampled |
|---|---|---|---|---|
| | `8f73527` | `cdba2d7` | HEAD | |
| frontier_dense_recovery | 2075 | 4918 | 3687 | 8707 → 11328 → 10853 |
| amplitude_tides | 2581 | 2593 | 2580 | 5328 → 6140 → 5655 |
| countercurrent | 3165 | 3165 | 3169 | 5295 → 6080 → 5751 |

The healthy specs are **identical** across all three commits. Nothing global
regressed. Only the dense specs' search dynamics changed, and they now spend
30% more candidates to commit half as many contacts.

This reframes the whole deficit: it is not a wrong quantity anywhere, it is a
loss of DAMPING. That is what motivated weighting projected error by which side
is recoverable (`9da13c0`) — preferring the recoverable side of a target is
what damping looks like. It materially improved the healthy strata (land 76.4 →
78.2) and did not move the dense ones.

**Rollout depth is not the answer either.** The oscillation has period two and
the forward rollout defaults to `greedy:2`, which is exactly the depth that
sees one good catch and one bad one and averages them. Sweeping deeper:

  greedy:2 (default)  dense 34.2 / 27.8   healthy 78.2 / 74.2
  greedy:3            dense 34.5 / 28.3   healthy 77.2 / 73.4
  greedy:4            dense 34.5 / 28.1   healthy 78.8 / 75.5

Dense is flat at 34.5 with zero completions at every depth. Deeper lookahead
does not damp it.

### 2026-07-25 — N=48: the deficit is −17.06, and most of the suite is now AHEAD

First real measurement of the night. `npm run benchmark -- eval --seeds=48`,
6,336 candidate compiles, tree at `e142a44` (deliverable air ask + next-arc air
factor excluded), against `accept-2026-07-22T18-26-42Z-8565eddc`:

```
headline 512.67 -> 495.61   delta -17.06   seed-block SE 1.92   95% [-22.11, -12.02]
validity 6227/6336 -> 5866/6336  (gained 15, lost 376)
  250k  -10.43  [-20.59,  -0.26]
  500k  -19.24  [-27.50, -10.99]
  750k  -17.85  [-25.60, -10.11]
strata
  representative      +8.69  [ +4.04, +13.33]
  legacy_regression  +29.59  [+18.41, +40.78]
  development_music  -12.22  [-20.63,  -3.82]
  capability        -169.93  [-195.36,-144.50]
largest improvements  high_air_drive +64.21, _air_minus_5 +61.73,
                      amplitude_tides +45.52, _restrained_10 +45.45,
                      loose_pocket +42.64   — all at full 144/144 validity
largest regressions   dense_recovery_240ms -308.01 (valid 116->8/144)
                      dense_recovery       -265.71 (valid 109->8/144)
                      pickup_shifted       -194.95 (valid 119->81/144)
```

Two things this settles.

**The deficit is smaller than the 3-seed screen implied** — −17.06 with SE 1.92,
against −26.62 with SE 3.73 at N=3. The earlier figure was a low-power estimate
and should not be quoted again.

**Most of the suite is now clearly AHEAD of the accepted baseline.**
`representative` +8.69 and `legacy_regression` +29.59 are both significantly
positive, with individual gains above +60 at full validity. The contact-indexed
pipeline is not a broad regression; it is a broad improvement carrying two
pathological cases. `frontier_dense_recovery` and its 240ms variant alone
account for roughly 200 of the 376 lost valid runs, and both collapse to 8/144.

This changes what "closing the deficit" means. It is not a matter of recovering
a general loss — it is a matter of those specs completing at all.

### 2026-07-25 — the deficit is a SEARCH-EFFICIENCY loss, not a capability loss

The previous entry left "those specs completing at all" as the open question.
It has an answer, and it changes the diagnosis completely.

`frontier_dense_recovery` was believed not to complete "at ANY budget". That was
an artefact of only ever asking it at benchmark budgets. Given more:

```
                first completion   250k   500k   750k
baseline 02c7828      334k frames    no    yes    yes
HEAD                1,420k frames    no     no     no
```

HEAD is not incapable of these specs. It reaches the first complete track
**4.25x slower**, which drops it below two of the three budget tiers. The
capability stratum scores a non-completing run as invalid, so a continuous
efficiency loss shows up as a binary cliff.

That gives the campaign the instrument it had been missing all night:
`first_completion_frame` at a large fixed budget — continuous, deterministic per
(spec, seed, budget), ~4 minutes for six numbers, immune to CPU contention.
Three seeds, two specs, 1.5M frames:

```
                       dense_recovery              pickup_progression
baseline 02c7828   470k / 433k / 639k          335k / 340k / 351k   (sd 8k)
HEAD              1337k / 1509k / none         513k / 396k / 549k   (sd 79k)
```

Two signals: HEAD is systematically slower, and its variance explodes. The
baseline is metronomic on pickup (sd 8k); HEAD wanders (sd 79k).

**Where the frames go.** Decomposing TTC into cost-per-look and looks-per-step
exonerates the ballistic layer a second time:

```
                    frames/eval        evals/commit      commits @250k
dense_recovery    15.4 vs 15.6 base   198.7 vs 206.2      82 vs 78
pickup_progress   14.8 vs 18.4 base   206.4 vs 123.7      82 vs 110
amplitude_tides   19.2 vs 21.1 base   134.5 vs 122.5      97 vs 97
countercurrent    18.6 vs 20.7 base   171.0 vs 155.0      79 vs 79
```

Each look is as cheap or cheaper than the baseline's — the deleted engine-based
suffix measurement means HEAD gets *more* looks per frame budget (16,927 vs
13,606 on pickup). It converts them worse: 206 looks per committed contact
against 124. Healthy controls are unaffected to the commit (97/97, 79/79).

**The shape of the loss: cumulative drift, not a wall.** Per-gap landing rate on
`frontier_pickup_progression` at 250k:

```
gap band    HEAD    baseline
0-4         44.1      45.8
5-9         42.9      44.8
10-19       38.6      39.9
20-39       28.8      41.5
40+         20.3      28.7
```

The two are within ~1.5 points for the first twenty gaps and then separate. The
baseline holds 41-50% all the way to gap 109 and never degrades; HEAD decays
with depth and its tail goes ragged (7.5, 45.8, 8.9, 9.1, 2.9, 18.6, ...) while
attempts explode (940, 1291, 1135 at the last three gaps).

This rules out the framing every earlier entry assumed. There is no single hard
gap that HEAD cannot pass. Each committed arc leaves the rider slightly worse
placed than the baseline's would, the deficit compounds with depth, and on a
123-contact spec it compounds past the budget. Short specs never accumulate
enough drift to show it — which is exactly why `representative` (+8.69) and
`legacy_regression` (+29.59) are significantly AHEAD.

### 2026-07-25 — falsified: the learned catchability model (8th)

`cdba2d7` replaced the baseline's hand-fit bilinear grid of empirical landing
rates (`readinessCatch` over a 10x7 (angle, speed) RATE_GRID) with a learned
component (`infer(artifact, "catchability", features)`). Since catchability is
precisely the dead-end predictor, and dead ends are what "looks per committed
contact" counts, a mis-calibrated model is a clean explanation for the drift.

Probe (legacy-shaped, therefore screen-only by the working agreement): drop the
baseline grid back in behind `LR_READINESS_CATCH_GRID=1`. Identical inputs —
arrival speed and CoM velocity angle.

```
                    dense_recovery TTC        pickup TTC
HEAD (learned)   1337k / 1509k / none     513k / 396k / 549k
grid probe        none / none / none      740k / 803k / 1416k
```

The learned model is decisively BETTER than the grid it replaced, on both specs
and every seed. Catchability is exonerated, and the queued "the corpus is stale,
retrain it" lead is much weaker than it looked: whatever the corpus's provenance
bookkeeping says, the component it produced outperforms the hand-fit surface.
Reverted.

### 2026-07-25 — readiness gets its own exponent (default-off, no-op at 1)

The drift signature says the search under-weights future feasibility against
present quality. The three-layer product could not express that: `readiness` and
`projectedOutgoingQuality` shared one exponent (`objectiveFuturePower`), so the
rate at which the search trades score against feasibility was fixed.

They answer different questions about the same future — projected quality asks
how good the gap this arc opens is, readiness asks whether the NEXT arc can be
built at all — so they get separate exponents.
`LR_OBJECTIVE_READINESS_POWER`, default 1, which reproduces the previous product
bit-for-bit (verified: gamma=1 returns the earlier HEAD TTC numbers exactly).

### 2026-07-25 — the fix: split the future layer by role, weight feasibility

The drift signature says the search under-weights future feasibility against
present quality, and the three-layer product could not express that. The first
attempt bolted an extra exponent onto `catchability`, which already appears
inside `readiness`; the objective's own test caught it as a violation of
"contains all three temporal layers exactly once" and was right to.

The principled form groups the readiness factors by the QUESTION they answer
rather than by which model produced them:

```text
proposalUtility =
    settledIncomingQuality ^ 1
  x (projectedOutgoingQuality x speedFit x airFit
     x impactFeasibility x elevationFit) ^ 1
  x catchability ^ 2
```

`catchability` ADMITS the next arc — it is the dead-end predictor, and dead ends
are what the search pays for in backtracking. The other four GRADE it, which is
the question `projectedOutgoingQuality` already asks. Every factor still appears
exactly once and neutral exponents reproduce `settled x projected x readiness`
algebraically, which a test now asserts directly.

**The screen (TTC, 3 seeds, mean).** First arm of the campaign with no downside
anywhere:

```
                              500k budget        default    previous
frontier_pickup_progression_shifted              296k       2/3 seeds never
dense_dialogue_impact_contrast_10                246k       302k
dense_dialogue                                   262k       268k
frontier_low_air_endurance_7s                    213k (3/3) 2/3 seeds never
amplitude_tides            (healthy control)     170k       197k
countercurrent             (healthy control)     194k       213k
high_air_drive             (healthy control)     185k       205k
loose_pocket               (healthy control)     196k       223k
frontier_pickup_progression      @1.5M           330k       486k   (base 342k)
```

Two specs recover a seed that previously never completed, and the healthy
controls improve 10–14% as well — this is not a capability-vs-representative
trade.

`frontier_dense_recovery` remains unresolved. It completes on two of three seeds
either way, at 1.0–1.5M frames against the baseline's 470k, and a 1.5M probe
budget is the same order as its completion frame, so that comparison is noise
and is reported as such rather than counted as a win.

The exponent sweeps that led here, for the record (TTC on
`frontier_pickup_progression` @1.5M, mean of 3 seeds): readiness exponent
0.5 → 610k, 1 → 486k, 1.5 → 349k, 2 → 373k, 3 → 331k; feasibility exponent
1 → 486k, 1.5 → 301k, 2 → 330k, 3 → 320k. The sign is unambiguous and the
optimum is broad, which is what a real effect looks like rather than a tuned one.

### 2026-07-25 — the dense_recovery trade, resolved at a budget that can see it

The screen reported `frontier_dense_recovery` as unresolved because a 1.5M probe
budget is the same order as its completion frame. Re-run at 3M, where both arms
can actually finish, it resolves — and not in the new default's favour:

```
                                       previous product      feasibility^2
frontier_dense_recovery            3/3, mean  917k        3/3, mean 1557k
  per seed                     1595k / 667k / 490k    2040k / 1007k / 1624k
frontier_dense_recovery_240ms_figures  2/3               3/3, mean 2047k
  per seed                     563k / none / 2184k     870k / 2794k / 2476k
```

So the feasibility weighting is not free. It helps every other spec measured,
healthy and capability alike, and it converts the 240ms variant from 2/3 seeds
to 3/3 — but it costs `frontier_dense_recovery` roughly 70% more frames to
reach its first completion.

**Why this is still the right default, stated as a judgement and not as a
measurement:** at benchmark budgets neither arm completes that spec at all.
Both need ≳0.9M frames and the top tier is 750k, so the slowdown is invisible to
the score, while the gains elsewhere are not. That reasoning would flip
immediately if the suite gained a budget tier above 1M, and it is recorded here
so the trade is re-examined rather than inherited if that happens.

### 2026-07-25 — N=48 #3 rejects the feasibility weight, and indicts the instrument

```
headline delta -25.25   SE 1.74   95% [-29.82, -20.68]     (previous arm -15.33)
validity 6227 -> 5951   (gained 22, lost 298; previous arm lost 372)
strata
  representative      -10.29   was +9.93
  legacy_regression   +10.55   was +30.56
  development_music   -28.83   was -12.61
  capability         -117.71   was -164.65
largest regressions  dense_recovery_240ms -306.64 (valid 116->20/144)
                     dense_recovery       -264.11 (valid 109->20/144)
                     dense_dialogue       -101.29 (valid 144->119/144)
```

The arm did exactly what it was designed to do. Every completion measure
improved — 74 fewer lost runs, `frontier_dense_recovery` from 8 to 20 of 144
valid, its 240ms variant from 10 to 20, `pickup_shifted` from 85 to 110, the
capability stratum up 47 points. And the headline got 10 points worse, because
score fell everywhere else.

**Over-weighting admission makes the search prefer arcs that land safely over
arcs that score.** A completed track that misses its axes is worth less than the
axes are. That is a coherent, predictable consequence of the change, and it was
invisible to every screen that selected it.

**The instrument was the mistake, not the knob.** `first_completion_frame` ranks
how fast a spec finishes; the benchmark scores how well it finishes. The two
agree while a spec is failing to complete at all — which is why TTC diagnosed
the deficit correctly — and diverge exactly when an arm starts trading quality
for completion, which is what this arm did. Eight specs improving on TTC with no
downside anywhere looked like an unambiguous win and was measuring half the
objective.

TTC keeps its place as a *diagnostic* for why a spec cannot finish. It is not a
selection criterion, and no arm should be promoted on it again without a paired
quality measure.

**Kept:** the role split itself, at the neutral exponent. Grouping the
objective's factors by the question they answer is clearer than grouping them by
which model emitted them, and at exponent 1 it is the same product — but the
identity is ALGEBRAIC, not bitwise. The regrouping changes multiplication order,
so results differ in the last ulp and the search takes a different path:
`pickup_progression` TTC 319k/305k/345k against 513k/396k/549k before the split.
This tree is therefore NOT the one N=48 #2 measured, and is being measured in
its own right rather than inheriting that result.

### 2026-07-25 — N=48 #4: an algebra-preserving regroup costs 14 points

The role split was re-measured at its neutral exponent, expecting the same
compiler written more clearly. It is not the same compiler:

```
delta -29.34  [-33.84, -24.83]        vs -15.33 unsplit, -25.25 weighted
strata  representative -10.75 | capability -137.67 | legacy +3.13 | music -29.50
validity 6227 -> 5945
```

The regrouping is algebraically exact. Verified over two million random inputs:
61% differ between the two associations, maximum relative difference **8.0e-16**
(~3.6 ulp). That is the entire semantic content of the change, and it moved the
headline 14 points — **seven times the seed-block SE** — because ranking ties
break differently and the search walks a different tree.

Reverted; the restored product is bit-for-bit the tree N=48 #2 measured
(`pickup_progression` TTC 513010/396401/548736, identical).

**The corollary applies to every number in this campaign.** A 14-point swing can
be produced with zero semantic content. The confidence interval measures seed
variance; it does not measure how much of a delta is the search landing in a
different basin. Deltas of this magnitude are therefore weak evidence about a
mechanism unless the change is bit-level inert or the effect is much larger.

### 2026-07-25 — the ballistic layer was never priced; pricing it paid 44x

A history survey of the predictor chain turned up a single structural fact:
**every predictor generation was chosen on error ratio alone, and cost was never
measured once.** The written rule was "adopt when the frozen-corpus score is at
least 1% lower". Under it, three successive models shipped — point-mass parabola
(1.19 px), articulated assembly (0.52 px), exact 22-constraint kernel
(0.047 px) — each strictly more expensive than the last. A fourteen-model panel
of cheap closed-form alternatives was built on 2026-07-23, compared on error,
and deleted **without ever being timed**. The first per-prediction timing in the
project's history was taken on 2026-07-25, six days and four commits after the
exact kernel shipped.

The rule was also self-sealing. Once the kernel reached zero error the score
divided by zero, every alternative scored `Infinity`, and `decision` could only
answer `keep_current`. A cheaper model was unreachable by construction.

**What pricing it revealed.** Per frame the kernel costs 1.92–2.06 us against
the engine's 1.47–1.70 — 1.3x MORE. Its real advantage was that its frames were
never charged to the frame budget: 31.5% of everything the compiler simulated
was unbilled, up to 0.92 unbilled per billed on air-heavy specs, sitting
directly on the axis the suite varies to test scaling.

**The replacement.** In free flight every constraint moves its two points
equally and oppositely, there are no masses, and the joints only read positions,
so the ten-point system centre is exactly ballistic — residual 1.1e-13 px/frame.
The 135 solves per frame buy only the rider-vs-system difference. Carrying the
rider on its launch offset, and taking sled-pose rate from conserved angular
momentum rather than a two-point difference (12.76 -> 4.64 deg), gives:

```
                  ns/call   posMAE    speedMAE   angleMAE
exact kernel       19,806    0.000     0.0000      0.00
closed form           451    0.58 px   0.034       0.20      44x cheaper
do nothing            233  173.65 px   0.732      14.29
```

**Adopted at parity, which is the correct bar** — a worse predictor cannot beat
a perfect one, so an apparent gain is the search finding a different basin.
24 seeds: headline 494.91 -> 494.63, delta -0.28, SE 2.50, 95% [-7.00, +6.44];
no stratum significantly different; validity flat. Micro-sim frames: zero.

Known cost, checked rather than assumed: `frontier_pickup_progression` stalls
more often (750k: 3/24 vs 0/16). The failure mode is IDENTICAL in both —
`terminus:rideStalled` on a marginal-energy track the kernel itself fails 15/16
times at 250k — so it is the same margin crossed more often, not a new
mechanism.

### 2026-07-25 — readiness had been training on a distribution that no longer existed

Independent of the above, and a latent defect: the readiness corpus carries a
sampler fingerprint over the whole proposal path, and the guard had been
refusing to load it since the overnight rework. **Every readiness number the
compiler acted on came from a model fitted to inputs it no longer saw.**
Recollected and retrained; measured alone, with the predictor unchanged, it was
worth +7.34 headline and took `legacy_regression` from significant (-5.98) to
not (-3.13).

### 2026-07-25 — the extractor and the model are now separate lists

Removing a feature from the readiness model used to require editing the
extractor, which the corpus guard fingerprints, which invalidated the corpus,
which can only be rebuilt by running the compiler, which needs a model matching
the extractor. Feature selection was impossible without a hand-written bootstrap
artifact or weakening the guard.

`READINESS_FEATURE_NAMES` now says what the compiler can OBSERVE; an artifact's
`featureNames` say what it USES. Compatibility requires only that every column
exists in the extractor and appears once; `infer` projects. This is not weaker —
unknown and repeated columns are still rejected, and `featureTransformId` still
binds a column's meaning. Feature-selection experiments now cost a retrain.

First use: the 8 `articulation:*` features are gone from the model (at most
0.75% OOF, two components BETTER). They were the one output the closed-form
predictor cannot supply at all — 0.0463 against the do-nothing model's 0.0453.

### 2026-07-25 — instrument lessons worth more than the result

1. **A metric that ranks completion does not rank quality.** `first_completion_frame`
   diagnosed the capability deficit correctly and cheaply, then selected a
   losing arm, because it measures how fast a spec finishes rather than how well.
   Diagnostic, never a selection criterion, without a paired quality measure.
2. **A 14-point headline swing can have zero semantic content.** An
   algebraically exact regrouping of `proposalUtility` cost 14 points at N=48 —
   7x the seed-block SE — purely through last-ulp reassociation changing which
   ranking ties break. The confidence interval measures seed variance; it does
   not measure which basin the search landed in.
3. **The `capability` stratum cannot rank arms at these seed counts.** Its CI
   spans +/-60 and it inverted the ranking between the two best arms we measured.
   Judge on `representative` and validity.

### NEXT CAMPAIGN — `frontier_dense_recovery`: the outstanding capability debt

Named here so it is inherited deliberately rather than forgotten. This is the
largest single prize left, and it is worth more than any remaining ballistic
accuracy.

**The debt.** When the contact-indexed compiler was promoted as the canonical
baseline, one regression was accepted as documented debt rather than fixed. Two
specs — `frontier_dense_recovery` and its 240ms variant — went from 46-48 of 48
valid at 500k/750k to 3-6, and account for ~200 of the lost runs. At 250k the
OLD baseline itself passed them only 15-20 times in 48, so that tier was always
a coin flip; at 500k and 750k it was deterministic, and that is the real loss.

**What is already known** (do not re-derive):

- It is **not a capability loss, it is an efficiency loss.** Given budget, the
  compiler completes `dense_recovery` — it just needs ~1.42M frames where the
  old baseline needed ~334k. That is 4.25x slower to the first complete track,
  which drops it below two of the three budget tiers.
- The shape is **cumulative drift, not a wall.** Per-gap landing rate tracks the
  old baseline within 1.5 points for twenty gaps, then separates (41.5 -> 28.8
  in the 20-39 band) while the baseline holds 41-50% out to gap 109. There is no
  single impassable gap; each committed arc leaves the rider slightly worse
  placed and it compounds. Short specs never accumulate enough to show it, which
  is why `representative` and `legacy_regression` are ahead.
- Cost per look is fine; **yield per look is not.** Frames per candidate
  evaluation are flat (15.4 vs 15.6); looks per committed contact rose 124 ->
  206.
- **Ten hypotheses are already falsified** — see the falsification list in
  `docs/BALLISTIC_READINESS_DECISIONS.md` §5. Re-deriving any of them costs
  hours.

**Instrument warnings, learned the hard way.** `first_completion_frame` (TTC) is
the natural metric here and it is a good DIAGNOSTIC — but it ranks how fast a
spec finishes, not how well it scores, and it selected a losing arm when used
alone. Pair it with a quality measure. And note the `capability` stratum cannot
rank arms at low seed counts (CI +/-60); judge on `representative` and validity.

**Framing for whoever picks this up:** the deficit is a search-efficiency loss
with a cumulative-drift signature, on specs long enough for drift to compound
past the budget. The question is not "why can't it do this" but "why does each
committed arc cost slightly more than it should, and what would make the search
notice".

### 2026-07-23 cheap-model panel — recovered from a gitignored artifact

Fourteen closed-form models were built, compared, and deleted without ever being
timed; their absolute figures appeared in no document. Recovered here from
`generated/analysis/ballistic-v2-all44-all-budgets-s735656107.json` (112 MB,
gitignored) so the artifact itself is disposable. All against engine truth,
44 cases x 3 budgets:

```
model                                     pre pos   contact pos   velMAE  angleMAE
assembly_frozen_relative                    0.390        0.453    0.1153     0.496
assembly_damped_tau4  (= production_artic)  0.419        0.520    0.0537     0.200
assembly_damped_tau6/8/12/16                0.419        0.520    0.055-0.068
assembly_rotating_position_center_velocity  0.419        0.520    0.0598     0.220
assembly_rotating_angle                     0.419        0.520    0.1022     0.373
assembly_rotating_velocity                  0.460        0.551    0.1045     0.397
body_displacement                           0.840        0.952    0.1038     0.423
body_recent_weighted                        0.958        1.067    0.1149     0.486
assembly_linear_relative                    0.979        1.073    0.1153     0.496
production (point-mass parabola)            1.082        1.188    0.1190     0.510
assembly_center                             1.291        1.363    0.0598     0.220
```

Two things this settles.

**The adopted "articulated" model was `assembly_damped_tau4`** — one of the
panel, promoted on a 58.84% error reduction with no cost column.

**An open lead, recorded not pursued.** Our shipped `closed_form_system` is
0.560 pre / 0.583 contact on position — WORSE than several of these (best
0.390/0.453) while matching the best on velocity (0.053) and angle (0.200). The
difference is the relative-velocity treatment: we freeze the rider's launch
offset, which is the tau -> infinity limit, whereas `assembly_damped_tau*` decays
the relative velocity as exp(-dt/tau). Adding that decay would likely close most
of the position gap and stay O(1).

It is **not** being pursued, deliberately: the closed form is already at compiler
parity, so there is nothing for better position accuracy to recover, and the
readiness model has since been retrained on the inputs it actually receives —
so improving them would require another retrain merely to express itself. This
is here for whoever has a reason to want the accuracy back.

### 2026-07-25 — a regression the benchmark structurally cannot see

`npm run verify:compiler:behavior` exercises budgets 61k/100k/150k/200k — all
BELOW the benchmark's lowest tier of 250k. It refuses to re-baseline, correctly,
because one cell of 48 is invalid:

```
opening_burst|seed1|budget61000: INVALID (sync:0drift/19missing; died:rideStalled@160)
```

Traced rather than assumed:

| state | result |
|---|---|
| recorded baseline (pre-rework) | score **629.99**, valid, 126 lines |
| closed form as measured at 24 seeds (`8a477fb`) | score **332.32**, valid, 128 lines |
| after the review-fix retrain (`405c75c`) | **INVALID**, 39 lines |
| exact kernel, same model | score 281.02, **valid**, 127 lines |

Three things this says, and one it does not.

**The case was already degrading before today.** It lost half its score during
the overnight rework, long before the closed form existed. The retrain pushed an
already-marginal cell over the line rather than breaking a healthy one.

**The predictor is implicated at this budget** — same model, kernel valid, closed
form not — which is consistent with the `frontier_pickup_progression` finding:
the same `rideStalled` margin, crossed more often, on tracks with no energy to
spare. 61k is a quarter of the lowest benchmark tier, so the search has far less
room to recover from a slightly worse arc.

**Neither new guard is responsible**, checked: production builds its packet with
`constraintBallisticStateFromRider(rider, 0)`, so the `frameOffset` refusal never
fires, and the finiteness guard can only convert a downstream throw into a clean
rejection.

**What it does not say** is that the adoption was wrong. The same tree measures
at parity at 24 seeds with the best `representative` reading of the campaign
(+4.07). One cell of 48, at a budget nothing else tests, on a case already at
half its original score.

**The standing gap this exposes.** The suite's lowest tier is 250k and the wide
determinism arm is the only thing exercising 61k-200k — but it is a
bit-identity check, not a scored comparison, so it can only say "something
changed", never "this got worse by N". Behaviour below 250k is therefore
effectively unmeasured. `verify:compiler:behavior` stays un-re-baselined until
that cell is valid again; forcing it would record an invalid track as the
reference and destroy the only signal that exists down there.
