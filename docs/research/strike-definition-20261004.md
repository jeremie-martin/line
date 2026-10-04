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
