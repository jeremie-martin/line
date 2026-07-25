When launching general purpose agents, only launch Opus 4.8 (medium thinking effort) agents

## Minimal-simulation rule

The physics engine simulates full rider paths ONLY (a) inside arcs (contact physics) and (b) when the DFS search actually expands/forward-evaluates the tree. Everywhere else — probing, aiming, ranking, scoring — read the launch state at the geometric arc exit and propagate ballistically. One mechanism, one source of truth:

- the exit is `core/exit_read.ts` `confirmedArcExitFrame` (airborne, past the arc-end plane, still airborne one frame later) — a function of the geometry and the trajectory, never of how far the caller happened to simulate;
- that exit frame IS the launch anchor, acquired once by `core/ballistic_launch.ts` `captureBallisticLaunchObservation`, always targeting the next authored contact;
- propagation and gap composition are `core/ballistic_projection.ts` `projectBallisticGap`. Since 2026-07-25 the default is a CLOSED FORM, not the constraint kernel: in free flight the constraints are internal, symmetric and massless, so the ten-point system centre is exactly ballistic and the rider rides on its launch offset. 451 ns per prediction against the kernel's 19,806, adopted at measured parity. The exact kernel in `core/ballistic_micro_sim.ts` is the A/B arm, `LR_BALLISTIC_CLOSED_FORM=0`.

Cheap is not the same as free: the kernel charged nothing to the frame budget, so a shadow simulation ran beside the real one — 31.5% of every frame the compiler simulated. Under the closed form that is zero, and the budget axis measures what it claims to.

Growing the detection window to locate the exit is a cost optimization and must never move a reported quantity. Full-path probe modes exist only as explicitly-flagged comparison arms (studies pass `{mode: "full"}` directly) and must never become defaults.
