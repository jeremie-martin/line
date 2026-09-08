# Compiler improvement campaign

The active normal-line arc compiler is **arc-refinement**, promoted at
**767.6851** on the unchanged Benchmark V2 at 750k, up **23.1851** from the
preserved 744.5000 milestone. All **352/352 canonical runs** pass: the complete
44-case development suite, seeds 16–23. The declared maximum was N=48 and the
unchanged protocol accepted its first N=8 look. Promotion was not forced.

## What changed

Coherent supporting arcs now have variable turn timing, an additional smooth
bend and varying guide separation. Joint response fitting measures how several
controls affect the physical result and tests coupled corrections. Strict
lookahead rejects incomplete deeper continuations. Adaptive planning reserves
measured construction work and spends remaining allowance on useful depth,
breadth and following-arc search.

A frozen model learns future continuation value from deeper simulations. It
uses relative physical body state and upcoming authored targets, without case,
seed, budget or absolute-position features. It ranks arrivals worth simulating;
exact physics validates the candidates and the unchanged scorer judges the
complete track. Training uses 20,298 development arrivals from 21 parents.
Parent-disjoint live research scores 766.4420 versus matched reference 745.7898;
pilot results selected the blend, so this is not an untouched final test.
Qualification was excluded from training and configuration selection.

Completed-track repair was implemented in several forms, including warm suffix
reconstruction and retained alternatives. Its best eight-case pilot gains 6.3304
points at 3M. Deeper initial planning is the stronger tested use of that allowance,
so the repair implementations remain available for research. Initial adverse
geometry and Newton trials are retained alongside successful experiments.

## Scaling and validation

| Actual frame allowance | Preserved reference | Arc refinement | Valid cases | Maximum actual work |
| --- | ---: | ---: | ---: | ---: |
|150k|481.1128|481.1128|38/44|149,995|
|250k|610.9446|610.9446|44/44|244,538|
|500k|709.4171|718.8741|44/44|487,721|
|750k|744.5000|767.6851|44/44|735,216|
|1M|745.0343|793.3941|44/44|950,759|
|3M|745.0343|812.0916|44/44|2,563,754|

All scale rows use the full 44-case suite and one zero-jitter discovery seed.
The 750k row also has canonical confirmation. The 3M gain is 67.0573 at the same
allowance. Actual work is greater at higher budgets; this is not a constant-cost
gain. The 750k median cost is 716,007 frames versus 715,502 for the reference.
[Standalone scaling chart](../archives/arc-refinement-2026-09-08/budget-scaling.svg).

Every canonical track, report, score and frame cost matches discovery exactly.
Thirty-six cases improve and eight regress, the largest loss being Sparse
Lowline at 31.927 points. Zero-jitter seeds repeat 44 distinct tracks; seed SE is
zero. The catalog sensitivity interval for the gain is [19.9278,26.3050].

Qualification passes 120/120: its monitor rises from 649.2793 to 691.0046.
Its 250k component falls from 607.1908 to 601.2726; 500k rises to 690.5581 and 750k
to 751.5702. Separate search-target jitter 0.02, all 44 sources and seeds 101–104,
passes 176/176 distinct tracks for both candidate and reference, with mean
per-cell gain 23.8694. Neither study establishes robustness to every new regime.

At 250k every development track is unchanged. The standing reading independently
passes 528/528 and returns PARITY, with all cells bit-identical and score 645.6560.
At 150k all reports, scores and costs match the reference; six failures remain.
Two complete tracks exactly reproduce the published JavaScript engine. Four
focused test files pass 17 tests; repository-wide TypeScript checking retains
unrelated existing errors and has no diagnostics in changed compiler modules.

Every line is normal type 0. The 750k geometry audit covers 4,100 groups, including
1,048 single curves. Each group has at most two continuous chains, with no motif
quota. All three full production videos are rendered at the original 1M budget
with the full vertical pipeline. They pass physical contracts but remain below the unchanged 2% standing-time
creative floor (Luna 1.6292%, Amor and Tiki 0%). Broader aesthetic objective
design remains for owner discussion.

## Saved milestone and further work

[Video gallery](../archives/arc-refinement-2026-09-08/index.html) ·
[Research record](arc-refinement-campaign.md) ·
[Video review](arc-refinement-video-review.md) ·
[Validation index](../benchmark/v2/studies/arc-refinement-validation.json).

Work branch: `codex/arc-refinement`; preservation branch: `archive/arc-refinement-767`.
The 744.5 reference remains on `archive/arc-guidance-planning-744`, with its original
videos and source. Earlier arc and proof-of-concept archives remain intact.
The new archive preserves source, judge, inputs, models, unsuccessful trials,
reports and checksums locally; nothing was published.

Research remains open. Useful next questions include repairing downstream motion
without discarding good continuations, learning when additional search is worth
its cost, improving the eight regressions, and extending the expressive geometry
or planning beyond the tested horizons. The present results establish neither a
performance ceiling nor an unlimited scaling law. Owner constraints remain normal
coherent physical curves and the fixed benchmark/scorer/physics/accounting.
