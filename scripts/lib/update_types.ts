/**
 * The single engine update-record type the compiler actually consumes.
 *
 * The detector (detector.ts) reads ONLY CollisionUpdate records (the collided
 * line id + contacted point ids) and skips every other update. Step/Constraint
 * updates are internal solver bookkeeping. The trace oracle (sim_trace.ts) folds
 * exactly this same set into its per-frame fingerprint, so its correctness gate
 * tracks what the compiler reads rather than engine internals.
 *
 * Both sites import this constant so the coupling is explicit: if the detector
 * ever starts reading another update type, change it here and the oracle's
 * coverage follows.
 */
export const COLLISION_UPDATE_TYPE = "CollisionUpdate";
