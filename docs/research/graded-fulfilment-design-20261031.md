# Graded fulfilment: the plan as intent, not law (design note, 2026-10-31)

A proposal for discussion before any code. It generalizes the adopted
`minFrames` rule (a measured stopgap) into one smooth mechanism.

## The problem, in one sentence

The planner asks for a geometry, and the search rejects outright any candidate
that does not show *all* of it. Three diagnosed problems share this root:

1. **Short sections.** A fold, ripples, S-sweep or terraces cannot be fully
   traversed in 8–9 frames. Every candidate fails "bypassed-shape", and the
   search burns its allowance (compiler-stepback-20261031.md). It is a curve,
   not a cliff: a viable candidate exists in 0% of 9-frame fold intervals at
   0.200 s pairs, 39% at 0.225 s, 88% at 12 frames, 94% at 13.
2. **Forced guide touches (U3, unwanted-impacts-20261030.md).** "Guide required"
   is met by any guide contact, so the search can buy it with a late, unwanted
   touch on the rail above.
3. **Fold lead-ins crossed from behind (geometry-hygiene-20261031.md).** The
   fold's entry is rotated to serve the shape, away from the arrival path.
   This is related, but a separate mechanism; it is not addressed here.

## Proposal

**1. Measure fulfilment as a degree, from the same evidence.**
`inspectConstruction` already measures everything needed:
- ordered traversal (early, middle, late);
- turning and turn reversals;
- fold corners;
- guide contact frames.

A degree in [0, 1] per requirement would be, for example:
- traversal: the share of the shape's thirds touched in order;
- turning: turning ÷ the family's nominal turning;
- reversals: realized ÷ required;
- guide: whether the guide is touched *as part of the catch* (U3), not
  anywhere.

The binary verdict stays available, for the frozen V6 judge and for reports.

**2. The search prices fulfilment instead of rejecting on it.**
- **The cost:** a candidate's local cost gains `w · (1 − degree)`. Physics
  rejections stay hard: binding, invalid geometry, missed beat. The plan's
  request then becomes a pull, strong where the section has room and naturally
  weaker where it doesn't, with no frame threshold.
- **The weight `w`:** expressed against the impact loss, so the trade-off is
  explicit, e.g. "a fully bypassed shape costs about as much as a 0.1 strength
  error".

**3. Graceful dead ends.** If a section has no viable candidate at all, it is
realized with the plain family and the same guidance before the search reopens
earlier sections. The fallback is recorded in the realization. No threshold is
needed: the search reports infeasibility, the plan does not have to predict
it.

**4. `minFrames` is retired** if the graded version beats it, or else stays as
a measured prior.

## Risks, and how we would see them

- **Variety drift.** If partial shapes are cheap, the search may flatten
  everything toward plain arcs. The new geometry section of the bench report
  must show the realized turning, reversals and family use per stratum. The
  bar is *no unintended loss of realized shape in sections with room*, not
  "more variety".
- **Calibrating `w`.** One knob, set in units of impact loss and justified, not
  tuned to the benchmark. Sweep 2–3 values and report all of them.
- **Judge and parity.** The frozen V6 judge keeps its binary checks, and parity
  will differ wherever the search now accepts partial shapes: that is a
  behavioural change and needs the full protocol.
- **Cost.** Fewer rejections means less wasted search, so completion and
  compile cost may both improve. Still to be measured.

## What would count as success (stated in advance)

Paired against the current HEAD (with `minFrames`) on bench, bench-pairs8 and
bench-confirm, then sealed and held-out at the decision point:
- **Completion:** at least equal on every stratum.
- **Quality:** on both-complete cells, within noise or better under every
  ruler, including window metrics and extras. U3-type guide touches should
  fall.
- **Geometry:** the realized shape in sections of 12 frames or more is not
  reduced; short sections show partial shapes instead of none.
- **Budget:** physics frames spent per completed ride does not rise.

## Questions for the owner

- **How strongly should a requested shape pull?** Should a partial fold in a
  short section read as "a hint of a fold", or would he rather have plain arcs
  there?
- **Should a guide that only adds a stray touch be dropped?** This is U3; we
  think yes.
