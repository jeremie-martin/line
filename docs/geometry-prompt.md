# Geometry campaign — working prompt

**Read first.** `docs/geometry-campaign.md` (scope: the arc-generation/aim pipeline and
where the levers actually are) and `docs/geometry-log.md` (every attempt + result —
don't repeat a logged dead end). `CLAUDE.md` (the **minimal-simulation rule** — engine
only inside arcs and on real DFS expansion; ballistic from the geometric arc exit
everywhere else, via `arc_model.ts propagateBallisticArrivalState`; never violate).
Production code: `optimizer/handoff.ts` (`compileHandoff`), `arc_placement.ts`
(`sampleContactCenteredLines` — where a candidate arc's geometry is built),
`optimizer/node.ts` (`getCandidatesSorted` — pool build + sort), `optimizer/aim.ts`
(`makeEnumAimedCandidates` / `makeJointAimedCandidates` — the aim lane),
`optimizer/{arc_model,objective,readiness}.ts`.

**The thesis.** The remaining headroom on the geometry-capped specs is bound by the
**shape of the generated situation** — where the shot (launch) and the catch (landing)
physically go, and the length/curvature/placement of the arc that carries the rider
there — not by search depth or budget allocation. The candidate arcs today come from a
**guided random sweep** (`sampleContactCenteredLines`: sample K, sort by cost, keep
best); aim then refines the top bases with two knobs (pitch = rotate the last third,
rotate = rotate the whole arc). The bet: a **wider, smarter range of proposed geometry,
better matched to the state the rider arrives in**, lifts the geometry-capped specs.
Aim affects geometry too (where/how-fast the shot lands) but lives in a narrow safe
region — whole-arc rotation trips landing/survival gates easily (already instrumented as
`enum_rot_gate_fail`). Treat that sensitivity as a constraint, not a free lever.

**Goal.** Push the board headline **up** by improving the geometry — anything in scope:
how candidate arcs are sampled (breadth, the `ARC_LEN_SPAN_*` length lever, curvature,
entry/exit angle), how arc shape adapts to the incoming rider state (speed/angle), the
aim knobs and their proposer, and how proposals are kept inside the safe region. New
approaches welcome. **North star: headline ≥ 700**; every accepted change moves it up.

**Measure with the geometry board — the sole driver for this work.**
- `./scripts/v0/eval_geometry.sh` (fast probe tier): 12 specs x {150k,300k} x 9 seeds
  against a frozen baseline it builds once and reuses; prints `decide` +
  per-track/per-budget/per-axis deltas. `./scripts/v0/eval_geometry.sh info` shows the
  resolved config; `rebuild` forces a fresh baseline for the current params (do this to
  advance the baseline after committing a win). The board is the decision instrument —
  no separate canonical gate.
- Clean isolation: prefer an env flag (e.g. an existing `LR_*` knob) so both arms share
  one tree; otherwise the default frozen-snapshot mode compares current code vs the
  baseline's code. Numbers only from real runs.
- Gotchas: workers import the tree per task, so never edit code mid-run; the board's
  JOBS is parallelism only (not in the fingerprint).

**Workflow — empirical first, then modify production directly; keep only wins.**
1. **Hypothesis from evidence, not vibes.** Before changing a default, gather the data:
   add default-off telemetry, write/extend a study script (`study_arc_sensitivity.ts`,
   `study_joint_arc_model.ts`, `analyze_arcs.ts`, …), do exploratory runs. State what the
   data shows, then what you'll change. Part of this campaign is measurement — statistics,
   telemetry, small studies — not just A/Bs.
2. Smallest change to the **production default** — no flag, no A/B knob hiding it.
3. Run the board; read `decide` + the per-cell deltas vs the frozen baseline.
4. ACCEPT (headline up, no real regression) → commit, then `rebuild` the board baseline
   so it tracks the new HEAD. REJECT → revert the code (keep the log entry + any
   scripts), baseline unchanged.
5. Terse, objective log entry: setup · what I did · result (headline Δ + per-budget/cell)
   · verdict. **Facts only — never explain a result by a presumed mechanism we have not
   measured.** "X paid +N" — not "X paid because the rider Y."

**Keep it simple.** One production geometry path, accumulating only accepted wins. No
flag-gating the change under test, no dead knobs, no per-spec carve-outs, no engine
frames smuggled past the arc exit. Clean minimal diffs; the log records everything.
