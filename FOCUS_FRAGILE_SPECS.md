# Focus campaign — make the fragile specs robust

Companion to `GOAL_LDS_ARC_PLACEMENT.md`. Same code boundary, same anti-overfit
rules. Different objective and different eval harness.

## Why this campaign

The headline campaign optimized the *arithmetic mean over the whole suite* and
moved it a lot (robust 9-spec mean@150k ≈ 497 → 557). That work is banked. The
mean, though, can sit high while a handful of specs stay **shaky** — occasionally
collapsing, or quality-poor in ways the 20-spec average hides. Five specs carry
almost all of that fragility:

```
opening_burst   drums_breath   solo_run   cold_start   syncopated_switchback
```

`opening_burst` is currently *excluded* from the headline benchmark precisely
because it flips valid→broken at random (see `golden_suite.ts` / `TODO.md`). The
goal here is to make all five **work very well and reliably**, so the compiler is
trustworthy on them — and, eventually, so `opening_burst` can return to the
headline list.

## The deal (what we are willing to trade)

- It is **fine to lose a few points of headline last-budget mean** to make the
  fragile specs solid. A small, measured regression on the broad suite is an
  acceptable price.
- It is **not** fine to throw away the bulk of the headline gains. Every candidate
  change is guard-railed against the headline set; large broad regressions are
  rejected.
- The fix must be a **generic mechanism**, never a per-spec branch or a
  threshold/gate keyed (directly or indirectly) to a named spec's numbers. Fresh
  seeds are the overfit tripwire.

## Eval harness (the focus loop)

Fresh seeds **200–209** — deliberately disjoint from every seed used in the
headline campaign (0–19, 100–102), so improvements can't be memorized seed noise.

```
scripts/v0/focus.sh <label>
node scripts/v0/focus_report.mjs generated/focus-runs/<label>/golden.json
```

- specs: the 5 above (`focus.sh` loads `opening_burst` directly even though it is
  excluded from the headline `GOLDEN_SPECS` — `--specs` now accepts off-registry
  specs).
- seeds: 200–209 (10).
- budgets: 60k → 120k, step 5k (13 checkpoints).
- placement: `LR_ARC_PLACEMENT=continuous` (the default under test).

### Primary metric: the **curve score** over 60k–120k

`CURVE` in `focus_report.mjs` = mean per-row score across the whole budget window.
Unlike the headline's last-budget mean, the curve rewards **reaching quality
sooner** as well as ending high — the right target for "converge reliably," which
is what fragile specs lack. (The headline brief argues last-budget-mean for the
broad suite because slow-converging placements look good early; here we *want* to
penalize slow/shaky convergence, so the curve is the correct lens.)

### Fragility is first-class, not a footnote

A high mean with one collapsing seed is **not** a solved spec. `focus_report.mjs`
prints, per spec:

- `validLast` — seeds passing the contract at 120k (want 10/10).
- `minValid` — worst valid-seed count anywhere in the window (the fragility floor).
- `worst` — lowest single-seed last-budget score (collapse detector).
- `std` — stddev of last-budget score across seeds (jitter).
- `axis_rms` — pooled per-axis error at 120k (what quality is missing).

Read `worst`/`std`/`minValid` before celebrating `curve`. The whole point is to
kill the tail, not nudge the average.

## Guardrail: keep the headline gains

After any change that improves the focus set, confirm the broad suite did not
regress materially. Run the headline diagnostic on its own seeds (NOT 200–209):

```
GOLDEN_SEEDS_OVERRIDE=0,1,2,3,4,5,6,7,8,9 LR_ARC_PLACEMENT=continuous \
  npx tsx scripts/v0/golden.ts --json --details \
  --specs=solo_run,dense_sprint,tiny_dance,drums_pendulum,drums_crescendo,rhythm_ladder,syncopated_switchback,drums_tide,drums_dropout \
  --budgets=50000,...,150000 --jobs=16 --archive-dir=generated/focus-runs/guard09
```

and cross-check on seeds 10–19. Accept small mean deltas (a few points); reject
broad collapses. The fragile-spec win must not come from a mechanism that quietly
degrades the rest.

## Working method

1. **Feel.** Run the baseline focus loop. For each spec read `axis_rms` + `worst`
   to name the dominant failure mode (e.g. cold_start = early speed overshoot;
   opening_burst = late-gap air undershoot).
2. **Hypothesize a generic mechanism.** Tie the failure to the placement physics
   (height-shaping: launch angle ↔ speed/air; grounded ride-out length ↔ air),
   never to the spec's identity. Ask "what continuous control, applied to every
   gap, would fix this class of failure?"
3. **Implement inside the boundary.** `arc_placement.ts` (geometry),
   `candidate.ts` (validation), `sample.ts` (bridge). Do **not** touch
   `handoff.ts` search policy/scoring.
4. **Measure on the focus set.** Curve + fragility. A change that raises `curve`
   but raises `std`/lowers `worst` is suspect — fragility is the target.
5. **Guardrail on the headline** (seeds 0–9 and 10–19). Keep the bulk of the gains.
6. **Keep only robust wins.** Decide on 10 fresh seeds, cross-validate on a
   disjoint held-out set before committing. Same noise discipline as the headline
   campaign (~±10–15 validity-flip noise on a single 10-seed mean).

## Boundary (unchanged from GOAL_LDS_ARC_PLACEMENT.md)

- `arc_placement.ts` — placement geometry proposal.
- `core/candidate.ts` — validation/measurement of emitted geometry.
- `optimizer/sample.ts` — the atomic bridge.
- `optimizer/handoff.ts` — search/ranking/scoring: **off-limits** for policy
  changes. Release-state-aware ranking terms are allowed only if generic and not
  overdominant.

## Scoreboard

| label | change | primary curve | validLast | worst specs | notes |
|-------|--------|-------|-----------------|-------------|-------|
| baseline | continuous, as committed | 451.1 (10 seeds) | 9.2/10 | solo_run; cold_start | first feel run, seeds 200–209 |
| baseline2 | + 20 fresh seeds + cross-check | 455.4 | 18.6/20 | solo_run (13/20, dead-ends); cold_start (speed 0.385) | proper baseline |
| preroll-default | cold_start inherits default preroll | **490.6** | 18.6/20 | solo_run (13/20, dead-ends) | cold_start 354→530 (+176), speed 0.385→0.167; commit 8f0c38a |

solo_run remains the dominant fragility: 13/20 valid, dead-ends (`rideStalled`)
when an opening-overspeed seed can't brake down on the tight 12.8-frame gaps and
the chain becomes unplaceable. drums_breath dead-ends the same way on s100.

### Baseline per-spec (seeds 200–209, 60–120k)

| spec | curve | last | validLast | minV | worst | std | dominant error |
|------|-------|------|-----------|------|-------|-----|----------------|
| cold_start | 333.0 | 334.0 | 10/10 | 10 | 290 | 31.7 | **speed rms 0.411** (overshoot all run) |
| drums_breath | 615.6 | 616.9 | 10/10 | 10 | 530 | 44.2 | air 0.138 |
| opening_burst | 553.6 | 584.2 | 10/10 | 9 | 518 | 37.7 | grain 0.103 / air 0.166 |
| solo_run | 229.7 | 399.4 | **6/10** | **0** | **0** | **326.7** | **dead-ends (rideStalled)** — opening overspeed → 4 seeds never valid |
| syncopated_switchback | 523.6 | 525.0 | 10/10 | 10 | 463 | 33.2 | air 0.192 |

### Root cause (both top failures are one mechanism)

Ballistic flight conserves energy: a hop returning to the same height arrives at
the same speed; catches can only shed speed by landing *higher*, which can't be
sustained over a long run (bounded vertical space). So ballistic catches **cannot
sustainably reduce speed** — only **grounded uphill friction** can.

- **cold_start** (`preroll=0`): must brake from the engine's high default entry
  down to a 0.35 speed target and can't → overspeed all run (rms 0.411).
- **solo_run** (~80 contacts): seeds that open fast creep/net-downhill until a
  tight contact is unplaceable → search dead-ends (`rideStalled`); 4/10 seeds
  never find a valid chain. The handoff already has a *selection-only* overshoot
  penalty it calls "too weak to arrest creep" (handoff.ts:2200).

Proposed first lever: **grounded-uphill braking** — a generic post-contact
ride-out that climbs gently *while grounded* to bleed speed via the surface
(continuously sized from the gap's speed target), giving sustained deceleration
that ballistic launch-angle shaping physically cannot. Validity-first: measured on
the focus curve + fragility metrics, guard-railed on the headline suite.
