# Compiler components

`compileHandoff` in `handoff.ts` is the public entry point. Ordinary WASM
requests with air, speed and amplitude axes use `connected_arcs.ts`. It builds
normal type-0 physical support curves, optionally paired with a connected guide.
No point controls or acceleration lines enter this production path.

## Current construction

| Module | Responsibility |
|---|---|
| `handoff.ts` | Routing and compatible budget/snapshot APIs. |
| `connected_arcs.ts` | Production settings, budget allocation, checkpoint and telemetry integration. `connectedArcOptions` exposes the actual settings to studies. |
| `compiler_input.ts` | Validate finite timeline values and order contacts with their authored targets. |
| `arc_engine.ts` | Construct owned engine wrappers without empty-batch handle aliases. |
| `arc_geometry.ts` | Pure coherent-curve construction: tangent schedule, turn timing, bend and guide separation. |
| `arc_motion.ts` | Measured candidate search, continuation planning, backtracking and final replays. |
| `arc_guidance.ts` | Remove unused portions of physical guides after replay. |
| `arc_response.ts` | Damped coupled response proposals from measured differences. |
| `arc_value.ts`, `arc_value_model.json` | Predict continuation quality from physical arrival state and upcoming authored targets; exact simulation still validates candidates. |
| `arc_refinement.ts` | Completed-track repair experiments, disabled in production defaults. Retains the incumbent and charges complete continuations. |
| `native_motion_schedule.ts` | Shared authored-contact scheduling; the historical name does not imply acceleration geometry. |
| `budget_telemetry.ts` | Shared observation recorder; a different traversal model is explicitly unvalidated, and the legacy estimator is not the arc planner's policy. |
| `../core/compile_lifecycle.ts` | Reset registered per-compile state. |

Budget allocation depends on ride length and available simulated frames. The arc
planner estimates construction rate from measured work and uses remaining work
to choose continuation effort. It does not consult the legacy difficulty model.
The selected geometry receives two complete cold replays, included in accounting.
Completed evaluations of identical normalized controls are reused within one search
prefix. Cached engine wrappers are never reused; new children receive ordinary
physical metering. `memoCandidates: false` disables this for controlled studies.
Budget interruptions preserve completed recursive branches and the deepest
completed prefix. Proactive retry estimates include rebuilding from the actual
backtracking boundary. Repair records describe every accepted rebuilt interval.
Same spec, seed and budget must give identical tracks. Each budget is a fresh run.

## Retained mechanisms

`legacy_handoff.ts` preserves the older prefix search, readiness, deadline,
restart and repair policies. Diagnostic options, alternate reference engines,
unsupported axes, very early/absent contacts and tiny budgets retain their
previous fallback. Authored contacts are preserved even when difficult or infeasible;
the fallback still has inherited expansion-boundary budget overruns (see the
[integrity audit](../../../docs/compiler-integrity-audit.md)). Existing imports through `handoff.ts` remain compatible;
new legacy studies can import `compileLegacyHandoff` explicitly. The compatibility
exports still load that module; this extraction makes no startup-speed claim.
See [the retained inventory](../../../docs/optimizer/legacy-components.md).

`native_motion.ts` and `normal_motion.ts` reproduce archived point-control
proofs of concept. They are outside the current product constraint and have no
route from the public dispatcher. They and their research commands are retained
because their physical-control ideas and evidence may remain useful.

## Work and evidence

Use [HOW_TO_WORK](../../../docs/HOW_TO_WORK.md) for the fixed V2 evaluation
contract and [the foundations audit](../../../docs/compiler-foundations.md)
for cleanup evidence and follow-up ideas. Research can start from shipped settings:

```bash
LR_ENGINE=wasm node --import tsx scripts/benchmark/arc_motion_study.ts \
  --source=sparse_lowline --budget=750000 --defaults=production \
  --options='{"responseDamping":0.3}' --out=generated/example.json
```

This is an exploratory single-case result, not a canonical benchmark headline.
The older command defaults remain available for exact historical reproduction.
