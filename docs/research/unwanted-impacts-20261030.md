# Unwanted impacts: a diagnosis (2026-10-30)

TODO item 3. This is a report, not a fix: nothing under `scripts/`, `tools/`,
`benchmark/` or `productions/` changed. The evidence, the definitions and the
code of every number are in
[unwanted-impacts-20261030.json](unwanted-impacts-20261030.json).

## Summary

1. **Mostly real, and the measure misses the biggest ones.**
   - The unrequested impacts that line.strike.v3 counts are real contacts. The
     frame-by-frame checks found no phantom event.
   - Most counted extras are weak (median 0.05). The cost is carried by the
     rider's shoulder or hands hitting an upper guide rail shortly after a
     strong hit.
   - The account misses stronger pushes. About 3 per ride (median 0.3–0.37,
     up to 0.95) fall outside every event's own frames. That is three times
     the counted extras at 0.2 or more.
   - Two of the misses are detector defects:
     - a renewal whose 6-frame window ends before its own peak;
     - a gentle touchdown followed by a hard turn with no valley in between,
       which can never form an event.
2. **Where they happen.** On the panel there are 7.8 counted extras of 0.1 or
   more per authored ride (0.10 per beat) and 4.6 per perturbed ride.
   - 71% come within 12 frames after a strong matched hit.
   - 94% touch a line whose solid side faces down: a roof, nearly always the
     guide.
   - Transfer (later-receiver) sections are 9% of sections but cause 48% of
     the extra cost.
   - Uncounted turns follow quiet catches: 55% of quiet touchdowns.
   - Long floats and seams are minor on the panel.
3. **Mechanisms.**
   - The body hits the guide or receiving rail.
   - The fulfilment rules require a guide contact, which the catch does not
     always supply.
   - The sled re-lands after a 1–3 frame hop.
   - On quiet beats the catch touches down gently and the rail turns the
     rider sharply 6–9 frames later.
4. **Why the search keeps them.**
   - Transfer sections must make a separated second contact: 324 of 332 touch
     their receiver only through unmatched events. The fulfilment check
     rejects any candidate that avoids it.
   - Elsewhere an extra is cheap: one of 0.15 costs the search what a 0.11
     strength error on the current beat costs.
   - The uncounted class costs nothing. Quiet catches put their force peak
     just outside the counted window, at 6–9 frames; only 8 of 262 fall at
     2–5.
5. **Candidate fixes** (hypotheses below). The measure comes first. Then the
   transfer and guide-required rules. A plain extra-weight increase last.

## Data and method

- **Panel.** The 48 compiles of `v-s2x100-dev` and `-confirm`: compiler
  8ede128f, measurement fingerprint d3f26d1b, tracks identical to HEAD.
  - The four rides produced for the review links are byte-identical to their
    panel tracks.
  - Recomputing line.strike.v3 reproduces every saved loss exactly (56/56
    rides with Trouble).
- **Trouble.** The eight variant rides (`generated/trouble-variants-v1`) are
  held-out music.
  - They are used as observed examples and as a third column only. Nothing
    below is calibrated on them.
  - pulse-101 (incomplete) is excluded from the rates.
- **Unwanted impact.** An unmatched v3 event, as `tools/eval/measure.ts`
  computes it.
  - Its cost is (raw/7.55)²/beats, its term in the account.
  - Strength is the v3 number. The owner's labels validate its ordering, not
    its scale.
- **Line roles.**
  - The guide is the second connected chain of a section with two chains. On
    679 sections this equals the production report's `railGuides` exactly.
  - A ceiling line has its solid side facing down. 1,519 of 1,524 downward
    pushes touch one.
- **Uncounted pushes.** A replay of the detector's walk finds force maxima
  (smoothed J ≥ the 0.8 floor) that lie in no event's frames. They are scored
  with the same 2-frame formula.
- **Layouts.** The seeded plan of each panel case was reproduced with the
  planner alone (`planIntentionalRepertoire`) and checked against the track:
  no forbidden-guide section has a guide.
- **Thresholds.** Distributions and cost shares are the primary results;
  0.1 and 0.2 are only reading aids. Tables at 0.05–0.3 are in the JSON, and
  every conclusion below holds across them.

## 1. Is it real?

### Frame-by-frame sample

| example | v3 | what the frames show | verdict |
|---|---|---|---|
| Trouble slam 101, 3.85 s | 0.38 | **Not a float.** A 0.30 catch at 3.52 s on a 45° terraces rail. At 3.70–3.78 s the shoulder grazes the (required) guide above, a body-only 0.16 event that pushes the rider down. The sled re-lands at 3.85 s: a 14° turn in 2 frames at 10 px/frame. Then a scoop. | real, medium |
| amour 101, 8.05 s | 0.33 | After a 0.53 hit the rider leaves the rail for 3 frames. The shoulder and hands then strike the upper rail of a transfer section, a downward push of 2.5 px/frame in 2 frames. | real, medium |
| amour 101, 7.75 s | 0.16 | Same pattern after a 0.64 hit: SHOULDER, RHAND and LHAND on the guide. | real, weak |
| tiki 606, 17.57 s | 0.13 | 0.65 floor hit, then 6 frames later the shoulder taps the roof. v3 splits it as an opposite push. | real, weak |
| amour 101, 2.62 s | 0.13 | A gentle nose landing, one contact-free frame, then the tail settles. It is counted only because of that single free frame, and is mostly spin. | borderline (identity artefact) |
| amour 101 p1, 38.05 s | 0.05 | The string point taps the rail after a 1-frame gap while the sled keeps sliding. | invisible, nearly free |
| amour 303, 1.62 s | **0.80 uncounted** | Quiet intro. The shoulder drags on the guide for 7 frames (counted 0.10), then the sled slams onto the flat main rail (J 3.3). The renewal's window is 57–62; the hit is at 64–66. | real, strong, **missed** |
| tiki 101, 42.83 s | **0.50 uncounted** | A quiet beat (0.03) is matched at 0.04 by a nose touchdown. Four frames after the beat the sled runs through a 36° kink in the rail. Force only rose, so no event can start. | real, medium, **missed** |
| luna 101 p1, 3.55 s | **0.95 uncounted** | A 45° slope into a flat bottom: velocity turns 60° in 3 frames. The event's window ends 3 frames before. | real, strong, **missed** |

### Where the measure over- and under-counts

| issue | effect | size on the panel |
|---|---|---|
| **Renewal window before its peak** (defect) | The strike start walks back to just after a long, flat trough. Its 6 frames can end before the renewing peak. The hit is then measured on the frames before it and belongs to no event. | 6 cases (0.19–0.95 measured as 0.03–0.12); 9 on Trouble |
| **Force rising since a touchdown** (blind spot) | The renewal rule needs a trough after the current peak. When force only rises from a gentle touchdown, the touchdown's frame stays the peak, and the hit after its 6 frames is never an event. "A strike after a weak touch is never hidden" fails here. | 86 cases, median 0.37, 39 ≥ 0.4; 79 follow a quiet matched beat |
| sustained contact (spacing, valley) | Force maxima without a 0.5 valley, or within 4 frames of the last peak. This is steering by design, but the turns are sharp. | 65 cases, median about 0.3 |
| 1-frame contact gaps | A single free frame makes a new touchdown. Otherwise the same motion would be folded or uncounted. | 243 extras, median 0.02; 9–14% of extra cost |
| spin-dominated weak events | Extras whose push is more than 70% spin. | 23% of extras, 5% of those ≥ 0.1 |
| body vs sled | Counted alike, correctly by the definition: the whole-body change is the same physics. Whether a shoulder bump reads as a hit is unvalidated. | 84% of extras ≥ 0.1 involve a body point |
| opposite pushes | v3 separates floor-then-roof correctly. Every split checked was a real second contact. | 37 extras, 10% of authored extra cost |

Altogether the account sees 48 extras of 0.2 or more on the panel and misses
155 force maxima of that size. Pass-throughs (lines crossing the rider
without contact) produce no impulse and are outside this measure. They are
already a blind-spot guard row.

## 2. How often and where

### Prevalence (counted extras)

| | authored (32 rides) | perturbed (16) | Trouble (7, held out) |
|---|---|---|---|
| per ride / per beat | 28.5 / 0.36 | 20.8 / 0.26 | 35.1 / 0.57 |
| ≥ 0.1 per ride / per beat | 7.8 / 0.099 | 4.6 / 0.058 | 6.3 / 0.102 |
| ≥ 0.2 per ride | 1.06 | 0.88 | 0.43 |
| strength p50 / p90 / max | 0.054 / 0.148 / 0.327 | 0.043 / 0.150 / 0.302 | 0.042 / 0.127 / 0.378 |
| matched hits p50, for scale | 0.55 | 0.56 | 0.36 |
| share of v3 loss | 12% | 9% | 31% |

- **Authored vs perturbed is a seed effect, not a perturbation effect.**
  Counted against the 101/505 authored rides their perturbations come from,
  the perturbed rides have 0.058 against 0.044 extras ≥ 0.1 per beat. The
  other authored seeds have 0.117.
- **Song.** Rates per beat at 0.1 and above: luna 0.031, amor 0.036,
  tiki 0.069, amour 0.192 (dense and strong).

### Situations (extras ≥ 0.1, authored; perturbed in brackets)

| situation | extras | matched hits, for comparison |
|---|---|---|
| ≤ 12 frames after a matched hit ≥ 0.5 | 71% (63%) | 3% |
| touches a ceiling line | 94% (86%) | 46% |
| touches a guide rail | 90% (81%) | 31% |
| body point in contact / body only | 84% / 31% | 76% / 0% |
| inter-beat gap < 16 frames (dense) | 29% (14%) | 14% |
| inter-beat gap ≥ 1 s (long float) | 5% (3%) | 3% |
| rising at contact (upward) | 18% (8%) | 0% |
| contacts a new section (seam) | 2% (1%) | 99% (sections start at beats) |

Trouble differs: 36% of its extras ≥ 0.1 sit in gaps of a second or more and
32% start rising. Its slam example is a long gap that the planner filled with
a guide-required terraces section.

### Mechanism classes (share of extra cost; the full table is in the JSON)

| class | authored | perturbed | Trouble |
|---|---|---|---|
| B1: body on the guide rail (roof push) | **69%** | **66%** | 40% |
| A: opposite-push split (floor, then roof) | 10% | 3% | 0% |
| C: sled re-lands after a 1–3 frame hop | 10% | 14% | 35% |
| B3: sled on a ceiling line | 8% | 6% | 3% |
| B2: body on another upper line | 2% | 6% | 3% |
| D: touchdown after a longer flight | 1% | 4% | 8% |
| E: renewal within contact | 0% | 1% | 11% |

### By planned section (panel, 48 rides)

| section request | sections | extras ≥ 0.1 per section | share of extra cost |
|---|---|---|---|
| shaped or arcs, guide required, **transfer** | 332 | 0.33–0.57 | **48%** |
| shaped, guide required, paired | 1,336 | 0.09–0.12 | 38% |
| scattered | 679 | 0.025 | 6% |
| arcs, guide required, paired | 286 | 0.024 | 3% |
| arcs, guide forbidden | 1,147 | 0.002 | 1% |

Within each song, the transfer share of a ride ranks with its extra cost:
Spearman 0.71–0.76.

### Uncounted pushes

Uncounted force maxima run about 3.2 per authored ride and 3.5 per perturbed
ride. They concentrate in a different place from the counted ones: 63 of the
92 "rising" and window cases are in open arcs with the guide forbidden, after
quiet beats.

Quiet catches (asks ≤ 0.15) on the panel:

| frames after contact of the largest force | 0–1 | 2–5 | 6–9 | 10–15 |
|---|---|---|---|---|
| quiet catches with a 2-frame change ≥ 0.2 there (262 of 421) | 24 | **8** | **173** | 57 |
| same, at ≥ 0.1 / ≥ 0.3 | 40 / 4 | 25 / 1 | 220 / 64 | 101 / 18 |
| medium asks (0.15–0.6), ≥ 0.2 | 572 | 642 | 6 | 0 |

The account measures only frames 0–5 of a touchdown. Quiet catches avoid 2–5
and pile up just after.

## 3. Mechanisms

- **Roof contact after a strong hit (B1, A).** A strong catch on the main rail
  rotates the rider or throws it up. Within about 6–10 frames the shoulder or
  hands meet the guide above, which pushes them down. The guide is there by
  construction: guide-required shapes and transfer receivers.
- **Required guide contact.** 19% of paired guide-required sections touch
  their guide only through extras. The fulfilment check (`unused-or-missing-guide`)
  needs the touch. Trouble slam 101 is this case: the catch missed the guide,
  the shoulder grazed it later, and the sled re-landed at 0.38.
- **Transfer receivers.** The transfer check (`missing-separated-transfer`)
  requires a contact-free frame after the main rail, then at least two frames
  on the receiver. Any such contact away from a beat is an unmatched
  touchdown.
  - 324 of 332 transfer sections touch the receiver only through unmatched
    events.
  - 45% of transfer sections have one of 0.1 or more, and 10% of 0.2 or more.
- **Hops (C).** The sled leaves the rail for 1–3 frames after a landing or on
  a crest and comes back. These events are mostly very weak (median 0.02).
- **Turns after quiet catches (uncounted).** A gentle touchdown on a steep
  part of a rail, then the rail's sharp bend or kink 6–9 frames later. It is
  mostly an open arc's bottom.
- **Missed renewals.** A body drag or light contact sets the trough. A slam
  more than 6 frames after the trough's end belongs to no window.

## 4. Why the search keeps them

- **Forced by the request (transfer, about half the cost).**
  - Fulfilment is a hard rejection. Extras are a soft cost.
  - No candidate that satisfies a transfer request can avoid the separated
    receiver contact, unless the contact lands within 4 frames of the next
    beat. Only 9 of 332 sections achieve that.
  - The search can only make the contact gentle: the median strongest is
    0.09.
  - Strong asks delivered by transfer sections are not stronger than by paired
    ones. Median bias is −0.12 and −0.10 against −0.10 for paired shaped
    sections. Their in-section extra cost is 5–15 times higher. (Plans differ
    between rides, so this is observational.)
- **Cheap elsewhere.**
  - In the local search cost an extra s costs s². The current beat's strength
    error e costs 2e².
  - So an extra of 0.15 is worth a 0.106 strength error, or a 0.15 air or
    speed error. Extras are a median 7% of the axis objective.
  - After strong asks, avoiding the guide competes with the steep arrival and
    the strength the beat asks for.
- **Invisible (uncounted).**
  - Pushes outside every event cost nothing in the account or the search
    residuals.
  - Quiet catches place their main force exactly where it is not counted, at
    6–9 frames. Nothing about the physics would forbid 2–5.
  - This is the pattern of a search exploiting a window. It is inferred: no
    counterfactual was run.
- **Not checked.**
  - Whether better alternatives existed in a given section. Seeing that needs
    either a search trace or a counterfactual compile, which needs compiler
    options that do not exist (the profile is fixed in code).

## 5. Candidate fixes (hypotheses only)

Order matters. The measure first: optimizing the current account harder would
reward moving force further out of its window.

| # | hypothesis | expected effect | cost and risk | test |
|---|---|---|---|---|
| U1 | **Measure (new contract identity).** Keep the renewing peak inside the strike's own frames. Let a renewal start after a touchdown whose own peak is at most valley × the new peak, even with no later trough. | Panel: about +2 events per ride, mostly unmatched 0.2–0.5 after quiet beats, plus 6 corrected strengths; more if sub-floor turns count. The v3 loss rises; quiet asks get a real cost. | A contract change: remeasure every run. It may also split some long smooth bends. | Remeasure saved panels first (measurement only). Then blind owner pairs, held-out, where the revised identity disagrees with v3 (quiet catch with a kink against without). **Adopt as an objective only if the pairs agree.** |
| U2 | **Transfer receiver on a beat.** Require the receiving contact to be the next matched beat, or plan transfers only where it can be. | Up to about half of the counted extra cost and about 0.05 extras ≥ 0.1 per beat. | The owner liked separate upper receivers ("with variety, not everywhere"). Fewer realizable transfers; completion risk in dense passages. | Paired dev and confirm, every ruler. Report extras by class, body drag, completion separately, fulfilment and family mix. Owner pairs on transfer passages. |
| U3 | **Guide requirement met by the catch.** Count a guide-required section as fulfilled only if the guide contact is part of the matched catch. Or make guidance optional where the catch does not use it. | Removes forced late guide touches: 306 of 1,622 paired sections; 128 with an extra ≥ 0.1. | Fewer realized guided shapes; the realization rule is shared with the frozen judge files (the parity:judge gate). | As U2. |
| U4 | **Extra weight in the search.** The existing `extraWeight`, default 1, raised to about 2–3. | Softer bumps where the geometry allows; no effect on forced or uncounted pushes. | Trades strength and speed. Must be weighed after U1, or it moves force out of the window. | Paired, every ruler, before and after U1. |
| U5 | **Fuse 1-frame contact gaps** in identity. | Fewer near-invisible C events; more consistent identity. | Small cost effect (about 10% of extra cost); a contract change. | With U1's study. |

Observed on Trouble only, so not a proposal: the planner filled a 2.25 s float
(air ask 0.81) with a guide-required terraces section. The panel has too few
long gaps to test a rule for this. It needs new music.

## Examples for the owner

Collection: `/motion-gallery/production.html?collection=/generated/unwanted-impacts-20261030/collection.json`.
The panel rides were reproduced into `generated/unwanted-impacts-20261030`
(main checkout), identical to the panel tracks. Each link opens the ride a
little before the moment (`&t=`).

| ride | time | what to look at | link |
|---|---|---|---|
| amour 101 | 8.05 s | body strikes the upper receiving rail after a strong hit (0.33) | [open](/motion-gallery/production.html?collection=/generated/unwanted-impacts-20261030/collection.json&data=/generated/unwanted-impacts-20261030/amour_de_ma_vie_44s-101/manifest.json&t=7.9) |
| amour 101 | 7.75 s | same, weaker (0.16) | [open](/motion-gallery/production.html?collection=/generated/unwanted-impacts-20261030/collection.json&data=/generated/unwanted-impacts-20261030/amour_de_ma_vie_44s-101/manifest.json&t=7.6) |
| amour 303 | 1.62 s | uncounted 0.80 slam in a quiet intro, after a shoulder drag on the guide | [open](/motion-gallery/production.html?collection=/generated/unwanted-impacts-20261030/collection.json&data=/generated/unwanted-impacts-20261030/amour_de_ma_vie_44s-303/manifest.json&t=1.3) |
| amour 303 | 13.65 s | guide bump in a paired scallop (0.27) | [open](/motion-gallery/production.html?collection=/generated/unwanted-impacts-20261030/collection.json&data=/generated/unwanted-impacts-20261030/amour_de_ma_vie_44s-303/manifest.json&t=13.5) |
| tiki 101 | 42.83 s | quiet beat, then an uncounted 0.50 kink | [open](/motion-gallery/production.html?collection=/generated/unwanted-impacts-20261030/collection.json&data=/generated/unwanted-impacts-20261030/tiki_tiki_48s-101/manifest.json&t=42.5) |
| luna 404 | 2.10 s | quiet beat, then an uncounted 0.39 turn | [open](/motion-gallery/production.html?collection=/generated/unwanted-impacts-20261030/collection.json&data=/generated/unwanted-impacts-20261030/luna_bala_44s-404/manifest.json&t=1.8) |
| luna 404 | 25.15 s | receiving-rail bump (0.21) | [open](/motion-gallery/production.html?collection=/generated/unwanted-impacts-20261030/collection.json&data=/generated/unwanted-impacts-20261030/luna_bala_44s-404/manifest.json&t=25.0) |
| Trouble slam 101 (held out) | 3.70–4.22 s | guide graze, re-landing 0.38, then a scoop: 0.39 by its own frames, measured 0.22 | [open](/motion-gallery/production.html?collection=/generated/unwanted-impacts-20261030/collection.json&data=/generated/trouble-variants-v1/slam-101/manifest.json&t=3.4) |

## Not verified

- **Perception.** No owner judgment here. Whether a shoulder bump of 0.15
  about 200 ms after a 0.6 slam reads as a second hit or as part of the first
  is an owner question, and so is whether the uncounted kinks read as hits.
- **The review page.** It was not opened in a browser. The collection was
  written with `writeGalleryJson`, and the manifests are the producer's own.
- **Counterfactual alternatives.** No search trace or modified compile was
  run (Q4's "had alternatives" is answered only for the forced classes).
- **Guide roles for scattered fragments.** These are not classified (sections
  with more than two chains); their roof contacts are still counted as
  ceiling contacts.
- **Amour's resolved-input identity.** It differs from the panel run because
  Amour's spec file moved; its targets are identical and the reproduced track
  is byte-identical.
- **No reusable tool was committed.** Any new file in `tools/measure` changes
  the evaluation fingerprint, so existing runs could not be paired with new
  ones without remeasurement. The scratch code is embedded in the evidence
  JSON.
