# Working on the compiler

The broader production task uses **frozen V5**: 75 canonical cases × seeds 101/202,
40 confirmation cases × seeds 307/409, and 3m actual physics frames per compile.
It measures musical accuracy while fulfilling fixed construction requests and
complete automatic plans. [The V5 contract](../benchmark/v5/README.md) defines
qualification; [the current report](production-repertoire-results-20261001.md)
discloses the remaining numerical gap and failures.

**Frozen V4 remains the ordinary-profile companion:** all 176 specifications,
seeds 16/17, and 750,000 frames. The accepted result and goal status live in
[goal.md](../goal.md). Do not substitute historical V2 promotion rules, silently
reroll requested geometry, or change either benchmark to improve a result.

[Automatic production](automatic-production.md) now supports guided expressive
shapes, deliberate open arcs and scattered normal-line passages through shared
search. Earlier rejection of scattered geometry is no longer a blanket exclusion.
The ordinary V4 style contract remains unchanged, and the acceleration restriction still applies.
Physical validity and a high score do not establish visual quality; use faithful
native playback with music to review meaningful style changes. Finished vertical
rendering remains available when useful or requested, not a routine prerequisite.

The [intentional-motion roadmap](intentional-motion-roadmap.md) proposes the next
campaign and is awaiting approval. Its V6 and score ambition do not replace the
current frozen contracts until that campaign is authorized and its new contract
is explicitly frozen.

## Start from actual behavior

Use the [compiler module map](../scripts/v0/optimizer/README.md) and the
[design audit](compiler-design-audit-2026-09-11.md). `compileHandoff` is the public
entry point; `connectedArcOptions` supplies the actual production settings to
research for the ordinary profile. The [production architecture](production-repertoire-architecture.md)
maps automatic planning, construction search, realization and rendering.
Reference engines, unsupported ordinary axes and diagnostic requests still
need the explicitly retained legacy backend. Hook-based legacy studies call
`compileLegacyHandoff` directly.

Inspect measured work, selected trajectories and unsuccessful attempts before
choosing a change. Returned interval rows describe the selected track; aggregate
work includes all attempts. The `attempts` records attribute construction,
planning, replay and first completion separately. Models propose controls;
real metered physics validates them. Do not use benchmark names or seeds as
quality shortcuts in learned features or search decisions. Seeds legitimately
drive the explicit deterministic variety and search random streams.

## Experiment and compare

A small physical study is useful for a mechanism check, not a headline claim:

For repertoire work, freeze the compiler and run both complete V5 panels through
`scripts/benchmark/v5.ts eval --compiler-root=CHECKOUT --out=DIR --jobs=8`;
add `--split=confirmation` for the predeclared confirmation panel. Keep the policy
requests and 3m allowance fixed. Report fixed and automatic panels, physical
fulfillment, local errors, actual work and distinct tracks separately. The
confirmation results already reported in this campaign are known evidence for
future campaigns, not permanently unseen validation.

For an ordinary-arc mechanism study:

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
