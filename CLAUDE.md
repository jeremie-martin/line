When launching general purpose agents, only launch Opus 4.8 (medium thinking effort) agents

## Minimal-simulation rule

The physics engine simulates full rider paths ONLY (a) inside arcs (contact physics) and (b) when the DFS search actually expands/forward-evaluates the tree. Everywhere else — probing, aiming, ranking, scoring — read the launch state at the geometric arc exit and propagate ballistically. One mechanism, one source of truth:

- the exit is `core/exit_read.ts` `confirmedArcExitFrame` (airborne, past the arc-end plane, still airborne one frame later) — a function of the geometry and the trajectory, never of how far the caller happened to simulate;
- that exit frame IS the launch anchor, acquired once by `core/ballistic_launch.ts` `captureBallisticLaunchObservation`, always targeting the next authored contact;
- propagation and gap composition are `core/ballistic_projection.ts` `projectBallisticGap` over the exact constraint kernel in `core/ballistic_micro_sim.ts`.

Growing the detection window to locate the exit is a cost optimization and must never move a reported quantity. Full-path probe modes exist only as explicitly-flagged comparison arms (studies pass `{mode: "full"}` directly) and must never become defaults.
