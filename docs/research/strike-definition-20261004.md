# The strike account (line.strike.v1)

Implementation: `scripts/lib/strike_impact.ts`, with tests in
`tests/strike_impact.test.ts`. The research adapter is `tools/measure/strike.ts`.

## Why a new account

The owner wants an impact definition that is physically meaningful,
universal (lower, upper and inverted contacts alike) and snappy, and that
keeps what the old definition got right on clean lower landings.

- **The frozen landing ruler (V6)** sees only sled touchdowns. It merges
  distinct hits into one 150 ms window and is blind to off-beat body and
  upper-rail hits.
- **`line.contact-impact.v1`** fixed event identity but kept the strength
  kernel, and it has three problems:
  - it times hits at the onset (the peak still lags about 54 ms);
  - it hides any strike that follows a weak touch during continuous contact;
  - it reads limb motion as redirection, because the 6-point body mean is not
    ballistic.

  The compiler optimizing v1 learned to exploit the hidden-strike gap.

## Definition

Everything derives from one signal: the velocity V of the rider's **10-point
centre of mass**. The points have equal mass in Line Rider, and that velocity
is *exactly* ballistic when nothing touches the rider. On every contact-free
frame of every observed ride (0 of 11,563 frames) the contact acceleration is
zero.

| quantity | definition |
|---|---|
| contact acceleration | `J[f] = abs(V[f] − V[f−1] − g)`: the force any contact exerts; exactly 0 in flight |
| redirection | `bend[f] = ½(abs(V[f−1]) + abs(V[f])) · abs(∠(V[f−1], V[f]))` |
| engagement | a maximal run of frames where any rider point is in contact; each start is an event (a *touchdown*) |
| strike renewal | inside an engagement, a new event at a peak of the 3-frame-smoothed J. The peak must be ≥ 0.8, at least 4 frames (100 ms) after the previous peak, and its preceding valley ≤ ½ of the new peak |
| steering | contact without such a peak; not an event, costs nothing (speed gain is accounted separately) |
| timing | half-rise: the first frame where J reaches half of the event's peak (the peak frame is recorded too) |
| strength | Σ bend over the event's own frames (≤ 6, never past the next event) ÷ 7.55, capped at 1 |
| account | monotone one-to-one matching of events to beats within ±4 frames. Loss = strength error² + timing error² + Σ unmatched strength² + missing beats |

**Rationale for each choice:**

- **Centre of mass.** It is the original intent of the impact definition:
  "centre-of-mass velocity avoids limb-whip artifacts". The body-mean
  implementation only approximated it, and its in-flight non-ballistic motion
  is measurable.
- **Contact acceleration for identity.** It is the physical cause of a hit.
  Sled, body and upper-rail contacts all register through it with no geometry
  names.
- **Renewal against the new peak.** A strong strike can never hide behind a
  weak touch. The 100 ms spacing and the 3-frame smoothing fuse the solver's
  frame-to-frame contact chatter, which a viewer also sees as one hit.
- **Redirection for strength.** It keeps the kernel the owner's felt labels
  were calibrated on. On 3,329 landings the centre-of-mass kernel reads 0.99×
  the body-mean one (p10–p90: 0.88–1.12), so 7.55 is kept and authored values
  keep their meaning.
- **Half-rise timing.** On the owner's new labels, "late" hits had peaks about
  125 ms after the beat and "on the beat" hits about 60 ms. The half-rise marks
  when the hit visibly begins and puts the approved clean landings on the beat
  (P2 +25 ms, P14 0 ms).

## Evidence

**Owner-judged passages** (current library tracks, strengths 0–1):

| passage | owner | v1 | strike |
|---|---|---|---|
| P2 Tiki 303, 13.91 s | very clean, precise | 0.65, matched | 0.68, matched, +25 ms |
| P14 Tiki 202, 6.97 s | clear, aligned | 0.64 | 0.59, +0 ms |
| P12 Amor 202, 9.10 s | not an impactful strike | 0.66 (≈ P2) | **0.49** (below P2/P14), +50 ms |
| P13 Luna 303, 28.20 s | better than 12, not cleanest | 1.00 | 1.00, +50 ms, peak +175 ms |
| P4 Tiki 101, lower + upper | two distinct surfaces | 2 events | 2 events (0.45 matched, 0.74 extra) |
| P1 Tiki 303, upper hit | upper hit competes with the beat | extra 0.79 | extra 0.81 |
| P10 Amor 101, guidance | unwanted speed-up | small events | steering: no events; speed gain accounted |

P12 is ranked below the clean landings without any pose rule. Its large
body-mean "bend" was largely limb motion. This does not prove that the account
captures everything the owner perceives there (inversion and grinding may also
matter), but it removes the earlier contradiction.

**Felt labels from June/July** (lower landings only). Mean Spearman ρ on the
four discriminating sets:

| ruler | ρ |
|---|---|
| old ruler | 0.828 |
| v1 | 0.805 |
| strike, body kernel | 0.785 |
| strike, centre-of-mass kernel | 0.775 |

The labels resolve about ±0.08, so these are equivalent. As the owner notes,
these labels contain no upper hits, so they check that clean lower landings
are preserved, nothing more.

**Physics probes** (the audit's synthetic tracks):

- **Flat landings:** strength rises monotonically with impact speed. Ceiling
  hits register (0.37 and 0.60).
- **Segment subdivision:** subdividing a floor into 10 or 100 segments gives
  identical results.
- **Washboard chatter:** a few small events, not dozens of strong ones.
- **Head-on walls:** detected as events (J ≈ 2–3) but with near-zero strength,
  because a stop is not a redirection. This is a known blind spot of the
  redirection kernel; it is rare in arc geometry and documented here.

**Across eras** (`npm run measure`):

| | July | current | experimental (v1) |
|---|---|---|---|
| strong extra strikes per beat | 0.05 | 0.37 | 0.12 |
| contested strong beats | 3% | 37% | 10% |
| median strength error, strong beats | 0.32 | 0.08 | 0.08 |

The account recovers the owner's sense that July was cleaner. It also shows
that the v1-optimized compiler still leaves strikes that v1 could not see.

## Limitations and open questions

- **Strength scale.** It is validated only on lower landings. Upper-hit
  strengths use the same physics, but no perceptual check exists for them.
- **Stops and decelerations.** Their strength is under-read (see the
  head-on-wall probe above).
- **Quiet beats.** Requested impacts below about 0.05 sit near the floor of
  any gentle touchdown.
- **Thresholds.** The 0.8 floor, the ½ valley and the 4-frame spacing are
  physical and perceptual choices, not fitted to the owner's labels.
  Sensitivity to them is reported by the evaluation and should be checked
  before tuning anything against them.

## Owner pair study (slam-2026-10, 2026-10-04)

Ten blind pairs of strong-requested hits from the strike library, matched on
strike strength: a body-first or guide-rail hit against a clean upright sled
landing (`tools/measure/hit_anatomy.ts`, `labels/studies/slam-2026-10.*`).

- **Which slams more:** body-first 4 (three of them guide or ceiling), clean
  sled 2, about the same 3, neither 1. Contact type does not explain weak
  hits. The definition is unchanged.
- **Owner's notes:**
  - A hit that only continues motion already under way ("we were already
    rotating, then a very subtle bump that doesn't change much") reads as
    weak, even at strike 0.82.
  - A rotation reversal or a sudden change of direction reads as an impact
    without any slam.
  - A bump on the curled front of the sled can be a valid medium impact.
- **Spin:** the magnitude of the change in body spin does not predict the
  choices. Hits chosen as slamming more include abrupt stops with almost no
  spin change.
- **October strength labels** (impact-2026-10, n = 26 with a strength, tie
  averaged Spearman, 95% bootstrap intervals):

  | measure | ρ | 95% interval |
  |---|---|---|
  | strike | 0.28 | [−0.09, 0.61] |
  | frozen landing | 0.25 | [−0.18, 0.60] |
  | approach speed into the line | 0.21 | [−0.17, 0.55] |
  | spin change | ≈ 0 | |

  No measure is separable on these labels. **No clip was felt harder than
  "medium"**, including beats requested at 1.0 and measured at 0.8. The top of
  the 0–1 scale (7.55 px/frame of redirection) is not what the owner calls
  hard, or the compiler never produces such hits.

## Impact pair study, round 1 (impact-pairs-2026-10, 2026-10-04)

The owner's description of impact (contact visibly changes the rider's motion,
a head-on stop is a very big impact, faster is stronger, clean = short,
spin changes count) gave a candidate strength: the largest change of the
rider's rigid-body motion within 50 ms (`tools/measure/motion_change.ts`).
Its parameters (2-frame window, ÷ 7.55) were fixed before any answer.

24 blind pairs (`tools/measure/select_pairs.ts`): 20 where strike strength
and the candidate disagree most, and 4 checks where both agree strongly.

- **Checks:** 4/4 as both measures predict.
- **Disagreements:** candidate 9, strike 6, about the same 4, neither 1.
  On decisive answers that is p ≈ 0.30 (sign test).
- **Agreement with the owner** (checks included, 19 decisive pairs):
  - strike 10/19;
  - candidate 13/19, and the same without the spin term;
  - candidate over the whole event 12/19.
- **"About the same" pairs:** the candidate's relative gaps were 0.21–0.55,
  strike's 0.30–0.89.
- **Owner's note (pair 9):** the faster hit looked bigger, consistent with a
  velocity-change measure.

The candidate leads but not decisively. Round 2 (impact-pairs-2026-10b, fresh
hits) has three blocks:
- confirmation, 10 pairs, candidate vs strike;
- spin, 7 pairs, candidate with vs without spin, at small margins because spin
  rarely changes the ranking;
- window, 7 pairs, 50 ms vs whole event;
- plus 3 checks.

## Impact pair study, rounds 1 + 2 (51 pairs, 39 decisive)

Scored by `tools/measure/analyze_pairs.ts`. Agreement with the owner on
decisive pairs (one-sided sign-test p against chance):

| measure | right | p |
|---|---|---|
| strike (product, `line.strike.v1`) | 15/39 | 0.95 |
| whole-body motion change, 50 ms (motion_change, fixed) | 31/39 | < 0.001 |
| same, as shown with the window bug | 29/39 | 0.002 |
| same, whole event | 30/39 | 0.001 |
| `c_arrive` (arrival into the surface; designed blind) | 29/39 | 0.002 |
| `c_arrive_spin` | 31/39 | < 0.001 |
| consistency checks | 7/7 | |

- **Strike against the candidate family.** Head to head, on pairs where strike
  and the fixed candidate disagree: 4 : 20 for the candidate. Round 2's
  confirmation block alone: strike right 5 of 20.
- **Verdict.** The current product strength disagrees with the owner. Its
  flaws are known from probes: it accumulates redirection over long smooth
  bends (r60 bend at v8 → 0.72) and is blind to head-on stops (0.19).
- **Among the candidates.** They are not yet separable: head to head they
  disagree on only 2–13 decisive pairs.
- **Hints only (n = 4–5):**
  - with spin 4/5 against without 1/5;
  - whole event 3/4 against 50 ms 1/4.
- **Bug disclosure.** Before the fix, the motion_change window could run into
  the next event (741 of 4,130 events). The values used to select both rounds
  carried that bug; the scores above use the fixed values, and "as shown" is
  reported beside them.

## Round 3 and adoption of line.strike.v2 (2026-10-04)

Round 3 (impact-pairs-2026-10c) had 26 pairs aimed at separating the
candidates; 24 were decisive.
- **Owner's notes:** a floor hit followed by an upper hit is two impacts, and
  he didn't like the upper hit there; "A looks cleaner and better defined".
- **Failed check.** In one check pair every measure rated a previous-library
  hit about twice as strong as a July hit, and the owner chose the July hit.
  Across all rounds, 9 of 10 checks matched.

All rounds, 63 decisive pairs:

| measure | right |
|---|---|
| strike v1 | 31/63 (pairs chosen where the measures disagree; head to head v2 wins 22 : 7) |
| whole-body change, 50 ms, with spin (`strength`) | 46/63 |
| whole-body change, whole event, with spin | 46/63 |
| arrival with spin (`c_arrive_spin`) | 45/63 |
| whole-body change without spin | 42/63 |
| arrival without spin | 41/63 |

- **Spin.** When adding spin was the only difference, the version with it won
  8 : 3 (p ≈ 0.11), supported but weakly. The earlier "12 : 4" counted 5 pairs
  twice (code review, 2026-10-05).
- **Window and framing.** 50 ms vs whole event: 13 : 13. Arrival vs
  whole-body change: 5 : 4.
- **Choice.** The owner cannot separate the window lengths, so 50 ms was
  chosen on principle: it matches "clean = short" and resists the long-bend
  accumulation that v1 rewards.

**line.strike.v2** keeps v1's events, timing and matching, with strength =
the largest whole-body motion change (travel and spin) within 2 frames over
the event's first 6 frames, ÷ 7.55. A test (`tests/strike_v2.test.ts`) proves
it equals the research measure the owner judged to 1e-9 on a compiled ride.

**Compiler under v2 (strike2-a against strike-v1-base, standard allowance;
hypothesis stated before running):**
- v2 impact loss 0.078 → 0.037; v2 strength rms 0.25 → 0.15 (both panels).
- Completion unchanged.
- Peak lag −9 ms; contested strong beats −1.6 pp (perturbed −2.1 pp).
- Strong extra impacts counted with v2 are neutral; counted with the old
  redirection kernels they are +0.04–0.06 per beat.
- v1 loss worse (+0.036), as expected.

v2 is now the product default. v1 stays as a comparison.

## line.strike.v3: opposite pushes are separate impacts (2026-10-04)

The owner sees a floor hit followed by an upper-rail hit as two impacts, and
disliked the second one.

- **Rule.** Inside a contact engagement, a frame whose contact push (the
  travel part of the whole-body impulse, at least `floor`) points more than
  120° away from the push at the current event's reference frame (its start,
  or the highest smoothed peak so far) starts a new impact. A corner (about
  90°) does not split.
- **Physical check.**
  - On rides with rails, 94% of the added splits start on an
    opposite-facing surface.
  - July, which has no rails, has none.
  - The count is insensitive to the threshold (107°–135°).
- **Effect as the objective:** double impacts per beat −0.13 / −0.16. The
  unrequested second hit now costs as an extra.
- **Tests.** `tests/strike_v2.test.ts` checks the split, the corner, and
  incremental against cold detection across a split.

