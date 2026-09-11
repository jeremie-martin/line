# Working on the compiler

The current benchmark is **frozen V4**: 176 specifications, seeds 16/17, and
750,000 actual physics frames per compile. The accepted result and goal status
live in [goal.md](../goal.md); the [V4 contract](../benchmark/v4/README.md)
defines the panel and scorer. Do not substitute the historical V2 promotion
workflow or alter the benchmark to improve a compiler result.

The product uses substantial coherent arcs made from normal type-0 lines.
Curvature, turn timing, guide coverage and other geometry can evolve. The owner
rejected constellations of isolated control segments and acceleration-line
tracks. Physical validity and a high score do not establish visual quality;
use the production vertical-video workflow to review meaningful style changes.

## Start from actual behavior

Use the [compiler module map](../scripts/v0/optimizer/README.md) and the
[design audit](compiler-design-audit-2026-09-11.md). `compileHandoff` is the public
entry point; `connectedArcOptions` supplies the actual production settings to
research. Reference engines, unsupported axes and diagnostic requests still
need the explicitly retained legacy backend. Hook-based legacy studies call
`compileLegacyHandoff` directly.

Inspect measured work, selected trajectories and unsuccessful attempts before
choosing a change. Returned interval rows describe the selected track; aggregate
work includes all attempts. The `attempts` records attribute construction,
planning, replay and first completion separately. Models propose controls;
real metered physics validates them. No case or seed identity belongs in the
compiler's learned features or runtime decisions.

## Experiment and compare

A small physical study is useful for a mechanism check, not a headline claim:

```bash
LR_ENGINE=wasm node --import tsx scripts/benchmark/arc_motion_study.ts \
  --source=sparse_lowline --budget=750000 --defaults=production \
  --options='{"responseDamping":0.3}' --out=generated/example.json
```

For a full V4 research panel, use `scripts/benchmark/arc_study.ts --suite=v4`.
It preserves interval-level evidence, while the public canonical runner verifies
ordinary dispatcher behavior. Freeze the compiler in a clean checkout and keep
it unchanged until the run finishes:

```bash
npm run benchmark:v4 -- status
npm run benchmark:v4 -- eval --compiler-root=/absolute/clean/compiler \
  --out=/absolute/local/output --jobs=16
```

Both canonical seeds must be included for the canonical result. At zero jitter,
they currently reproduce identical tracks; adding more such seeds does not
create independent evidence. The separate `arc_guidance_robustness.ts` panel
perturbs search targets on reused V2 development inputs. Report it separately
and retain adverse cases. Broader generalization needs genuinely different
inputs and clearly disclosed development exposure.

Inspect the complete headline, validity, distinct tracks, meaningful case/group
movements, actual physics frames, and evidence for the proposed mechanism.
A single map regression is not an automatic veto. The owner explicitly values
substantial design simplification and future extensibility, even with a small
measured score tradeoff. Investigate regressions, distinguish repeated inputs
from independent variation, and explain the decision without inventing extra
acceptance gates. A first weak implementation need not invalidate the idea.

## Keep the foundation usable

Put new curve dimensions in the geometry type/builder and shared control
registry; construction, repair, diversity and memo identity use that registry.
Keep learned model schemas explicit. Do not change feature meaning beneath an
existing trained artifact. Prefer shared proposal/evaluation mechanisms to
separate special-case search paths. Retain useful research and fallback code
with an explicit role; delete demonstrably dead or duplicated behavior.

Run tests appropriate to the changed behavior and check the frozen contract.
The repository currently has inherited TypeScript diagnostics; compare exact
normalized diagnostics instead of claiming that a failing global typecheck
passes. Repeated runs need a reason, such as new source changes, a failure, or
an unresolved empirical question. Choose worker counts from available memory.

Preserve code, required runtime assets, compact evidence and checksums in Git.
Large raw tracks, datasets, unselected models, profiles and videos stay local.
Bind evidence to the compiler source and unchanged judge; preserve rejected
experiments as well as the selected result. The older [V2 workflow](compiler-v2-workflow.md)
and [legacy component inventory](optimizer/legacy-components.md) are references,
not current campaign instructions.
