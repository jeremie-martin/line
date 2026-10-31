# The compiler: framing the next work (2026-10-31)

A framing for discussion, not a design. It states what the compiler is for,
which concepts it currently relies on and whether each earns its place, what we
have observed (with how far each observation reaches), several candidate
approaches, and how we would compare them. No approach here is assumed to be
the answer.

## 1. What the compiler is for

To find geometry on which the rider lands the requested impacts at the
requested times, with the requested air and speed, in rides that look good to
the owner. "Looks good" includes clean geometry, no unwanted impacts, and
variety that feels intentional rather than random. Low error is necessary but
not sufficient: the earlier score-only compiler used one or two geometries and
was boring.

## 2. The concepts it relies on today, and whether each earns its place

| concept | why it exists | evidence for | evidence against / open |
|---|---|---|---|
| **Seeded plan:** one family per phrase of 2–3 sections, drawn by weight | a quick way to get variety | about 6 families per ride; the owner liked many guided shapes | It is a lottery, blind to what each section affords. Its choices are hard orders the search cannot revise, so the search either satisfies the request or fails. |
| **Shaped families:** fold, serpentine, scallops, terraces | visible variety | the owner liked folds in places | Folds cause the visible pass-throughs (40 of 119 fold lead-ins crossed from behind). Most short-pair failures were folds. |
| **Guide rail** (an upper rail) | guided shapes; bounces off the upper rail | the owner loves an upper then lower hit on two beats | "Guide required" can be met by a late stray touch (U3). 28% of guides are touched only by the body. Is it a first-class concept, or geometry the search may add when it helps? |
| **Transfer receiver** (a separate receiving rail) | variety in how a catch is received | the owner liked separate receivers "with variety, not everywhere" | 324 of 332 transfer sections produce the receiver touch through an unwanted bump (U2) |
| **Binary fulfilment checks** (shape traversed in order, turning, corners, guide touched) | prove the requested construction happened | they keep plans honest | They are all-or-nothing on a continuous capability, they are shared with the frozen V6 judge, and in short sections they reject every candidate. |
| **`minFrames` (9)** (adopted today) | stop short sections drawing shapes they cannot hold | bench 38/41 → 41/41, held-out 5/16 → 15/16, no ride lost | It is a gate and a special case: a stopgap to replace or remove, not to build on. |
| **Section-by-section beam search:** up to 8 prefixes; backtracks over the last 4 boundaries | a search on real physics | completes most specs | It cannot revise the plan. A dead end burns the allowance (180+ backtracks). It spends the whole allowance by design. |
| **The objective:** v3 impact (strength, timing, extras), plus air and speed | measured, owner-blind-validated for ordering | it orders clear differences like the owner | Its scale, extras and timing are unvalidated, and the owner rarely sees strength differences between strong hits. Extras are cheap in it. |
| **Allowance:** 1,700 physics frames per ride frame | long songs are not starved | completion is high | It makes compiles about 70 s for 50 s of song. Several caps saturate under it (ARCHITECTURE.md, "Known structural problems"). |

## 3. What we have observed, and how far it reaches

- **Quick pairs.**
  - **What we saw:** 0.2 s sections failed when given a shaped family with a
    guide required; guided plain arcs did not fail; feasibility rose smoothly
    with room (a viable candidate in 0% → 39% → 88% → 94% of searched 9/9/12/13
    frame intervals).
  - **Scope:** one probe spec (Luna), the current search and its checks.
    A different search or construction could have different capabilities.
- **Rejections in short shaped sections:** about 42% fail the fulfilment
  checks, 32% lose the rail, 11% release late. Same scope.
- **Unwanted impacts:** the counted extras are mostly weak and come from body
  contact with the upper or receiving rail after strong hits, and from transfer
  receivers. Whether the owner even sees extras of 0.05–0.35 is unknown: the
  visibility study is waiting for his answers.
- **Geometry hygiene:** 62% of the drawn length is never touched (about 3,500
  px per ride of it is visible clutter at chain ends), and removing it changes
  no ride.
- **The benchmark:** the old panel could not see completion (957 of 962). The
  new stratified panel can, and its geometry section now shows variety per
  version.

## 4. Candidate approaches (not exclusive; several can be combined)

**A. Keep the plan, soften its requirements.** Fulfilment becomes a degree that
the search prices instead of a gate that rejects
(graded-fulfilment-design-20261031.md).
- **Changes:** the checks and the search cost.
- **Risk:** variety may flatten if partial shapes are cheap. The judge keeps
  its binary verdict.

**B. Families as candidates, not orders.** The search proposes candidates from
several families in every section. The plan becomes a soft prior: lottery
weights, the previous phrase, the musical context. One cost decides, combining
impact, timing, extras, a variety or taste prior and geometry cleanliness.
- **Where it comes from:** "add viable candidates, never move a cap".
- **What follows:** a short section would simply pick what works, with no
  rule, and variety would come from the prior and the cost instead of a
  lottery.
- **Risk:** the variety prior becomes a knob that needs care. It costs more
  candidates per section.

**C. A better search, concepts unchanged.** For example:
- let a dead end revise its own section's request before reopening earlier
  sections;
- look one section ahead when the next one is short;
- spend physics only where it can change a decision.

This might make several problems disappear without new concepts.

**D. Fewer concepts.** Test what is lost without some of them: guides as
optional geometry rather than a requirement, transfer receivers only where the
receiving touch can fall on a beat, folds rebuilt or dropped. This tells us
which concepts carry quality or variety and which carry only failures.

**E. Construction fixes, independent of the above:**
- trim untouched chain ends after the search (G1; no physics change);
- lay lead-ins along the arrival (G2);
- start guides after the catch (G3).

**F. Unwanted impacts, from three sides:**
- in the cost, once the measure is validated by the visibility study;
- in construction (where guides and receivers sit);
- in selection (prefer candidates with fewer extras).

Not "remove them": some may carry a catch.

## 5. How we would compare

Every approach is compared on a branch, as a proof of concept first:
- the `bench`, `bench-pairs8` and `bench-confirm` panels, against the current
  HEAD;
- the owner's eye on a few rides;
- `sealed` and `heldout` only at a decision point.

Each comparison reports:
- **completion:** per stratum;
- **quality:** under every ruler, on cells complete in both arms;
- **geometry:** section 4 of the report (family shares, guided and transfer,
  realized shape);
- **cost:** physics frames and compile seconds.

Rough first versions are fine. What the data favours is then refined,
simplified and generalized, or dropped.

## 6. A suggested first round of proofs of concept

1. **Baseline without `minFrames`** (already measured: bench 38/41) and with it
   (41/41). This is the floor any approach has to clear, honestly.
2. **B, minimal.** In every section, also propose candidates from one or two
   other families and plain arcs, with the planned family favoured by a cost
   prior. `minFrames` is off. This tests whether "candidates, not orders"
   recovers completion without a rule, and what it does to variety.
3. **C, minimal.** A dead end first retries its own section with plain arcs
   (same guidance) before backtracking. `minFrames` is off. This is the
   smallest structural change that removes the failure mode, and a useful
   contrast with B.
4. **E1 (trim untouched geometry)** in parallel. It is independent and changes
   no physics.

A and D can follow, depending on what B and C show.

## 7. Questions for the owner

- Variety: should it come from a deliberate plan (today), or from candidates
  chosen with a taste prior (B)? Or a mix?
- Guide rails: a concept the plan requests, or geometry the search may use when
  it helps?
- How much should a requested shape matter, against landing the beat cleanly?
