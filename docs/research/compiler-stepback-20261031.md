# Compiler step back (2026-10-31)

Where the compiler stands after the spec-authoring phase, and what to work on
next. Analysis only; no compiler change. Trouble, Valhalla and Circus Minimus are
held out: their failures are *described* here, and every claim used for a
decision is reproduced on a panel song.

## 1. Quick re-landings at speed: the planner, not the physics

**Observed on the held-out songs (descriptive only).** Two landings 0.2 s apart (8
frames) are the authored patterns the compiler fails most. The failure is a
`budget` failure after hundreds of backtracks, e.g. Circus `pairs4` seed 101:
180 backtracks, 182 rebuilds. Every failure stops in the same kind of section:
- **Circus Minimus `pairs3`/`pairs4`:** all 47 failed rides stop at an 8-frame
  section with a guide-*required* family; 44 of them are folds, which are 11% of
  all sections.
- **Trouble:** all 21 failed rides stop at an 8-frame section with a
  guide-required family (fold 10, serpentine 5, terraces 3, scallops 3).

**Reproduced on a panel song.** The probe was Luna Bala's spec plus a second
landing 0.22 s after each of its 25 strong beats that has room (impact 0.4).
It is a scratch variant, not committed. Twelve seeds per arm:

| arm | finished | why the rest failed | quick hits landed |
|---|---|---|---|
| Luna as it is | 12/12 | — | — |
| + quick pairs | 2/12 | all 10 at an 8-frame guide-required section (fold 6, terraces 3, scallops 1) | 50/50 (median 0.38) |
| + quick pairs, `guidedBalance: 0` | **12/12** | — | **300/300** (median 0.36; no extra ≥ 0.25) |

**Mechanism.** `planIntentionalRepertoire`
(scripts/v0/optimizer/intentional_repertoire.ts) groups sections into phrases of
two or three and draws each phrase's family by weight: quietness, speed,
guided balance. The section's *length* plays no part, so an 8-frame section can
receive a fold, terraces or scallops whose guide is required. The search cannot
satisfy that in 8 frames. Backtracking (arc_sequence.ts) reopens earlier
boundaries but never the family, so it cycles until the allowance is spent.

**What it means.** The compiler can ride quick pairs at speed: unguided, it lands
every one. The blocker is the plan asking for geometry that a 0.2 s section
cannot hold. Switching guides off is no fix: the owner likes guided shapes, and
an upper hit then a lower one on two beats is his favourite pattern. Options for
the owner, none implemented:
- **P1. Feasibility-aware planning.** Assign guide-required families only to
  sections long enough to realize them. The threshold should come from a
  measured property of each family (the shortest section it realizes), not a
  tuned constant.
- **P2. Requirement as preference under failure.** When a guided requirement
  cannot be met, the search may realize the section unguided and report it,
  instead of spending the allowance. This is general, but it changes fulfilment
  semantics and the frozen judge files.
- **P3. Plan around short pairs.** Make a phrase boundary at a short section, so
  the pair gets its own simple family.

Each would be a behavioural change: a hypothesis, paired comparisons on panel
specs (the new benchmark's short-pair specs), completion reported apart from
quality, and every ruler.

**Adopted (2026-10-31), then replaced (2026-11-01):** each shaped family had a measured `minFrames` (9). It was replaced by a section fallback with no threshold (REWORK.md, November 1).
A shorter section gets guided plain arcs. See REWORK.md for the full results:
bench 38/41 → 41/41, held out 5/16 → 15/16, no ride lost.

**Why 9 frames: not a cliff, a curve** (2026-10-31, diagnostics reverted after use).
The probe was Luna, every section a fold, seed 101, with the 9-frame rule
bypassed and each searched interval's rejection counts logged. Pairs 0.200 s
and 0.225 s apart both come out as 9-frame sections in the search's own frame
count, once the jolt shifts contacts.

| sections (search frames) | probe | intervals | with a viable candidate |
|---|---|---|---|
| 9 | 0.200 s pairs | 1,376 | 0 |
| 9 | 0.225 s pairs | 232 | 39% |
| 12 | 0.225 s pairs | 16 | 88% |
| 13 | 0.225 s pairs | 170 | 94% |

- **The curve:** feasibility rises smoothly with room. Backtracking hides the
  failed attempts, so the rides looked like a cliff, while a 9-frame fold
  still fails 61% of its attempts and spends allowance on them.
- **What rejects candidates:** about 42% fail the binary fulfilment checks in
  repertoire_realization.ts. "Bypassed-shape" means the rider must touch the
  shape's early, middle and late thirds in order; "unused-or-missing-guide"
  means the guide must be touched. About 32% lose the rail ("binding") and 11%
  release too late: the physical cost of forcing the shape into too little
  room.
- **So it is mostly requirement strictness:** an all-or-nothing check on a
  continuous capability. This is the case for graded fulfilment
  (docs/research/graded-fulfilment-design-20261031.md).

## 2. Other open threads (evidence in the reports named)

| thread | state | evidence | next step |
|---|---|---|---|
| Geometry hygiene: pass-throughs and unused geometry | diagnosed | geometry-hygiene-20261031.md: fold lead-ins crossed from behind (40 of 119 folds); 62% of drawn length never touched | G1 (trim untouched chain ends after search: no physics change, judge shape checks need adapting); G2 (fold lead-ins along the arrival) |
| Unwanted impacts | diagnosed | unwanted-impacts-20261030.md: transfer receivers (U2), guide requirement met by the catch (U3) | after the visibility study; note the owner likes guide touches *on* beats |
| The impact measure | validated for ordering only | measure-step-back-20261031.md; night study: strong-hit strength differences mostly not seen | owner answers `impact-visibility-2026-11` |
| Camera | fixed | camera-20261031.md | — |
| Benchmark fitness | audit running | benchmark-audit (agent) | new dev specs on the panel songs, incl. short pairs |

Folds recur across three threads: they cause the visible pass-throughs, most
short-pair failures, and many guide touches. They are worth a look as a family.

## 3. Suggested order

1. **The benchmark first, in its short form.** Panel-song dev specs with the
   patterns that fail, so every change below is measured where it matters (the
   audit will propose the full design).
2. **P1 or P3 (completion of quick pairs).** The largest blocker to the owner's
   specs. Simple, and testable on the new dev specs.
3. **G1 (trim untouched geometry).** Cleaner tracks, no physics change.
4. **Folds as a family:** lead-ins (G2) and their short-section behaviour.
5. **U2/U3 and the measure**, once the visibility answers are in.

## Reproduce

Probe outputs: `generated/probe-pairs-luna/{base,pairs,unguided}-<seed>`
(seeds 101–1212, step 101). The probe variant added `{t: t+0.22, impact: 0.4}`
after each Luna contact with impact ≥ 0.6 and at least 0.5 s to the next. The
unguided arm was `--creative='{"guidedBalance":0}'`.
