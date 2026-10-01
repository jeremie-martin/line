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
