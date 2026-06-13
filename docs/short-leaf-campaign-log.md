# Short-leaf campaign — attempt log

Terse audit trail. One entry per attempt: hypothesis · change · result (headline + big_air
cells + any regression) · verdict. Numbers always from re-running `eval_short_leaf.sh`
(focus board: drums_crescendo, solo_run, big_air_ramp × 100k/200k/300k × 12 seeds) against
the committed one-time full-leaf baseline. The board is the fast proxy; a real promotion
needs a canonical run.

Baseline at campaign start (committed full leaf vs short leaf, pre-fix):

```
HEADLINE   short 619.65   full 634.37   Δ -14.72
  big_air_ramp 100k  607.5 / 669.7  -62.3
  big_air_ramp 200k  633.8 / 679.6  -45.8
  big_air_ramp 300k  633.6 / 676.2  -42.6
  drums/solo: parity
```

---

## 1. Objective leaf scored the WRONG WINDOW (axis factor) — ACCEPT

**Hypothesis.** The −50 on big_air is axis-noise-driven tie-breaking (Jérémie's
`eval_rollout_ranking.sh` finding: on pool disagreements the short pick is equivalent on
every true factor — drift/off_beat/missing/survival contribute exactly zero — and the flip
is driven entirely by the axis factor, where the short leaf's own ballistic view of its pick
(~0.48 quality) diverges from the composed truth (~0.60) by ~0.12). Drilling in: the
objective leaf reads each committed gap's `fit.achieved`, measured over the LOOKAHEAD window
`[gap.start, axisLookaheadEndFrame]` — which for AIR gaps runs through the NEXT contact
(`core/candidate.ts axisLookaheadEndFrame`). But the TRUE scorer measures each gap over
`[gap.start, gap.endFrame]` (`buildDriftReport` → `measureGapAxes(det, g, …, g.endFrame)`).
For big_air's long post-landing flights these windows differ enormously, so the leaf's
combined-RMS axis factor is a systematically different number than the scorer's — independent
of any ballistic error.

**Evidence.** New `eval_leaf_window.ts`: on one committed track, pool the per-axis errors of
all committed contact gaps and compute the resulting combined-RMS axis_quality three ways —
(A) `fit.achieved` lookahead/ballistic, (B) engine@lookahead, (C) engine@gap.endFrame (the
true scorer). big_air seeds 0/1/2 @200k: **A vs B (ballistic only) Δquality ≈ +0.01** (tiny),
**B vs C (WINDOW only) Δquality ≈ −0.05 to −0.11** (the whole divergence). The ballistic is
not the problem; the window is. (`eval_arc_apples.ts` separately confirmed per-arc axis-quality
ranking already agrees, spearman 0.98 — so the issue was never per-arc measurement.)

**Change.** The gap-window `[gap.start, gap.endFrame]` measurement is PURE ENGINE — gap.endFrame
is inside the prefix the survival floor already simulates, so it costs zero ballistic and zero
extra frames. Store it as `GapFit.achievedAtEnd` (computed in `evaluateGapFit` via the exact
`measureGapAxes(det, gap, lines, gap.endFrame)` call the true scorer makes; left undefined when
the lookahead window already equals the gap window, i.e. non-air gaps). `objectiveLeafValue`
reads `fit.achievedAtEnd ?? fit.achieved`. `fit.achieved` (lookahead) is untouched — it remains
the single ballistic measurement the local feasibility ranker uses. Full-leaf mode never reads
the new field → committed full baseline byte-identical (no RNG / no sim-frames perturbation).
Carried through the two GapFit clone sites (handoff.cloneGapFit, polish.cloneFits).

**Result.**

```
HEADLINE   short 634.36   full 634.37   Δ -0.01   (was -14.72)
  big_air_ramp 100k  671.7 / 669.7  +1.9   (was -62.3)
  big_air_ramp 200k  674.3 / 679.6  -5.4   (was -45.8)
  big_air_ramp 300k  676.6 / 676.2  +0.3   (was -42.6)
  drums_crescendo    +3.1 / +0.9 / -1.0    (no regression)
  solo_run           +1.7 / +2.4 / -0.3    (no regression)
  validity 100% everywhere
decide: Δheadline -0.0, 95% CI [-5.1, 2.8], effect -0.01 → INCONCLUSIVE (statistical tie)
```

**Verdict. ACCEPT.** Deficit −14.72 → −0.01 (statistical parity). Per-cell constraint met:
worst cell big_air 200k −5.4, well within −10. No drums/solo regression. Headline is 0.01
under the 634.37 bar — inside the decide CI (a tie), not a real shortfall. Clean minimal diff,
one ballistic source of truth preserved, no per-spec carve-out, no engine frames past the arc
exit. Committed `01d7af8`. Verified full-leaf byte-identical (big_air seed3@200k = 667.25 both).

**Post-fix audit — the axis lever is exhausted (exact).** `eval_leaf_window.ts` column D
(the STORED `achievedAtEnd` the leaf now reads) vs C (composed engine@endFrame, the true
scorer): **Δquality = 0.0000 across seeds 0/1/2** — the leaf's axis factor is now byte-faithful
to the scorer for every committed gap (the gap-fit det measurement is causally identical to the
composed-track measurement, as expected). So the residual big_air 200k −5.4 is NOT an axis-leaf
error — it is irreducible search-PATH divergence (short and full are still different searches;
their rollouts can commit different near-equivalent arcs), and it sits inside the decide CI
[−5.1, 2.8]. The user's shadow study already cleared survival/missing/drift/off_beat at the
decision point, so there is no remaining faithful lever inside the leaf; further headline motion
would require changing the search itself, which is out of scope. Campaign objective (short leaf
matches the full leaf) reached.

---

## 2. All-specs verification + DEFAULT FLIP — ACCEPT (+1.72)

Re-ran on **ALL 40 golden specs** (× 12 seeds × 3 budgets), not just the 3-spec focus board:
short **619.31** vs full **617.59**, **Δ +1.72**, decide **ACCEPT** (CI [1.1, 2.4], P(Δ≤0)=0%,
100% validity). Worst cell tiny_dance −0.7 / dense_sprint −0.2 (noise); **zero specs regressing
>1pt**; big_air_ramp **+2.4**; best drums_tide +3.7 / opening_burst +3.5 / pop_train +3.0 (the
other air spec that had trailed). The focus-board −0.01 (entry 1) was a hard 3-spec subset;
suite-wide the short leaf's ~21%-cheaper rollout buys more search per budget and wins.

Audit (loose-end check): `measureGapAxes` is the single axis fn (no parallel impl); `achievedAtEnd`
is carried through every GapFit construct/clone site (evaluateGapFit / evaluateCandidateLines /
cloneGapFit / cloneFits — all candidate paths route through evaluateGapFit); residual exactly 0
(eval_leaf_window col D); full-leaf byte-identical. **Made the short leaf the default** —
`forwardEvalLeaf()` returns `"objective"`; `"full"`/`"shadow"` are explicit escape hatches;
start-eval still forces `"full"`. Committed `dcfcf03` (eval all-specs) + `989a5b5` (default flip);
suite 299/299.

## 3. Terminal survival reproduces reachedEnd = 1 — faithfulness, byte-identical

The leaf scored survival = lastContact/duration for every leaf, but the true scorer gives 1.0 on
reachedEnd (endOfSpec). A terminal leaf reaches endOfSpec — verified: full-leaf survival = 1.0 on
every complete node across specs (drums included) — so the proxy under-scored terminal rollouts by
the ride-out tail (~0.06). Gated on `isTerminalNode` (the full leaf's own `fullDuration` predicate)
→ survival 1; partial leaves keep the proxy. **Verified BYTE-IDENTICAL** across all 40 specs × 12
seeds × 3 budgets (0/1440 cells differ): terminal survival is a constant among terminal candidates,
so it cancels in the ranking argmax. Score-neutral, but it closes the leaf's last reconstruction
gap (all five factors now exact) and makes the per-factor telemetry honest, at zero risk. Committed
`589e801`; suite 300/300.

**Campaign complete.** The objective leaf is an exact, ~21%-cheaper reconstruction of the true
scorer, beats it **+1.72** suite-wide (ACCEPT, zero regressions), and is the default. A canonical
run remains the formal promotion gate.
