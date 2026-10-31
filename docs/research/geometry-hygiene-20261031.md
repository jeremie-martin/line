# Geometry hygiene: pass-throughs and untouched geometry (2026-10-31)

TODO item 7. This is a report, not a fix: nothing under `scripts/`, `benchmark/`,
`engine-rs/`, `tools/eval/`, top-level `tools/measure/*.ts` or `productions/`
changed. The research tools are in `tools/measure/geometry_hygiene/`. That
subfolder is outside the evaluation fingerprint, which reads only the top-level
`.ts` files of `tools/measure`. The commands, seeds, track hashes and every
count are in
[geometry-hygiene-20261031.json](geometry-hygiene-20261031.json).

## Summary

1. **Pass-throughs are common but small; one kind is visible, and it is
   pointless.**
   - On 24 fresh rides a rider point crosses a drawn line without colliding
     22 times per ride. Most crossings are 1–2 px dips into a line the rider
     is already touching.
   - A line drawn through the rider's body 3 px or more deep happens
     **2.8 times per ride**. At 5 px or more it happens 0.5 times per ride.
     Every case lasts 1–8 frames (median 2). The sled is about 15 px long.
   - The visible kind is a **back-side pass-through of the next section's
     lead-in**: the short straight segment the main rail starts with. Just
     before a beat, the rider flies through the lead-in of the section it is
     about to land on. It hits **folds** most: 40 of 119 fold sections,
     against 9 of about 1,500 other connected sections.
   - A second kind: **the rider falls into a guided channel through the
     guide's leading end, from above**. This happens in 36 of 745 paired,
     guide-required sections.
   - **These crossed segments are never used.** In 154 of 156 back-side
     crossings, the crossed segment is touched at no frame of the ride.
     Removing it leaves the ride byte-identical: 179 of 179 sampled replays
     with never-touched crossed segments removed.
2. **Untouched geometry is most of what is drawn.**
   - 62% of the drawn length (44% of segments) is never touched: about
     6,000 px per ride.
   - Removing all of it leaves every ride byte-identical (24 of 24).
   - It is **load-bearing for the bookkeeping, not for the ride**:
     - the layout (fulfilment) check reads shape from the geometry;
     - the judge infers guide roles from chain connectivity.
     - Removing all untouched lines breaks the role inference on every ride.
       Removing only untouched chain ends keeps the roles, but 12 sections
       per ride then fail the shape checks.
   - Every required guide is touched somewhere, but the median guide chain is
     touched over only 37% of its length. 28% of guide chains and 38% of
     receivers are touched only by the body (shoulder, hands, butt, feet),
     never by the sled.
   - The Trouble figure "1,137 guide segments, 681 touched" counts 531
     sub-pixel scattered fragments, all of them touched. The guide rails
     proper are touched at 150 of 606 segments (25%).
3. **Why.** Lead-ins are laid along the searched entry heading, not the
   arrival. The fold proposal rotates that heading by the turn on purpose.
   Guides are offsets of the whole main rail, starting just past the landing
   point. A one-sided line lets anything through from behind, so the search
   never sees these crossings. Nothing prunes geometry after the search.
4. **Options** (hypotheses, below):
   - trim untouched chain ends after the search (this removes 79% of the
     back-side crossings);
   - lay lead-ins along the arrival;
   - start guides after the catch;
   - a zero-physics geometric check against the stored path.

   Flipping line sides is not one of them.

## Data and method

- **Panel (decisions).** 24 fresh compiles at `a7d680f1` (rework/foundations):
  luna, amor, tiki and amour, seeds 7101–7106. They used `npm run produce`
  with the default allowance and line.strike.v3. All 24 are valid and
  fulfilled. This is a **small sample**: one compiler revision and 6 seeds per
  song. Rates are per ride over 1,095 s of riding. No intervals are given,
  only the per-song rows, which agree within a factor of about 1.7.
- **Trouble (held out).** Nine saved rides, read only as **observed
  examples**: `trouble-variants-v3/contrast-clusters-101…808`, plus
  `trouble-variants-v1/kick-101` for the 1,137/681 figure. Nothing is
  calibrated on them; their numbers are in the JSON. Trouble shows the same
  classes, at about half the panel's crossing rate: 3.6 back-side crossings
  per ride, 1.0 episode of 3 px or more, and 7 of 56 fold sections.
- **Replay.** Each saved track is replayed on the compiler's native engine
  (`scripts/lib/native_motion`).
  - Every point at every frame equals the result's saved trace exactly
    (maximum difference 0, 33 of 33 rides).
  - The layout check, re-run on the replay, reproduces the saved fulfilment on
    33 of 33 rides.
- **Collision rule** (`native_motion/src/line.rs`, a port of lr-core). Each
  line stops a point only from one side.
  - A point is caught when it moves into the line from that side and ends
    0–10 px behind it, within the line's span.
  - Lines are emitted with `flipped`, `leftExtended` and `rightExtended` all
    false.
- **Chain.** A connected run of a section's lines in id order. This is the
  same rule the judge uses (`arcRailGroups`). A point's side of a chain is
  taken from its nearest segment, using both normals at a shared vertex. A
  point beyond a free end of the chain is on neither side.
- **Pass-through crossing.** A point ends one frame on one side of a chain
  and the next frame on the other side, its path cuts the drawn chain, and
  it did not collide with that chain in that frame. Kinds:
  - **through-back**: the point was behind the line (on the side the line
    does not stop) and crossed to its catching side. One-sided lines never
    stop this.
  - **through-front**: the point crossed from the catching side and was not
    stopped. All 93 cases ended outside the crossed segment's collision span:
    it slipped past a joint.
  - **sink-pop**: while in contact, the point was pushed 0.5 px or more into
    the line, then left through it.
  - Separately, a **sink** is the same dip, resolved back onto the line
    without crossing.
- **Line drawn through the rider (episode).** Per chain, the frames where the
  chain cuts one of the rider's drawn bones with the bone's ends on opposite
  sides, merged with the frames of its crossings.
  - The bones are PEG–TAIL, TAIL–NOSE, NOSE–STRING, BUTT–SHOULDER, the arms
    and the legs.
  - **Depth** is how far the line sits inside the bone (the nearer bone end's
    distance), or how deep a point went for front and sink kinds.
- **Scale.** The sled is 15 px long and the whole rider spans about 18 px
  (median, luna 7101). The spec cameras zoom 1.55–2.8, so the rider is about
  25–50 screen px. A 3 px pass-through is a fifth of the sled.
- **Validation.**
  - Three known cases pass (`validate.ts`):
    - a roof crossed from above gives back-side crossings only;
    - the same segment as a floor gives a landing and no crossing;
    - a floor hit at 45 px/frame gives a front-side tunnel.
  - Frames were drawn from the trace and inspected for each class (the figures
    are `plot_event.py` outputs; the moments are listed in the JSON).
  - The first detector was rejected. A segment-level test, like
    `tools/measure/blind_spots.ts`, found 60 crossings on luna 7101. 43 of
    them were artefacts: the straight path between two frames cuts under a
    crest of a finely faceted rail while both frame ends stay on the free
    side. The chain-level test keeps 17.
  - The October 5 blind-spot rows ("pass-through ≥ 3 px", 6–8 per ride) used
    the segment-level test, so they probably include such artefacts. This was
    not re-checked.

## 1. Pass-throughs

### How often, and what kind (24 rides)

| kind | per ride | lines crossed (role) | depth p50 / p90 / max | frames on the wrong side p50 / max | sled / body point |
|---|---|---|---|---|---|
| **through-back** (from behind) | 6.5 | main 58, guide 51, lead-in 46, receiver 1 | 2.6 / 7.0 / 24.6 px | 1 / 4 | 92 / 64 |
| through-front (slipped past a joint) | 3.9 | main 61, guide 21, receiver 11 | 1.0 / 2.8 / 4.3 px | 1 / 3 | 57 / 36 |
| sink-pop (in contact) | 11.7 | main 211, guide 39, receiver 30 | 1.0 / 2.2 / 4.6 px | 1 / 7 | 181 / 99 |
| sink, resolved (not a crossing) | 63 | main 78%, guide 19% (≥ 1 px) | 149 reach ≥ 3 px | 1 / 7 | 786 of 986 ≥ 1 px |

"Lead-in" is the main rail's first segment (`approach` in the JSON). Telling
it apart from the first face is a length heuristic, so lead-in and main are
best read together.

### What a viewer could see: a line drawn through the rider

| depth | episodes per ride | with a point crossing | frames, median |
|---|---|---|---|
| ≥ 1 px | 38.8 | 28% | 1 |
| ≥ 2 px | 14.8 | 36% | 2 |
| **≥ 3 px** | **2.8** | 58% | 2 (max 8) |
| ≥ 5 px | 0.5 | 69% | 2 |

The 67 episodes of 3 px or more:
- 75% are on main rails or lead-ins and 25% on guides;
- 32 are on the next section's lines before its beat;
- the TAIL–NOSE board is cut in 52 of them.

Whether a 2-frame, 3–7 px cut is noticed at playing speed is **not verified**.
The owner's remark suggests the larger ones are.

### By section family (per section)

| family | sections | episodes ≥ 3 px | crossings | through-back |
|---|---|---|---|---|
| shaped, guide required, paired | 564 | 0.053 | 0.50 | 0.13 |
| shaped, guide required, transfer | 219 | 0.078 | 0.51 | 0.27 |
| arcs, guide required, paired | 181 | 0.072 | 0.32 | 0.13 |
| arcs, guide forbidden | 564 | 0.012 | 0.14 | 0.004 |
| arcs, guide required, transfer | 62 | 0 | 0.02 | 0 |
| scattered (fragments under 1 px) | 300 | 0 | 0 | 0 |

The back-side crossings concentrate in two places:

| mechanism | events (24 rides) | rides with any | where |
|---|---|---|---|
| **next section's lead-in** (lead-in or first face, 1–4 frames before its beat) | about 56 | 20 | **fold 40 of 119 sections**, arcs 7 of 831, terraces 2 of 203, others 0 |
| **guide entered from above** (its leading end, frames −1 to 0 of the beat) | about 38 | 18 | paired guide-required: 36 of 745 sections; transfer: 1 of 281 |

### Were they ever necessary?

- **Back-side crossings.** The crossed segment is never touched in the ride in
  154 of 156 cases. Of the 217 sampled episodes with a crossing, 179 had
  never-touched crossed segments. Removing those segments alone left the ride
  byte-identical in 179 of 179 replays. That also follows from the collision
  rule: a line that never collides cannot change the motion.
- **Sink-pops and front slips** happen on lines in use, often next to a
  segment being touched. Removing the crossed segment changes the ride
  whenever it is touched elsewhere (38 sampled cases). These are the engine
  resolving contact, not stray geometry.
- **The whole chain is used.** Removing the entire crossed chain changes the
  ride in 214 of 217 cases: it is the section's support.

### Mechanisms (figures checked frame by frame)

- **Lead-in from behind (folds above all).** `motionArc` starts every main
  rail with a straight lead-in of `max(20, 1.5 × speed)` px, laid back from
  the anchor along the searched entry heading.
  - When that heading differs from the rider's arrival, the lead-in's free
    end sticks up into the arrival path. The rider passes through it from
    behind, then lands just past the anchor.
  - Crossing rate by lead-in/arrival angle: 1% under 15°, 3% at 15–30°, 15%
    at 30–60°, 33% above 60°.
  - The median angle is 9° for arcs and 21° for folds, and folds have a long
    tail. The fold proposal sets `entry = incoming − turn − …` so that its
    first face, at heading entry + turn, matches the arrival. Its lead-in is
    therefore rotated away by about the turn.
  - Examples: amor 7102 at 29.95 s (seven points, 7 px, 2 frames); tiki 7105
    at 9.53 s.
- **Guide from above.** The guide is an offset of the main rail, 6–30 px
  away, starting two vertices after the anchor, which is right above the
  landing point. A rider that drops steeply onto the anchor brings its body
  down through the guide's leading end, which is the guide's back.
  Example: tiki 7103 at 15.68 s.
- **Sinks and sink-pops.** These are contact resolution in the engine. A
  point already on the line is dragged in by the rider's bones during the
  frame's iterations and is not pushed back, because it is moving outward.
  They are mostly the sled nose and tail, 1–2 px for 1–2 frames. Example:
  luna 7101 at 10.25 s, head down.
- **Joint slips.** At a convex joint between two unextended segments,
  neither line catches a point entering the wedge behind the corner. All
  cases are 4.3 px or less.

## 2. Untouched geometry

Never in any collision over the whole replay (24 rides; the totals include
scattered fragments):

| | segments untouched | length untouched | untouched px per ride |
|---|---|---|---|
| **all lines** | 44% | **62%** | 6,060 |
| main rail | 63% | 61% | 3,767 |
| lead-in (one per section) | 76% | 75% | 998 |
| guide (paired) | 63% | 59% | 917 |
| receiver (transfer) | 69% | 53% | 380 |
| scattered fragments (median 0.003 px long) | 0% | 0% | 0 |

**Where it sits.** These are runs of untouched segments inside a chain:

| run position | main rail, px/ride | guide, px/ride | receiver, px/ride |
|---|---|---|---|
| interior (skipped facets of a used surface, mean 5.6–8 px) | 1,859 | 552 | 160 |
| leading (lead-in and rail before the catch; guide start) | 1,529 | 92 | 175 |
| trailing (rail after the release; guide end) | 1,303 | 273 | 46 |
| whole chain | 74 (23 main rails) | 0 | 0 |

Interior runs are gaps between contacts on a continuous surface: rails are cut
into segments of about 2.7 px and the sled skips some. They are not clutter.
The visible candidates are the **ends**, about 3,500 px per ride (mean run
29 px, about two sled lengths), and the guides' untouched stretches:
- 43% of all untouched length is in runs of 24–100 px;
- 8% is in runs over 100 px;
- the rest is in runs under 24 px.

Examples:
- the final section of amor 7105 (44.3 s): a 380 px receiver, touched twice
  by the body;
- a guide-required section of tiki 7104 (3.6 s): the opposing-side
  construction, where the rider rides the lower chain and the 167 px upper
  "main" rail is never touched.

The 23 whole untouched main rails are all of this second kind: guide-required
paired sections where the rider uses only the other chain.

**Upper versus lower.** By the side a line catches from, upper lines (roofs:
guides, receivers, opposing-side rails) are 57% untouched by length, about
1,600 px per ride. Lower lines are 64% untouched. Of the upper segments that
are touched, **57% are touched only by the body**, against 19% for lower
lines. On Trouble, 115 of 241 guide chains are touched only by the body.

### Is it load-bearing?

| prune (replayed, then the layout check) | removed per ride | ride | judge's role inference | sections newly unfulfilled |
|---|---|---|---|---|
| every untouched line | 1,862 segments | identical 24 / 24 | **breaks on 24 / 24** (more than two chains) | 67 per ride |
| untouched chain ends only | 895 segments, 3,474 px | identical 24 / 24 | kept | 12 per ride (shape checks) |
| untouched lead-ins only | 50, 998 px | identical 24 / 24 | kept | 43 in total (fold corners, transfer corners, bypassed shape) |
| untouched leading guide segments | 88, 267 px | identical 24 / 24 | kept | 20 in total (transfer reversals) |

- **The physics never needs it.** That is guaranteed by the collision rule
  and confirmed by replay.
- **The bookkeeping does.**
  - The guide is "the second connected chain" (`arcRailGroups`), so a hole in
    a chain makes three chains, and the judge rejects the geometry.
  - The shape checks (`insubstantial-shape`, `bypassed-shape`,
    `missing-shaped-reversals`, fold and transfer corners) measure turning,
    reversals and progress on the drawn geometry, not on the touched part.
  - `inspectConstruction` takes the first main line to be the lead-in.
- **Required guides, used or not.** `unused-or-missing-guide` needs one guide
  contact frame and accepts any rider point. 208 of 752 guide chains satisfy
  it with body contacts only, which the unwanted-impacts report counts as
  extras.
- **By-product.**
  - Each main rail spans the whole searched support.
  - Each guide spans the main rail from its second vertex, unless the search
    shortens it.
  - Transfer layouts keep the full receiver while cutting the main rail to
    `mainEnd`.
  - No step removes what the ride did not use.

## 3. Where in the code

- **Lead-in.** `motionArc`, `scripts/v0/optimizer/arc_geometry.ts` lines
  50–54 (`approach = max(20, 1.5·speed)`, laid along `entry`).
- **Fold entry.** `scripts/v0/optimizer/arc_proposals.ts` lines 60–62
  (`entry = incoming − turn − …`). Entry is searched over −75…85°
  (`arc_motion_control.ts`).
- **Guide.** `arc_geometry.ts` lines 84–107: an offset from vertex 2 at
  `clearance` 6–30 px. `guideStart` and `guideEnd` are searchable with a
  default of full coverage (`arc_motion_control.ts` lines 40–49).
- **Transfer.** `arc_geometry.ts` lines 115–124 (main cut to `mainEnd`, full
  receiver); `observed_receiver.ts`.
- **Unextended lines.** `makeSolidLine`, `scripts/v0/arc.ts` line 55.
- **Why the search allows back-side crossings.** `traceCandidate`
  (`arc_evaluate.ts` line 142) checks that the rider's state before the
  section is unchanged. A line crossed from behind never collides, so it passes that check,
  and nothing in the objective sees it.
- **Fulfilment and roles.**
  - `repertoire_realization.ts` (`inspectConstruction`: guide contact by any
    point; shape from geometry; `main.slice(1)` as the shaped rail);
  - `repertoire_layout.ts` (transfer corners and reversals over the whole
    receiver);
  - `arc_rail_groups.ts`, used by production and the V6 judge
    (`tools/parity/v6_cell.ts`).
- **The 1,137 / 681 figure.** `production_repertoire.ts` line 28 records
  scattered sections' fragment "guides" in `railGuides`. `inspectRailContacts`
  (`scripts/gallery/contacts.ts`) then counts them as guide segments.

## 4. Options (hypotheses only)

| # | hypothesis | expected effect (from the measurements above) | risks |
|---|---|---|---|
| G1 | **Trim untouched chain ends after the search.** Use the final replay's collisions, which are already charged. | About 3,500 px per ride less drawn geometry (3,474 measured), roughly a third of all drawn length. Removes the crossed segment in **123 of 156** back-side crossings and in 28 of the 67 episodes of 3 px or more. The ride is identical by construction. | Changes track hashes, so it is behavioural by WORKING.md (parity references update). The shape and role checks read geometry: 12 sections per ride would fail unless the realization is computed before trimming or its rules change. Those files are shared with the frozen V6 judge (`parity:judge`). No extra native observation, so the frame allowance is unaffected. |
| G2 | **Lay the lead-in along the arrival** (or along the first face), especially for folds. | Targets 40 of 119 fold sections and 9 others, the most visible class. | Changes candidate geometry: physics, scores and completion move, so it needs a paired panel under every ruler. 24% of lead-ins are touched, by catches slightly before the anchor. Fold realization assumes the lead-in exists (`main.slice(1)`, `missing-fold-corners`). |
| G3 | **Start the guide after the catch** (a floor on `guideStart`, or begin at the first contact). | Targets 36 of 745 paired guided sections. | Guidance timing and body bumps on the guide (unwanted impacts B1) may change either way; behavioural. |
| G4 | **Geometric check against the stored path.** Reject or charge a candidate whose new lines cut the rider's already-simulated path. | Removes lead-in crossings by construction. | It reads cached positions, which advances no physics, so it costs no frames, but this needs verifying. Fewer viable candidates in dense passages, so a completion risk. |
| G5 | **Extend interior joints** (`leftExtended`/`rightExtended`). | Joint slips: 3.9 per ride, at most 4.3 px. | Changes every catch near a joint, for a small gain. Not recommended now. |
| G6 | **Flip a crossed line's side.** | Turns a pass-through into a collision: a new impact or a crash where nothing was intended. | **Not recommended.** These lines are crossed because they should not be there. |
| G7 | **Report connected guides apart from fragments** in `contactSummary`. | The touched guide share becomes honest: about 40% on panel rides (amor 7101: 283 / 712), 25% on Trouble kick-101 (150 / 606). | `contacts.ts` is in the production harness identity. Changes the report only, not tracks. |

The sink and sink-pop classes are engine contact resolution. No geometry
option above addresses them, and none is proposed.

## Examples for the owner

Collection:
`/motion-gallery/production.html?collection=/generated/geometry-hygiene-20261031/collection.json`.
Copy `generated/geometry-hygiene-20261031/` from the worktree into the main
checkout's `generated/`. The links need only the nine ride directories named
below plus `collection.json`. The `analysis/` and `logs/` subdirectories are
not needed. Each link opens a little before the moment.

| ride | time | what to look at | link |
|---|---|---|---|
| amor 7102 | 29.95 s | rider flies through the next fold's lead-in, 2 frames | [open](/motion-gallery/production.html?collection=/generated/geometry-hygiene-20261031/collection.json&data=/generated/geometry-hygiene-20261031/amor_na_praia_46s-7102/manifest.json&t=29.6) |
| tiki 7105 | 9.53 s | sled cut by the next fold's lead-in | [open](/motion-gallery/production.html?collection=/generated/geometry-hygiene-20261031/collection.json&data=/generated/geometry-hygiene-20261031/tiki_tiki_48s-7105/manifest.json&t=9.2) |
| luna 7103 | 8.00 s | through a serpentine section's lead-in (not a fold) | [open](/motion-gallery/production.html?collection=/generated/geometry-hygiene-20261031/collection.json&data=/generated/geometry-hygiene-20261031/luna_bala_44s-7103/manifest.json&t=7.7) |
| amour 7105 | 18.48 s | fold (transfer) lead-in through the body | [open](/motion-gallery/production.html?collection=/generated/geometry-hygiene-20261031/collection.json&data=/generated/geometry-hygiene-20261031/amour_de_ma_vie_44s-7105/manifest.json&t=18.2) |
| tiki 7103 | 15.68 s | falls through a guide's leading end into the channel | [open](/motion-gallery/production.html?collection=/generated/geometry-hygiene-20261031/collection.json&data=/generated/geometry-hygiene-20261031/tiki_tiki_48s-7103/manifest.json&t=15.4) |
| luna 7101 | 10.25 s | head-down sled nose dips 2 px into the rail (the common, small class) | [open](/motion-gallery/production.html?collection=/generated/geometry-hygiene-20261031/collection.json&data=/generated/geometry-hygiene-20261031/luna_bala_44s-7101/manifest.json&t=10.0) |
| amor 7105 | 34.5 s | deepest sink on the panel (5.7 px) | [open](/motion-gallery/production.html?collection=/generated/geometry-hygiene-20261031/collection.json&data=/generated/geometry-hygiene-20261031/amor_na_praia_46s-7105/manifest.json&t=34.2) |
| amor 7105 | 44.3 s | final receiver (380 px) touched twice by the body | [open](/motion-gallery/production.html?collection=/generated/geometry-hygiene-20261031/collection.json&data=/generated/geometry-hygiene-20261031/amor_na_praia_46s-7105/manifest.json&t=44.0) |
| tiki 7104 | 3.6 s | upper rail never touched; the rider rides the lower one | [open](/motion-gallery/production.html?collection=/generated/geometry-hygiene-20261031/collection.json&data=/generated/geometry-hygiene-20261031/tiki_tiki_48s-7104/manifest.json&t=3.3) |
| tiki 7103 | 40.9 s | 203 px guide touched only by the body | [open](/motion-gallery/production.html?collection=/generated/geometry-hygiene-20261031/collection.json&data=/generated/geometry-hygiene-20261031/tiki_tiki_48s-7103/manifest.json&t=40.6) |
| amor 7101 | 7.67 s | the section with the most untouched geometry (495 of 645 px) | [open](/motion-gallery/production.html?collection=/generated/geometry-hygiene-20261031/collection.json&data=/generated/geometry-hygiene-20261031/amor_na_praia_46s-7101/manifest.json&t=7.4) |

## Not verified

- **Perception.** Nothing here was judged by the owner:
  - whether 2-frame cuts of 3–7 px read as "going through";
  - whether untouched rails read as clutter;
  - whether the body-only guide contacts read as purposeful.
- **The review page.** It was not opened in a browser, and the collection
  has not been served. The manifests are the producer's own.
- **Fixes.** No option was implemented or compiled. The effects of G1 are
  counted on saved rides. G2–G4 would change the search, so their effects on
  completion, scores and frame counts are unknown.
- **Sample size.** 24 rides from one compiler revision; 119 fold sections.
  Trouble is 9 held-out rides used as examples only.
- **Lead-in identification.** It uses a length heuristic, and only 81 of 119
  fold lead-ins were identified for the angle table. The "next section,
  before its beat" counts do not depend on it.
- **Sub-frame motion.** Detection uses frame-end positions, which is what is
  drawn. Crossings inside a frame's six iterations that return by the frame's
  end are not counted.
- **Old rows.** The October 5 blind-spot pass-through rows were not recomputed
  with the chain-level test.
