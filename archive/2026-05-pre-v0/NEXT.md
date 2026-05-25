# Next direction — precision-first landings with built-in variety

This file crystallizes the design conversation that followed the Phase 1/2/3
bench measurements (2026-05-24). It supersedes any earlier "more compiler
search" framing for the immediate next milestone.

It is meant to be re-read **before any code change in this direction lands**,
to make sure the priorities haven't drifted.

---

## What we observed

After running the full bench v2 (208 runs over 13 specs × 16 strategies),
two truths surfaced that re-frame everything:

1. **The Level 1 compiler is *almost* good enough already.** The Phase 2
   (primitive-type search) and Phase 3 (beam search, lookahead-2) changes
   did not meaningfully beat the pre-existing greedy on most specs.
   `baseline_old` + `arc_descend_climb` remain the best at-the-current-
   measurement strategies. The bottleneck isn't "smarter search" — the
   compiler isn't the right thing to push on right now.

2. **The bench has been measuring the wrong thing.** Each bench strategy
   conflates *spec authoring* (which beats / what intent per beat) with
   *compiler back-end* (greedy / iter / beam). So "baseline_old wins" tells
   us baseline_old's spec-authoring + compiler combination is robust on
   our spec mix — not that the new compiler is worse.

## What the user actually wants from the next milestone

> "We were not able to generate cool tracks with very good beat
> synchronization (+/-1 frames for the vast majority of beats). Sometimes
> the sync was good, but the videos themselves (the tracks) were quite
> uninteresting."

Two concrete failures, both load-bearing for any artistic music sync:

### Failure 1 — precision

The compiler treats sync as a soft score (Gaussian decay traded against
cool). It should be a **hard constraint**: every beat must land within
±1 frame of its target, or the beat is honestly reported as drift.

The bench-best precision today: ~30% `onBeat1` (±25 ms) across most specs.
The user wants the **vast majority** at ±1f.

### Failure 2 — visual interest

> "drop_iter is the best video in terms of sync and is pretty cool to look
> at, but the track is super boring. arc_descend_climb is somewhat decent
> at being creative, but the sync is very bad, and honestly it's still a
> bit boring."

The visual problem is not "tracks lack composition" or "tracks lack
decoration" — those are deferred. The visual problem is simpler:

- **Ground-hugging riders look boring.** When the rider slides along a
  long horizontal corridor of stubs, the eye has nothing to track. Air
  time between landings is what makes the motion *feel* like sled-and-music.
- **Repetitive primitives look boring.** drop_iter places ~60 identical
  drops back-to-back. Same shape, same parameters, same visual effect every
  beat. The eye stops paying attention.

So: **the rider needs air time between every landing, AND consecutive
landings need to vary in visual shape.**

## Out of scope for now (explicitly noted)

These are *not* what we should work on yet, despite being interesting:

- **Flavors / aesthetic modifiers** (Axis B in the earlier conversation):
  "punchy descend" vs "gentle descend". Defer until we can hit ±1f
  reliably AND produce visually-varied tracks at all.
- **Decoration lines** (visual-only geometry the rider doesn't touch):
  defer until the primary geometry is interesting.
- **Composition** (build / climax / resolution per song): "we're not at a
  stage where we can think of this." Hold.
- **Speed-envelope spec language** (Level 2 from earlier): defer.
- **Music-driven spec generation** (Level 4): far off.
- **Smarter Level 1 compilers** (beam, MCTS, primitive priors): the bench
  data does not justify more search-side complexity.

## What we DO want to work on now

A **family of bisection-driven landing primitives** that all hit ±1f via
the same mechanism `landAt` already uses, but vary in visual shape so that
consecutive beats don't look identical, AND that ensure the rider leaves
the landing back into the air.

The principle: precision is the constraint, variety is the goal, both per
single primitive.

### Why this is the right granularity

- It does not require richer specs (the spec is still "land at these
  beats"). The variety lives inside the primitive choice, not the spec.
- It uses the bisection mechanism we already trust (`landAt` produces ±1f
  by design). The user does not need to be convinced of new physics.
- It directly attacks both observed failures: precision-first via
  bisection (failure 1) and per-beat shape variety (failure 2).
- It defers the harder authoring questions (flavors, composition) until
  we have a working foundation.

### Concrete shape

A primitive family, all bisection-driven, all hitting the landing event
within ±1f of `at`:

- `landAt` — current, short horizontal stub
- `landAt_kicker` — stub + small upward kicker at the trailing edge to
  relaunch the rider into air
- `landAt_bumpy` — 3 micro-stubs in a row at the target frame; rider
  bounces across them, multiple visual hits per beat
- `landAt_curve_down` — short downward-curving catch that relaunches the
  rider with a downward angle (rebuilds vy for the next landing)
- `landAt_curve_up` — short upward-curving catch (rider climbs briefly,
  then peaks, then falls into the next landing's catch zone)

Each one bisects whatever its load-bearing dimension is (Y-position of
the stub, X-offset of the kicker, etc.) until the landing event fires at
the exact target frame.

A compiler mode that uses this family rotates among the variants across
consecutive beats — either round-robin, or biased by rider state (slow
rider → curve_down to regain speed; fast rider → kicker to redirect; etc.).

### Success criteria for this work

- ≥90% of beats at `onBeat1` (±1 frame) across all bench specs.
- Air-fraction during a song > some threshold (TBD — measure on
  drop_iter as a positive reference; that's what "good air" looks like).
- Visual variety: ≥3 distinct primitive types chosen across any 30-beat
  spec. (Diagnostic — a 60-beat spec that picks one primitive 60 times
  is by definition a failure of variety even if precision is perfect.)

### What we are explicitly NOT trying to optimize

- `coolScore`. The current metric rewards geometric diversity in
  isolation; it does not capture "the rider has air time + varied
  landings = visually interesting motion." We may need a different
  metric, but we should first see whether the bisection-family tracks
  *look* good before re-designing the metric.

## How to know we're done with this direction

The user watches the rendered videos for the bisection-family compiler on
the standard specs (`drums_0_30s_60_125`, `metronome_120`, etc.) and
agrees:

1. The sync is tight — beats audibly and visibly align.
2. The rider has air time — it doesn't grind along the floor.
3. The track has shape variety — not 60 copies of the same primitive.

That's the bar. If yes → move to a richer spec language (flavors / arcs /
speed envelope). If no → iterate within the bisection family before
adding new spec vocabulary.

---

## Progress 2026-05-24 — bisection-foundation work + open problems

**What was built:**

- `scripts/lib/primitive.ts:bisectCurveOffset` — bisects the perpendicular
  offset of a `placeSlideChain`-style multi-segment sloped curve until the
  rider's landing event fires at the target frame. Survival-aware: prefers
  surviving landings over precise ones (a dead rider with ±0f is useless).
- `scripts/lib/precise_landings.ts` — family of 3 Move-compatible primitives:
  `landAtCurve` (no decoration), `landAtCurveKicker` (curve + upward kicker),
  `landAtCurveDive` (curve + steep downward exit). All use bisectCurveOffset.
- `compose_precise_landings` + `compose_precise_landings_variety` bench
  strategies in `scripts/bench_music.ts`.

**Foundational finding that re-shaped the approach:**

The original NEXT.md framing assumed `landAt` (horizontal stub) was a viable
precision foundation needing only decoration. Probe revealed it ejects the
rider 2f after the first landing — flat stubs can't absorb impact at any
non-trivial vy. The successful chained-landing primitive is
`placeSlideChain`'s multi-segment sloped curve (61% air fraction, survives
30-beat chains, but precision is fixed ±2f late). The pivot was to bisect
the sloped curve's offset, getting precision from the bisection while keeping
survival from the curve shape.

**Validated:**

- ✓ Short chains (10 beats at 40f spacing starting at f=40) survive AND hit
  **80% onBeat1** — a 3.5× precision improvement over placeSlideChain's 23%.
- ✓ Bisection's survival check (reject offsets where rider dies in lookahead
  window) correctly trades precision for survival when both can't be had.
- ✓ The family registry pattern works (alternating variants across beats).

**Open problems** (do not declare success until these are solved):

1. **Long-chain survival**: 30-beat metronome_60 (beats at 30, 70, 110, ...)
   ejects at frame 114 — beat 2 (target 110) is the last beat placed. The
   per-beat survival check (rider lives 8f after landing) doesn't capture
   "rider's post-landing state degrades the chain N beats from now." The
   bisection finds locally-OK offsets that compound into chain failure.
2. **Speed**: 47 seconds for 30 beats (vs baseline_old's 5s for the same).
   Each bisection runs up to 18 iterations × full simulation. Need either:
   fewer iterations (smarter start offset), cached partial sims, or a
   closed-form initial guess.
3. **Beats 1–2 outliers in the working 10-beat test**: beats 0, 3-9 land
   ±0-1f; beats 1, 2 land +5f. Not catastrophic but suggests the bisection
   isn't always finding the best surviving offset.
4. **Visual quality NOT yet verified**: no rendered video has been viewed.
   The user's bar is "tight sync + air time + variety," and we haven't
   confirmed any of those visually yet.

**Where to pause and decide:**

The architecture (bisection on sloped curve) is now demonstrated for short
chains. Before iterating further on speed/long-chain survival, *render and
watch one of the working short-chain tracks* to confirm the visual direction
is right. If yes, the next iteration is "scale to long chains + speed it up."
If no, the visual problem might require something different from the curve
family (e.g. taller geometry, more vertical range) and the chain-survival
work would be premature.

## Why this is captured here

Crystallizing this matters because it's the FOURTH time the project's
priorities have shifted in measurement-driven ways (capability vs
authoring, smart compiler vs better spec, precision vs interest, etc.).
The pattern is healthy — we're updating from real data. But it means
forgetting yesterday's framing is easy.

**Re-read this file before any code change that claims to advance the
"next milestone."** If the proposed change does not directly attack
±1f precision AND/OR visual variety via shape variation, it is not the
next milestone — file it under "later."
