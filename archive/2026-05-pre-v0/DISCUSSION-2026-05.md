# Discussion summary — design conversation 2026-05-25

Step-back from the previous compiler architecture, triggered by a render of "compose_precise_landings_variety" showing 19% beat adherence on a real drums spec (vs 80% on a synthetic 10-beat spec). What follows is a faithful chronology of the design conversation that produced `design.md` in this folder.

## Starting state

The codebase had a flat catalogue of "Moves" (slide, drop, kicker, curve, etc.) sequenced by ad-hoc "strategies" (compose_drop_iter, compose_precise_landings, etc.), with various search routines (greedy, beam, monte-carlo) trying to maximize a "coolScore" fitness function. Sync was a soft term in the fitness score, not a constraint. The latest attempt — bisection on a sloped-curve's perpendicular offset — won 80% beat-precision on synthetic tests but collapsed to 19% on real drums and produced visually monotone output.

The user raised a red flag: *"I find it weird we are in such a situation. I expect there could be some very clean, simple, robust solution where stuff just works by design."* They asked to re-examine first principles — whether the abstractions, primitives, and overall project structure were the right ones.

## Initial reframe — and a pushback

First proposal: a four-layer architecture (audio → spec → trajectory resolver → compiler → renderer). The trajectory resolver would plan a target rider path using closed-form / approximate physics; the compiler would induce that path with minimum geometry.

User pushed back: *"I'm not entirely clear how the resolver would work without using the engine, which is line-bound."* They preferred a two-layer architecture (spec → compiler) with the engine in the loop throughout — because approximate physics can produce trajectories that aren't engine-realizable (e.g. tunneling), and closed-loop correction can absorb small drift but not qualitative divergence.

I conceded. We settled on two layers, engine in the loop throughout.

## Vocabulary iteration

We iterated on the spec language through several drafts:

1. **First draft.** Intents = slide / climb / dive / air / wave; hard events = Land / Bounce / PassAltitude. User rejected: *"what does dive mean? what does air mean? slide is what happens automatically — nobody would author it. land vs bounce is a detector quirk."*

2. **Texture tags.** aerial / bumpy / flowing / ground / wavy / dropping / rising. User pushed back: *"can we combine these? aerial × climbing? bumpy × straight-lines?"* — tags were not orthogonal axes; they were combinations of different dimensions packed into single labels.

3. **Five orthogonal axes.** air / altitude / contact / shape / grain. User caught that `contact` and `shape` were not orthogonal — both described contact character via different angles (rider experience vs geometric cause).

4. **Four orthogonal axes.** air / altitude / contact_style / grain. Locked.

5. **Float values with precise measurable definitions.** User pushed hard for testable precision: each axis must have a precise definition with clear meaning at the extremes (e.g. *what does `air = 1.0` actually mean, measured on a finished track?*). We worked out per-axis definitions (see `design.md`).

6. **Land and Bounce collapsed to `Contact`.** The detector distinction is a quirk, not an authorial intent. PassAltitude waypoints dropped — not needed for v0.

Other agreements: TS module spec format, seconds throughout, per-axis layering (sections override defaults per-axis, last-defined wins for direct conflicts).

## Atomic primitive

Settled on `Arc` as the right granularity for the compiler's placement primitive — a parametric multi-line polyline. Single lines were too low-level; named gestures like "catch" or "kicker" would conflate intent and geometry. Layer terminology: Spec / Section / Contact / Arc / Line — three distinct names at three levels of granularity.

## Variety as first-class

The user emphasized that visual variety is central to the project's purpose, not an afterthought. We agreed:

- The compiler carries a seeded RNG threaded throughout, from v0.
- Same Spec + different seed → genuinely different but spec-conforming Tracks.
- A future `regularity` axis (v0.1+) would control *how much* spread the RNG-driven choices have. Deferred.

The user noted that previous "coolScore" fitness was an attempt to fight optimization-driven uniformity via fitness terms, and it had not worked. The cleaner answer is to design the compiler so it doesn't converge to uniformity in the first place — not to bolt on an anti-uniformity tax after the fact.

## The compiler internals — where we got stuck

I proposed two approaches in turn; the user found both wrong:

1. **Hill-climbing**. Convergent by design, produces uniformity. Rejected.

2. **Sampling from distributions centered on axis targets**. I claimed this would produce variety AND hit axis targets by construction. The user correctly objected: *this only works for `grain` (where the Arc length IS the axis being measured). For `air`, `altitude`, `contact_style`, the measurement is a section-wide statistic that depends on multiple Arcs interacting; no single Arc parameter directly drives the measurement.* Sampling can produce variety, but it cannot reliably achieve a section's measured target value for those three axes. There is a real inverse problem here that requires actual optimization or search.

The user raised the red flag at this point: I had been chasing technicalities without checking whether the chosen frame was even right. They asked for a step-back and an independent review — two warm reviews with full context, one cold review with only the problem and final design.

This document is part of that step-back.

## The open question

How should the compiler internals actually work? The compiler must:

- Enforce hard Contact constraints (likely via bisection on Arc parameters — proven).
- Achieve soft axis targets at *section* granularity, where the measurement is a section-wide statistic over multiple Arcs that interact via physics.
- Produce visually varied output without converging to uniform repeated shapes.
- Keep the rider alive across sections.
- Use the engine in the loop throughout (no approximate physics planning).

This is the question the third-party review should help us answer — and, more broadly, whether the design captured in `design.md` is even the right framing for the problem captured in `problem.md`.
