# Beat synchronization and perceptible impacts: investigation

The owner strongly endorses the delivered variety, geometry, originality and
motion. Preserve that direction. The new concern is that a rider's slam sometimes
does not feel synchronized with the music, despite a high headline score. The
request is to investigate first, without changing the compiler or prescribing a fix.

**There are measurable physical reasons for that impression. The evidence does
not point to a newly introduced dashboard clock shift or a recent impact-ruler
change.** First contact, accumulated impact, and the strongest visible response
are different events. The current contract constrains the first two, without
fully specifying the timing or prominence of the third. Some individual impacts
also fall substantially short of their existing targets.

This is not evidence that the latest motion work broadly damaged synchronization.
The preceding automatic arrangements have similar timing and worse aggregate
impact accuracy. The ordinary references remain more accurate in impact strength
and have fewer secondary contact events. Local regressions coexist with the
overall improvements. No production behavior, audio, saved track, scorer or
benchmark has been changed for this investigation.

## Scope and reproducibility

Replayed **36 records / 30 distinct tracks**: four production songs × three seeds
× current automatic, previous automatic, and ordinary reference. Ordinary has
six distinct tracks represented by twelve paired records; those copies are not
independent observations. Each version contains **945 authored contacts**, of
which **696 have authored impact ≥0.5**. Here “strong” is a diagnostic grouping,
not a newly calibrated aesthetic threshold. Sensitivity at 0.4, 0.6 and 0.8, plus
results deduplicated by track, are preserved.

Every saved audio/specification/analysis hash was checked. All lines are normal
type 0. All ten native physical point positions match every saved replay frame
exactly; the frozen judge reproduces every stored score and contact frame. Every
one of the 945 contacts in each version passes the existing ±1-frame timing gate.

- [Compact complete audit](evidence/beat-salience-audit-20261001.json.gz): all
  per-contact measurements, original record identities and contract assays.
- [Summary and mechanism probes](evidence/beat-salience-summary-20261001.json):
  all song/version groups, threshold sensitivity, playback measurements, selected
  examples and guide-removal comparisons.
- Large per-frame trajectories stay local under
  `generated/beat-salience-20261001/`; input hashes bind the compact evidence.

Reproduce on this checkout with the saved collections available:

```sh
LR_ENGINE=wasm node --import tsx scripts/gallery/study_beat_salience.ts
node scripts/gallery/check_beat_clock.mjs
python3 scripts/gallery/report_beat_salience.py
```

The browser command uses the running server at `http://127.0.0.1:8767` and
instruments responses in its own browser session. It does not edit the player.
The first replay-harness run encountered the two different audio-analysis schemas;
the harness was corrected to read both, then the complete panel was rerun.

## The clock is consistent; presentation is different

The native player reads `audio.currentTime`, multiplies by 40, and interpolates
the matching physical frames. There is no separately advancing animation clock.
Eight instrumented playback windows across all four songs, including seeks into
the music, captured **1,984 draws**. Visual time minus the sampled media time was
zero throughout. The worst per-window 95th-percentile draw interval was **17 ms**,
the largest interval **33.3 ms**, and the longest two-panel draw **4.2 ms**.
There was no accumulating software-clock drift in this test.

These are headless Chromium measurements on this host. They do **not** measure
speaker/Bluetooth latency, display scanout, browser behavior or dropped frames
on the owner's device. No precise owner timestamp/device reproduction has yet
been supplied for this new concern.

The dashboard camera is centered directly on the interpolated **PEG** point at
each frame, with fixed user-selected zoom. This holds that point stationary on
screen: the world translates around it, and the viewer sees body motion relative
to the sled. It does not apply the production camera's zoom plan or beat-punch
effect. Finished rendering adds an authored-impact-driven zoom pulse on selected
strong beats. That is a real presentation difference which could affect felt
accents; its perceptual contribution has **not** been established by an A/B review.
It also predates the latest compiler delivery and applies equally to native
current and reference playback.

## First contact is not the strongest response

Offsets below are relative to the **original authored musical times**, before
the production jolt and 40 Hz rounding. The physical peak is the largest
same-frame change between incoming and post-solver six-body-point mean velocity
within touchdown through touchdown+6. It excludes gravity already applied to the
incoming velocity. Position-derived motion gives similar timing, but neither is
a calibrated measure of a human observer's perceived instant of impact.

| Strong-beat observations (696 in each paired version) | Ordinary | Previous automatic | Current automatic |
|---|---:|---:|---:|
| Median first-contact offset | +40 ms | +35 ms | +35 ms |
| Median physical peak offset | +90 ms | +96 ms | +95 ms |
| 90th-percentile physical peak offset | +130 ms | +160 ms | +150 ms |
| Impact below 80% of its authored target | 0 | 102 | 87 |
| Impact below 50% of its authored target | 0 | 24 | 13 |
| Beat neighborhoods containing a detected bounce | 77 | 189 | 130 |
| Stronger physical peak after the landing window, before the midpoint to the next beat | 6 | 31 | 21 |

The last row is a conservative description of a later competing accent, not a
judgment that every such turn is undesirable. These rates are not population
estimates across unseen music. Counts include paired ordinary duplicates;
the distinct-track tables in the evidence preserve that distinction.

There is a common offset before physics even responds. `JOLT_DEFAULT_MS = -15`
and `applyJolt` subtracts that value, so it **delays authored contacts by 15 ms**.
Frame rounding makes the actual target shift +2.8 to +27.3 ms in this collection.
The current ride then lands on the rounded target in 366 cases and one frame
later in 579. The comment describing an earlier-contact compensation does not
describe what this negative default does. The setting is longstanding and is
identical for all comparisons, not a newly introduced regression. Changing its
sign alone is not demonstrated to resolve the concern: the subsequent physical
response varies by contact and construction.

## What the score does and does not establish

The impact formula, timing detector, normalization and musical evaluator are
unchanged between the preceding delivery (`ca97d100`) and this delivery. V6
changed arrangement/layout tasks, not that musical ruler. Its 835.6161 aggregate
is also not the score of every production song: current Amour examples score
roughly 581–599; other current production examples span roughly 768–873.

The existing impact measurement sums speed-weighted changes in body velocity
heading over seven contacted samples: touchdown and six more frames. At 40 Hz
the post-touchdown horizon is 150 ms. It does not require that bending be
concentrated at touchdown, nor explicitly locate the dominant jolt on the beat.
The engine's exposed stored velocity is the incoming velocity: the effects of
solving frame `f` appear in that velocity at `f+1` after gravity. The audit keeps
the existing scored clock and the same-frame physical clock separate, with
exact algebraic and replay checks. It does not silently “correct” the ruler.

A synthetic contract assay demonstrates the distinction: a turn concentrated
early, the same total turn spread over six samples, and the same turn concentrated
at the last sample all have **impact 0.5 and an impact-only score of 1000**.
Adding a later turn outside the window leaves that impact score unchanged. These
are detector-input examples of what the formula distinguishes, not claimed
physically realizable tracks or full benchmark runs.

The off-beat gate rejects extra **landings** after more than five airborne frames.
It does not reject every bounce, brief fly-through, body-only guide contact or
sharp redirection during continuous contact. Across the complete paired records:

| Detector events | Ordinary | Previous automatic | Current automatic |
|---|---:|---:|---:|
| Landings | 945 | 945 | 945 |
| Bounces | 271 | 406 | 329 |
| Fly-throughs | 12 | 9 | 27 |

Thus “no off-beat landings” does not mean “no additional physical accents.”
Likewise, impact error is averaged over contacts and then combined with other
axes. A high aggregate can coexist with locally weak hits. Both are limitations
of what a headline establishes, rather than evidence of changed score arithmetic.

## Concrete passages and causal checks

The following examples were selected to expose mechanisms, not as a representative
sample. The plot includes decoded audio as temporal context; waveform amplitude
alone does not identify the perceived musical beat.

![Audio, physical response and credited impact](evidence/beat-salience-examples-20261001.png)

**Tiki 101, authored beat 8.700 s: delayed physical emphasis despite accurate
impact.** Current folded support touches at 8.750 s. Target impact is 0.533 and
measured impact 0.539, but the largest physical response within the landing
window occurs at **8.900 s**, 200 ms after the authored beat. The ordinary
reference peaks at **8.750 s**, only 50 ms after it, with impact 0.542. Removing
this section's guide in an in-memory causal probe leaves the delayed peak and
impact exactly unchanged: its first guide collision is not until **9.150 s**.
The late accent here arises on the main support, not from an upper rail hit.

**Amour 101, authored beat 7.880 s: a genuinely weak intended landing.** The
current terraced transfer touches at 7.900 s but scores impact **0.183 against
1.000 requested**. Previous automatic reaches 0.950 and ordinary reaches 1.000.
This is a real local regression in an existing scored quantity, despite overall
improvement. Removing the guide leaves the weak landing's impact unchanged;
the first removed guide contact is at 8.100 s, after the measured landing window.
The later trajectory changes, so this is not a proposed guide-deletion fix.

**Tiki 202, authored beat 41.740 s: a stronger secondary accent.** The scattered
construction touches at 41.750 s and measures **0.584 against 0.586 requested**.
Its strongest landing-window velocity change is 1.731 px/frame, but another
contact at **41.950 s** produces **3.820 px/frame**, 2.21 times stronger. The
earlier brief shoulder/guide contact at 41.900 s matters: removing that section's
guides preserves the entire prefix to first affected contact and preserves the
scored impact exactly, while reducing the 41.950 s response to **0.0365**. The
largest response in the short modified replay becomes the original 1.731 landing
response. A guide can therefore create a later dominant accent without changing
the impact credited to the musical beat. This is a local mechanism assay, not a
complete, qualified replacement ride.

**Luna 303, 24.390 s: an improving comparison.** Current impact is 0.768 against
0.763 requested; its physical peak is 110 ms after the beat, versus 135 ms for
ordinary and 160 ms for previous automatic. The direction of change is not uniform.

These passages can be opened in the existing dashboard using the saved song/seed
and time; there is no separate diagnostic compiler or reauthored music.

## What remains open

The evidence supports separating three questions in the next discussion:

1. **Playback presentation:** compare the same saved ride with native and
   production camera behavior, without hiding physical timing behind an effect.
   A device-specific reproduction could additionally test actual audiovisual latency.
2. **Existing impact fidelity:** weak requested hits already have an objective
   error. Investigate search tradeoffs and local failures without assuming new
   geometry must be discarded. The latest campaign improves their aggregate but
   leaves substantial individual misses.
3. **Accent timing and competing motion:** agree what an intended musical accent
   should mean in a few listening examples before inventing a new optimization
   target. Track first contact, response timing/concentration, and secondary
   accents separately. Preserve quiet landings, useful expressive motion, and
   the positively reviewed variety.

No universal timing offset, guide ban, new benchmark version or added penalty is
justified by this study alone. The findings establish specific measurable issues
and counterexamples. They do not establish that one mechanism explains every
reported feeling or that all extra motion should be suppressed.

Validation: complete 36-record cold replay and score parity; three local guide
assays with exact prefix parity; four synthetic metric assays; eight browser
playback windows; **11 existing impact/recapture/overlay tests passed in four
test files**. The compiler and frozen contracts remain untouched.

## October 2: historical tracks and impacts between beats

The owner clarified that an upper-rail collision can create a visible accent
before an otherwise correctly scored landing. Preserve the established landing
impact definition and investigate the rest of the ride separately. Neither all
extra accents nor all guide contacts are undesirable by definition.

### Historical material recovered

There are **226 production videos from July 6–7** in
`generated/bundles/260706-235241/`: 76 Amor, 75 Luna and 75 Tiki. Their upload
metadata records compiler `e7c356e`. Individual production scores range from
654.1–686.2 for Tiki, 655.3–696.7 for Amor, and 713.1–757.2 for Luna. These are
not benchmark headlines. The July 17 output folder is empty; this search has
not recovered a specifically mid-July production batch. Most July bundles
retain videos and metadata rather than raw geometry.

The [inventory](evidence/historical-production-inventory-20261002.json) binds
all upload files and verifies video presence. Examples selected by earliest
upload time, not diagnostic outcome:

- [July Tiki](../generated/bundles/260706-235241/tiki_tiki_48s/tiki_tiki_48s-s946081389/video.mp4).
- [July Luna](../generated/bundles/260706-235241/luna_bala_44s/luna_bala_44s-s946081256/video.mp4).
- [July Amor](../generated/bundles/260706-235241/amor_na_praia_46s/amor_na_praia_46s-s946078955/video.mp4).
- [910-era Luna](../archives/arc-v3-910/luna_bala_44s/video.mp4), generated
  September 9 with seed 260908011. Canonical V3 headline 910.5248; this production
  track's score 905.3429.

One July 6 Amor geometry/report survives at
`generated/produce/_paritycheck/s946078916.track.json`, with its render log and
video. Its upload says `paritytest`, not a recoverable compiler hash. All 78
saved contact frames replay exactly and authored target times match the current
specification plus production jolt. No original full trajectory or audio hash
survives there; do not claim complete historical playback parity.

The study also replays three 852-era tracks and the 910-era Luna. Their archived
track/report hashes and current spec/audio/analysis identities match. All 305
contact frames and scored impacts reproduce. Twenty-four current/ordinary
records reproduce their full saved traces and prior diagnostic peaks. Total:
**29 records and 2,273 authored contacts**, not a multi-seed historical trial.

For 61 strong Amor beats, July's median physical landing peak is **75 ms** after
the beat, versus **100 ms** in the 852-era track and each current seed. Median
physical response share in the first two contact frames is **44.0%** in July,
versus **25.1–30.6%** currently. July measures weaker under today's impact ruler;
that does not refute cleaner perceived rhythm. The deliberate July 31 definition
change (`48dbda18`) prevents direct comparison of historical scores.

For Luna, the 910-era median peak is **100 ms**, versus **95 ms** currently:
there is no uniform timing regression. At **42.380 s**, however, the old track
has one decaying response, strongest at +70 ms. Current seed 101 also has an early
pulse at +70 ms, then a stronger pulse at +195 ms. Scored impact remains similar:
**0.564 / 0.540**, target **0.542**. Calling this only a late landing would miss
the split response.

![Historical comparison](evidence/historical-impact-examples-20261002.png)

### Continuous observations and causal checks

`scripts/gallery/ride_accents.ts` observes native frames without a landing gate:
mean body velocity correction, signed speed change, turning, and RMS corrections
of all six body points. The latter retains opposing movements cancelled in the
mean; its nontranslational part includes legitimate rotation and articulation.
These are kinematic quantities, not calibrated perceptual scores or forces.

Records include peak width/concentration, musical timing, nearby landing
strength, actual collision IDs and guide/support roles, plus the exact scoring
gates. Sweeps at 0.5/1/2 absolute units and 0.5/1/2 times the nearby landing peak
expose threshold sensitivity. No threshold becomes an artistic rule.

All **36 saved records** are replayed: 12 current, 12 previous, 12 ordinary
(only six distinct ordinary tracks). Mean correction matches the previous
independent frame audit within 1e-8. No compiler, judge, arrangement or player
change is involved.

| Passage | Before next beat | One-frame turn | Extra/landing peak | Next target / achieved | Jolt after guide removal |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tiki 303, 12.450 s, S transfer | 167 ms | 22.75° | 2.62× | 0.657 / 0.640 | 4.238 → 0.059 |
| Luna 202, 15.975 s, ripple transfer | 235 ms | 15.25° | 1.73× | 0.659 / 0.651 | 2.790 → 0.123 |
| Luna 303, 9.950 s, scattered | 260 ms | 12.35° | 1.94× | 0.358 / 0.339 | 2.302 → 0.034 |
| Ordinary Amor 101, 23.175 s, paired arc | 225 ms | 11.37° | 1.63× | 0.624 / 0.619 | 2.332 → 0.065 |

Each guide deletion preserves all ten rider-point positions exactly until first
removed contact, and preserves the earlier completed landing impact. Probes
end shortly after the jolt, before the next landing. This establishes local
causation, **not** a valid replacement or preservation of the next target.

The three current examples slow the rider by 0.83, 0.52 and 0.20 units/frame.
Positive-speed-gain limits therefore miss them. They are outside all scored
landing windows; the next stored-velocity frame is also airborne under the sled
detector, so its contact-gated redirection contribution is zero. Tiki is labeled
a **kick** on the next frame; the other two have no detector event within four
frames. An off-beat-*landing* gate does not prohibit every forceful collision.
The search's direction/absolute-correction residuals apply only below requested
impact 0.2 and average over the interval; these energetic passages are outside
that calm-specific rule. This is a coverage gap, not a recent scorer change.

A fifth positive probe, Amour 101's terrace guide at 7.725 s, reduces correction
**2.170 → 0.046**. It lies at the tail of the previous landing window while nearer
the next beat, making temporal attribution ambiguous. A **negative control**
removes Luna 101's final guide: the second pulse at 42.575 s remains **1.807**,
with identical trajectory throughout the assay. That support pulse precedes
the first guide contact at 42.650 s. Guides do not explain every split hit.

![Competing guide collisions](evidence/ride-accents-examples-20261002.png)

### Population evidence and limits

Descriptive screen: correction ≥1, outside every physical landing window, >75 ms
from the nearest beat, stronger than that landing's peak, and authored impact
≥0.5. Each collection below contains 696 strong beat occurrences:

| Collection | Extra peaks | Before / after nearest beat | Recent guide contact | Slowing down |
| --- | ---: | ---: | ---: | ---: |
| Ordinary | 16 | 10 / 6 | 16 | 0 |
| Previous automatic | 43 | 9 / 34 | 31 | 23 |
| Current automatic | 34 | 12 / 22 | 30 | 17 |

These are peaks, not independent affected beats or listener judgments.
Deduplicating ordinary gives 8 peaks / 394 strong beats / six tracks; both views
are saved. Raising the absolute floor to 2 gives 4 / 22 / 17; requiring >2× the
landing peak gives 0 / 7 / 2. Guide proximity is association except in the
explicit causal probes.

The direction is not universal. Across **all** target strengths, the same
screen gives **94 / 143 / 78**: current automatic improves the broad count over
ordinary, while retaining more competing accents around strong beats. Minimizing
all jolts would misrepresent the evidence and suppress useful motion. Extra
body-point movement is likewise diagnostic, not automatically a flaw.

This establishes several concrete instances of the owner's mechanism, not that
it explains most of the perceived problem. Weak intended hits, split support
responses, musical context and camera presentation remain relevant. The specific
Tiki listening check is pending; technical work does not depend on the reply.

Keep the landing metric and frozen benchmark. Use complementary observations
for landing concentration, extra accent dominance/timing, body response, and
collision provenance. Before defining a new scalar, compare welcome transfers
and unwelcome jolts across ordinary/new geometry and quiet/energetic passages.
Next causal compiler studies should test gentler or distributed receiver
engagement with matched incoming states and full suffix reconstruction. Preserve
requested geometry and the possibility of useful accents at musical subdivisions
not represented by the contact specification.

Evidence: [summary](evidence/ride-accents-summary-20261002.json),
[whole-ride audit](evidence/ride-accents-audit-20261002.json.gz),
[historical audit](evidence/historical-impact-audit-20261002.json.gz).
Raw frames stay local under `generated/ride-accents-20261002/` and
`generated/beat-salience-history-20261002/`. Reproduce with
`study_historical_impacts.ts`, `study_ride_accents.ts`, and
`report_ride_accents.py` in `scripts/gallery/`.

Validation: 36 accent replays, 29 historical/current replays, five positive
probes plus one negative control, **64 tests passing in five files**, and browser
verification of the linked Tiki passage (native replay loaded, music advanced,
no page errors). The repository TypeScript check still reports 251 diagnostics;
none are in the added investigation files. No global clean-build claim.
