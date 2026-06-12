When launching general purpose agents, only launch Opus 4.8 (medium thinking effort) agents

## Minimal-simulation rule

The physics engine simulates full rider paths ONLY (a) inside arcs (contact physics) and (b) when the DFS search actually expands/forward-evaluates the tree. Everywhere else — probing, aiming, ranking, scoring — read the launch state at the geometric arc exit and propagate ballistically (arc_model.ts `propagateBallisticArrivalState`). One mechanism, one source of truth. Full-path probe modes (e.g. `LR_AIM_PROBE_MODE=full`) exist only as explicitly-flagged comparison arms and must never become defaults.
