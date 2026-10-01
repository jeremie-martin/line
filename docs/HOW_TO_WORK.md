# Working on the compiler

The current production task uses **frozen V6**: 115 canonical cases × seeds
101/202/303/404, 74 confirmation cases × seeds 503/607/709/811, and 3m actual
physics frames per compile. It measures musical accuracy while fulfilling fixed
construction/layout requests and complete contextual arrangements. Motion is a
separate qualification and diagnostic obligation; it never filters the headline.
[The V6 contract](../benchmark/v6/README.md) defines the task;
[the current report](intentional-motion-results-20261001.md) records the selected
835.6161 result and the unfinished 850 ambition.

**Frozen V5 remains the historical repertoire companion:** its V1 policy,
75 canonical cases × seeds 101/202, and 3m allowance stay unchanged. Its earlier
confirmation panel has already been used and reported; it is development evidence.

**Frozen V4 remains the ordinary-profile companion:** all 176 specifications,
seeds 16/17, and 750,000 frames. The accepted result and goal status live in
[goal.md](../goal.md). Do not substitute historical V2 promotion rules, silently
reroll requested geometry, or change a frozen benchmark to improve a result.

[Automatic production](automatic-production.md) now supports guided expressive
shapes, deliberate open arcs, later-receiver transfers and scattered normal-line
passages through shared search. Earlier rejection of scattered geometry is no
longer a blanket exclusion.
The ordinary V4 style contract remains unchanged, and the acceleration restriction still applies.
Physical validity and a high score do not establish visual quality; use faithful
native playback with music to review meaningful style changes. Finished vertical
rendering remains available when useful or requested, not a routine prerequisite.

The [intentional-motion roadmap](intentional-motion-roadmap.md) defines the approved
scope. V6 was frozen at `7f8591c6` before its canonical baseline and optimization;
V5/V4 definitions remain unchanged. Follow the
[campaign ledger](intentional-motion-campaign.md) for execution and exposure history.

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

For current repertoire work, freeze the compiler and run complete V6 through
`scripts/benchmark/v6.ts eval --compiler-root=CHECKOUT --out=DIR --jobs=8`.
Use `--split=confirmation` only after selection. Keep requests and the 3m allowance
fixed. Also run the frozen V5 and V4 companions. Report fixed and automatic panels,
physical fulfillment, motion, local errors, actual work and distinct tracks
separately. Any confirmation outcomes already inspected are known evidence for
subsequent research, not permanently untouched validation. If they motivate a
revision, disclose that exposure and reserve fresh confirmation before tuning.

The production-motion qualifier independently replays all twelve known-song
arrangements against preserved references. Passing its frozen burst/opening rules
does not certify all unseen music or replace visual review. Keep unsuccessful
collections and report individual regressions alongside aggregate improvements.

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
