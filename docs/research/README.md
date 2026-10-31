# Research record

Investigations whose findings the rework builds on, kept with their evidence.
Links to documents that are no longer in the tree resolve at tag
`archive/pre-rework-2026-10-03`.

| document | why it matters |
|---|---|
| [impact_definition.md](impact_definition.md) | the frozen landing-impact definition (the cArc strength formula, its window and its calibration) |
| [beat-salience-investigation-20261001.md](beat-salience-investigation-20261001.md) | the owner's per-passage judgments of hit timing, clarity, upper hits and merged hits; the 16-passage review |
| [motion-quality-investigation-20261001.md](motion-quality-investigation-20261001.md) | friction-driven speed bursts on normal lines, calm openings, separated-rail transfers |
| [production-repertoire-feedback-20261001.md](production-repertoire-feedback-20261001.md) | the owner's feedback on automatic arrangements |
| [intentional-motion-roadmap.md](intentional-motion-roadmap.md) | the last roadmap before the rework, including the owner's impact-definition requirements |
| [strike-definition-20261004.md](strike-definition-20261004.md) | **the strike account (line.strike.v1)**: definition, rationale, evidence and limits |
| [overnight-20261005.md](overnight-20261005.md) | **overnight report**: the measure settled with the owner, the compiler changes, evening → tonight results on four panels, limits and questions |
| [impact-candidates-20261004.md](impact-candidates-20261004.md) | research impact-strength candidates (surface arrival, spin toggle, energy as a negative result), probes, segmentation findings and the pairs that would discriminate them |
| [compiler-budget-20261004.md](compiler-budget-20261004.md) | how the compile budget is spent; ablations A1/A2; rejected R1/K1/P1; the length-scaled default allowance |
| [general-impact-results-20261003.md](general-impact-results-20261003.md) | `line.contact-impact.v1` delivery: results, tradeoffs, limitations |
| [scorecard-blind-spots-20261005.md](scorecard-blind-spots-20261005.md) | rider behaviours no scorecard row measures (pose at strong hits, body contact, pass-throughs, spin), by era; proposed guard rows |
| [unwanted-impacts-20261030.md](unwanted-impacts-20261030.md) | unrequested hits: what v3 counts (body on guide or receiver rails after strong hits), what it misses (two detector defects; turns just after quiet catches), why the search keeps them, fix hypotheses U1–U5 |
| [u1-measure-study-20261031.md](u1-measure-study-20261031.md) | U1 measure candidate (`line.strike.v4-candidate`, measurement only): definition, remeasured panel, and why the owner study was not built (worse than v3 on his existing labels). Code kept on branch `worktree-agent-a1f12a7790eda8a3d` (a804bc08), not merged |
| [measure-step-back-20261031.md](measure-step-back-20261031.md) | the impact measure, a step back: what the compiler needs from it, what is validated (ordering of clear differences only), a pattern in the pairs v3 gets wrong (post hoc), and the proposed next owner studies |
| [playback-20261031.md](playback-20261031.md) | review-page and spec-dashboard playback: why rides lagged and pair clips stuttered (stale `currentTime`, seek storms), the timing chain from beat to screen (felt-jolt +15 ms by design), the one-module design (`shared/playback.js`), before/after measurements and what is unverified |
| [impact-visibility-study-20261031.md](impact-visibility-study-20261031.md) | the next owner study, built and pre-registered (`impact-visibility-2026-11`, 55 pairs from unexamined held-out rides): are unrequested extras and late pushes seen as impacts (block A), and at what v3 ratio does a strength difference between clean hits become visible (block R); decision and void rules fixed before any answer |
| [graded-fulfilment-design-20261031.md](graded-fulfilment-design-20261031.md) | design note: the plan as intent, not law — graded fulfilment priced in the search instead of binary rejection; unifies short sections, forced guide touches (U3); success criteria stated in advance |
| [compiler-stepback-20261031.md](compiler-stepback-20261031.md) | compiler step back: quick re-landings fail because the planner gives 0.2 s sections guide-required families (Luna probe: 2/12 → 12/12 unguided); map of open threads and a suggested order |
| [geometry-hygiene-20261031.md](geometry-hygiene-20261031.md) | pass-throughs and untouched geometry on 24 fresh rides: the visible pass-through is the rider flying through the next section's lead-in from behind (34% of fold sections) or a guide's leading end; crossed segments are never touched and removing them changes nothing; 62% of drawn length is never touched, physically inert but read by the shape and role checks; code paths and options G1–G7 |
| [benchmark-audit-20261031.md](benchmark-audit-20261031.md) | read-only audit of every benchmark/eval layer: the decision panel is four near-grid specs with completion at ceiling (957/962) and a 4-song bootstrap; what it misses (sub-0.29 s pairs, word runs, calm floats, long rides); proposed pattern-stratified dev specs on the four panel songs, sealed siblings, migration and risks |
| [sung-notes-20261031.md](sung-notes-20261031.md) | `tools/music/sung.py`: sung-note onsets with salience from the vocal stem (loudness rise + pitched body), why events.json's vocal onsets miss same-pitch words and include breaths, evaluation on the owner's Valhalla and Trouble labels, Circus Minimus oddities, what is unverified |

The October 3 independent audit corrects several claims in these documents:

- **Timing:** the onset timing gain largely disappears when timing is measured
  at the peak.
- **Renewal blind spot:** a strike after a weak hit, during continuous
  contact, is invisible to v1, and the compiler exploits it.
- **Frozen V6:** the experimental tracks are invalid under frozen V6 (they
  score 70.01).
- **Clarity:** the V6 score is inversely related to hit clarity.

The audit's findings are summarized in `REWORK.md`.
