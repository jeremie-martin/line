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
| [impact-candidates-20261004.md](impact-candidates-20261004.md) | research impact-strength candidates (surface arrival, spin toggle, energy as a negative result), probes, segmentation findings and the pairs that would discriminate them |
| [compiler-budget-20261004.md](compiler-budget-20261004.md) | how the compile budget is spent; ablations A1/A2; rejected R1/K1/P1; the length-scaled default allowance |
| [general-impact-results-20261003.md](general-impact-results-20261003.md) | `line.contact-impact.v1` delivery: results, tradeoffs, limitations |
| [scorecard-blind-spots-20261005.md](scorecard-blind-spots-20261005.md) | rider behaviours no scorecard row measures (pose at strong hits, body contact, pass-throughs, spin), by era; proposed guard rows |

The October 3 independent audit corrects several claims in these documents:

- **Timing:** the onset timing gain largely disappears when timing is measured
  at the peak.
- **Renewal blind spot:** a strike after a weak hit, during continuous
  contact, is invisible to v1, and the compiler exploits it.
- **Frozen V6:** the experimental tracks are invalid under frozen V6 (they
  score 70.01).
- **Clarity:** the V6 score is inversely related to hit clarity.

The audit's findings are summarized in `REWORK.md`.
